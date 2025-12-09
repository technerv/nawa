import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { createAnonymousWitnessMessage, getPublicCase, listWitnessMessages, CrimeWitness } from '../api/crime'
import { showToast } from '../lib/toast'

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
    <div>
      <div className="row" style={{ alignItems: 'center', justifyContent: 'space-between' }}>
        <h2>Track Case & Send Update (Anonymous)</h2>
        <button type="button" onClick={quickExit} style={{ padding: '6px 10px', background: '#0f172a', color: 'white', borderRadius: 6 }}>Quick Exit</button>
      </div>
      {toasts.length > 0 && (
        <div style={{ display: 'grid', gap: 8, margin: '8px 0' }}>
          {toasts.map((t) => (
            <div key={t.id} className="toast">{t.text}</div>
          ))}
        </div>
      )}
      <form onSubmit={submit} style={{ display: 'grid', gap: 8, maxWidth: 640 }}>
        <label>Case ID</label>
        <div className="row" style={{ gap: 8 }}>
          <input style={{ flex: 1 }} placeholder="OB Number or numeric ID" value={caseId} onChange={(e) => setCaseId(e.target.value)} />
          <button type="button" onClick={lookupCase} disabled={loadingCase}>Find Case</button>
        </div>
        <label>Your Message</label>
        <textarea rows={3} value={statement} onChange={(e) => setStatement(e.target.value)} />
        <label>Name (optional)</label>
        <input value={name} onChange={(e) => setName(e.target.value)} />
        <label>Contact (optional)</label>
        <input value={contact} onChange={(e) => setContact(e.target.value)} />
        <button disabled={sending} type="submit">Send Update</button>
      </form>
      {caseInfo && (
        <div className="card" style={{ marginTop: 12 }}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <div style={{ fontWeight: 600 }}>{caseInfo.name_of_crime}</div>
            <div style={{ fontSize: 12, opacity: .8 }}>OB: {caseInfo.occurance_book_number}</div>
          </div>
          <div style={{ fontSize: 13, color: '#4b5563', marginTop: 4 }}>{caseInfo.location_name || caseInfo.county || ''}</div>
          <div style={{ fontSize: 12, color: '#6b7280' }}>Updated: {new Date(caseInfo.date_updated).toLocaleString()}</div>
        </div>
      )}
      {messages.length > 0 && (
        <div className="card" style={{ marginTop: 12 }}>
          <strong>Recent messages</strong>
          <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
            {messages.map((m, i) => (
              <div key={m.id ?? i} style={{ background: '#f3f4f6', padding: 8, borderRadius: 6 }}>
                <div style={{ fontSize: 12, color: '#374151' }}>{(m.name || 'Anonymous')}{m.contact_information ? ` · ${m.contact_information}` : ''}</div>
                <div style={{ marginTop: 4 }}>{m.statement}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
