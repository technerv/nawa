import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { createAnonymousWitnessMessage, getPublicCase, listWitnessMessages, CrimeWitness } from '../api/crime'
import { showToast } from '../lib/toast'
import { formatDate } from '../lib/dateFormat'
import { formatLocation } from '../lib/locationFormat'

export default function TrackCasePage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [caseId, setCaseId] = useState('')
  const [name, setName] = useState('')
  const [contact, setContact] = useState('')
  const [statement, setStatement] = useState('')
  const [sending, setSending] = useState(false)
  const [caseInfo, setCaseInfo] = useState<any | null>(null)
  const [messages, setMessages] = useState<CrimeWitness[]>([])
  const [loadingCase, setLoadingCase] = useState(false)
  const [toasts, setToasts] = useState<{ id: number; text: string; type: 'success' | 'error' | 'info' }[]>([])
  useEffect(() => {
    function onToast(e: any) {
      const { text, type } = e?.detail || {}
      const id = Date.now() + Math.random()
      setToasts((prev) => [...prev, { id, text: String(text || ''), type: type || 'info' }])
      setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3000)
    }
    window.addEventListener('toast', onToast as any)
    return () => { window.removeEventListener('toast', onToast as any) }
  }, [])
  useEffect(() => {
    const ob = searchParams.get('ob')
    const id = searchParams.get('id')
    const raw = ob || id
    if (raw) {
      setCaseId(raw)
      setTimeout(() => { void lookupCase() }, 0)
    }
  }, [searchParams])
  async function lookupCase() {
    const raw = caseId.trim()
    if (!raw) { setCaseInfo(null); setMessages([]); return }
    setLoadingCase(true)
    try {
      const info = await getPublicCase(/^\d+$/.test(raw) ? Number(raw) : raw)
      setCaseInfo(info)
      try {
        const msgs = await listWitnessMessages(info.id)
        setMessages(msgs)
      } catch {}
    } catch (err: any) {
      setCaseInfo(null)
      setMessages([])
      showToast(String(err?.response?.data?.detail || 'Case not found'), 'error')
    } finally {
      setLoadingCase(false)
    }
  }
  async function submit(e: any) {
    e.preventDefault()
    if (!caseId.trim()) { showToast('Enter your Case ID', 'error'); return }
    if (!statement.trim() || statement.trim().length < 10) { showToast('Provide a message of at least 10 characters', 'error'); return }
    setSending(true)
    try {
      const payload: any = { statement: statement.trim() }
      const raw = caseId.trim()
      if (/^\d+$/.test(raw)) payload.case_id = Number(raw)
      else payload.occurance_book_number = raw
      if (name.trim()) payload.name = name.trim()
      if (contact.trim()) payload.contact_information = contact.trim()
      const resp = await createAnonymousWitnessMessage(payload)
      showToast('Message submitted', 'success')
      try { window.dispatchEvent(new CustomEvent('toast', { detail: { text: `Linked to Case ${String(raw)}`, type: 'info' } })) } catch {}
      setStatement('')
      try { await lookupCase() } catch {}
    } catch (err: any) {
      showToast(String(err?.response?.data?.detail || err?.message || 'Submission failed'), 'error')
    } finally {
      setSending(false)
    }
  }
  function quickExit() {
    setCaseId('')
    setName('')
    setContact('')
    setStatement('')
    setCaseInfo(null)
    setMessages([])
    try { navigate('/welcome') } catch {}
  }
  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-primary to-secondary text-white rounded-lg shadow-lg p-6 mb-6">
        <div className="flex justify-between items-center">
    <div>
            <h2 className="text-3xl font-bold mb-2">Track Case & Send Update</h2>
            <p className="text-gray-100 text-sm">Track your case and send anonymous updates</p>
          </div>
          <button 
            type="button" 
            onClick={quickExit}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
          >
            Quick Exit
          </button>
        </div>
      </div>
      {toasts.length > 0 && (
        <div className="grid gap-2">
          {toasts.map((t) => (
            <div 
              key={t.id} 
              className={`p-3 rounded-lg ${
                t.type === 'error' ? 'bg-red-50 border border-red-200 text-red-800' :
                t.type === 'success' ? 'bg-green-50 border border-green-200 text-green-800' :
                'bg-blue-50 border border-blue-200 text-blue-800'
              }`}
            >
              {t.text}
            </div>
          ))}
        </div>
      )}
      <div className="bg-white shadow-md rounded-lg p-6 border border-gray-200">
        <h3 className="text-xl font-bold mb-4 text-gray-800 border-b pb-3">Case Information</h3>
        <form onSubmit={submit} className="grid gap-4 max-w-2xl">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Case ID</label>
            <div className="flex gap-3">
              <input 
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="OB Number or numeric ID" 
                value={caseId} 
                onChange={(e) => setCaseId(e.target.value)} 
              />
              <button 
                type="button" 
                onClick={lookupCase} 
                disabled={loadingCase}
                className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors font-medium disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {loadingCase ? 'Finding...' : 'Find Case'}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Your Message <span className="text-red-500">*</span></label>
            <textarea 
              rows={4}
              value={statement} 
              onChange={(e) => setStatement(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary focus:border-transparent resize-y"
              placeholder="Enter your message (minimum 10 characters)"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name (optional)</label>
              <input 
                value={name} 
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="Your name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contact (optional)</label>
              <input 
                value={contact} 
                onChange={(e) => setContact(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="Phone or email"
              />
            </div>
        </div>
          <button 
            disabled={sending} 
            type="submit"
            className="px-6 py-3 bg-primary text-white rounded-md hover:bg-secondary transition-colors font-medium disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {sending ? 'Sending...' : 'Send Update'}
          </button>
      </form>
      </div>
      {caseInfo && (
        <div className="bg-white shadow-md rounded-lg p-6 border border-gray-200">
          <div className="flex justify-between items-start mb-3">
            <h3 className="text-xl font-bold text-gray-800">{caseInfo.name_of_crime}</h3>
            <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">OB: {caseInfo.occurance_book_number}</span>
          </div>
          <div className="text-gray-600 mb-2">{formatLocation(caseInfo.location_name, caseInfo.county, undefined, caseInfo.latitude, caseInfo.longitude)}</div>
          <div className="text-sm text-gray-500">Updated: {formatDate(caseInfo.date_updated)}</div>
        </div>
      )}
      {messages.length > 0 && (
        <div className="bg-white shadow-md rounded-lg p-6 border border-gray-200">
          <h3 className="text-xl font-bold mb-4 text-gray-800 border-b pb-3">Recent Messages</h3>
          <div className="grid gap-4">
            {messages.map((m, i) => (
              <div key={m.id ?? i} className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <div className="flex justify-between items-center mb-2">
                  <div className="text-sm font-medium text-gray-700">
                    {(m.name || 'Anonymous')}{m.contact_information ? ` · ${m.contact_information}` : ''}
                  </div>
                </div>
                <div className="text-gray-800">{m.statement}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
