import { useState, useEffect } from 'react'
import { createPublicCrimeReport, listCrimeCategories } from '../api/crime'
import { useQuery } from '@tanstack/react-query'
import { showToast } from '../lib/toast'
import { MapContainer, TileLayer, Marker, useMapEvents, Popup } from 'react-leaflet'
import { defaultMarkerIcon } from '../lib/leafletIcons'
import { normalizeCountyName, initCountyAliases, areAliasesReady } from '../lib/normalizeCounty'
import { useNavigate } from 'react-router-dom'

export default function ReportForm() {
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')
  const [county, setCounty] = useState('')
  const [lat, setLat] = useState<number | undefined>()
  const [lon, setLon] = useState<number | undefined>()
  const [categoryId, setCategoryId] = useState<number | undefined>()
  const [status, setStatus] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const cats = useQuery({ queryKey: ['categories', { for: 'public_report' }], queryFn: () => listCrimeCategories() })
  const navigate = useNavigate()
  const [hp, setHp] = useState('')
  const [ca, setCa] = useState<number>(0)
  const [cb, setCb] = useState<number>(0)
  const [ans, setAns] = useState<number | undefined>()
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
    const a = Math.floor(Math.random() * 9) + 1
    const b = Math.floor(Math.random() * 9) + 1
    setCa(a)
    setCb(b)
    setAns(undefined)
  }, [])

  useEffect(() => {
    ;(async () => {
      try { if (!areAliasesReady()) await initCountyAliases() } catch {}
    })()
  }, [])

  useEffect(() => {
    if (lat == null || lon == null) return
    const controller = new AbortController()
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&zoom=10&addressdetails=1`
    fetch(url, { signal: controller.signal, headers: { 'Accept': 'application/json' } })
      .then((res) => res.ok ? res.json() : Promise.reject(new Error(String(res.status))))
      .then((data) => {
        const addr = data?.address || {}
        const c = addr.county || addr.state_district || addr.state || ''
        if (c) setCounty(normalizeCountyName(String(c)))
      })
      .catch(() => {})
    return () => controller.abort()
  }, [lat, lon])

  function quickExit() {
    setName('')
    setDesc('')
    setCounty('')
    setLat(undefined)
    setLon(undefined)
    setCategoryId(undefined)
    setVideoFile(null)
    setHp('')
    setAns(undefined)
    try { navigate('/welcome') } catch {}
  }

  async function submit(e: any) {
    e.preventDefault()
    setStatus('sending')
    setErrorMsg(null)
    try {
      if (!name || !categoryId) {
        setStatus('error')
        setErrorMsg('Please fill required fields: name and category')
        return
      }
      const trimmed = (desc || '').trim()
      if (!trimmed || trimmed.length < 20) {
        setStatus('error')
        setErrorMsg('Please provide a description of at least 20 characters')
        return
      }
      const payload = {
        name_of_crime: name,
        description: desc || undefined,
        county: county || undefined,
        location_name: undefined,
        location_description: undefined,
        latitude: lat,
        longitude: lon,
        category_of_crime: categoryId!,
        evidence_video_file: videoFile || undefined,
        honeypot: hp,
        captcha_a: ca,
        captcha_b: cb,
        captcha_answer: ans ?? -1
      }
      const resp = await createPublicCrimeReport(payload)
      setStatus('ok')
      try {
        const code = (resp && (resp.code || resp.tracking_code || resp.id || resp.occurance_book_number))
        if (code) {
          showToast(`Report submitted. Case ID: ${String(code)}`, 'success')
        } else {
          showToast('Report submitted', 'success')
        }
      } catch { showToast('Report submitted', 'success') }
      try { window.dispatchEvent(new CustomEvent('public_report_created', { detail: { lat, lon } })) } catch {}
      setName('')
      setDesc('')
      setCounty('')
      setLat(undefined)
      setLon(undefined)
      setCategoryId(undefined)
      setVideoFile(null)
      setHp('')
      setAns(undefined)
    } catch (err) {
      setStatus('error')
      setErrorMsg((err as any)?.message || 'Submission failed')
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-primary to-secondary text-white rounded-lg shadow-lg p-6 mb-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-3xl font-bold mb-2">Report Incident (Anonymous)</h2>
            <p className="text-gray-100 text-sm">Report a crime incident safely and anonymously</p>
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
        <h3 className="text-xl font-bold mb-4 text-gray-800 border-b pb-3">Incident Details</h3>
        <form onSubmit={submit} className="grid gap-4 max-w-3xl">
          {errorMsg && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-800">
              {errorMsg}
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name of Crime <span className="text-red-500">*</span></label>
              <input 
                required 
                name="name_of_crime" 
                value={name} 
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="Enter crime name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category <span className="text-red-500">*</span></label>
              <select 
                required 
                name="category_of_crime" 
                value={categoryId ?? ''} 
                onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : undefined)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary focus:border-transparent bg-white"
              >
                <option value="">Select category</option>
                {cats.data?.results.map((c) => (
                  <option key={c.id} value={c.id}>{c.crime_category} ({c.crime_short_code})</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description <span className="text-red-500">*</span></label>
            <textarea 
              name="description" 
              value={desc} 
              onChange={(e) => setDesc(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary focus:border-transparent resize-y"
              placeholder="Provide a detailed description (minimum 20 characters)"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">County</label>
              <input 
                name="county" 
                value={county} 
                onChange={(e) => setCounty(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="County name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Video Evidence (optional)</label>
              <input 
                name="evidence_video" 
                type="file" 
                accept="video/*" 
                onChange={(e) => setVideoFile(e.target.files?.[0] || null)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary focus:border-transparent file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-white hover:file:bg-secondary"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Latitude</label>
              <input 
                name="latitude" 
                placeholder="Latitude" 
                type="number" 
                step="0.000001" 
                value={lat ?? ''} 
                onChange={(e) => { const v = e.target.value ? Math.round(Number(e.target.value) * 1e6) / 1e6 : undefined; setLat(v) }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Longitude</label>
              <input 
                name="longitude" 
                placeholder="Longitude" 
                type="number" 
                step="0.000001" 
                value={lon ?? ''} 
                onChange={(e) => { const v = e.target.value ? Math.round(Number(e.target.value) * 1e6) / 1e6 : undefined; setLon(v) }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button 
              type="button" 
              onClick={() => {
                if (!('geolocation' in navigator)) { showToast('Geolocation not supported', 'error'); return }
                navigator.geolocation.getCurrentPosition(
                  (pos) => { const la = Math.round(pos.coords.latitude * 1e6) / 1e6; const lo = Math.round(pos.coords.longitude * 1e6) / 1e6; setLat(la); setLon(lo); showToast('Location detected', 'success') },
                  () => showToast('Failed to detect location', 'error'),
                  { enableHighAccuracy: true, timeout: 8000 }
                )
              }}
              className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors font-medium"
            >
              Use my location
            </button>
            <button 
              type="button" 
              onClick={() => { setLat(undefined); setLon(undefined) }}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"
            >
              Clear location
            </button>
            <small className="text-gray-500">or click on the map to set position</small>
          </div>
          <div className="border border-gray-300 rounded-lg overflow-hidden" style={{ height: 300 }}>
            <MapContainer center={[lat ?? -1.286389, lon ?? 36.817223]} zoom={lat && lon ? 12 : 7} style={{ height: '100%', width: '100%' }}>
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OpenStreetMap contributors' />
              <ClickMarker lat={lat} lon={lon} onPick={(a, b) => { const ra = Math.round(a * 1e6) / 1e6; const rb = Math.round(b * 1e6) / 1e6; setLat(ra); setLon(rb) }} />
              {lat != null && lon != null && (
                <Marker position={[lat, lon]} icon={defaultMarkerIcon}>
                  <Popup>
                    <div>
                      <div><strong>County:</strong> {county || 'Detecting…'}</div>
                      <div className="text-xs text-gray-600">Lat: {lat.toFixed(6)}, Lon: {lon.toFixed(6)}</div>
                    </div>
                  </Popup>
                </Marker>
              )}
            </MapContainer>
          </div>
          {lat != null && lon != null && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-green-800">
              Detected county: {county ? county : 'Detecting…'}
            </div>
          )}
          <input name="honeypot" style={{ display: 'none' }} value={hp} onChange={(e) => setHp(e.target.value)} />
          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
            <label className="block text-sm font-medium text-gray-700 mb-2">Prove you're human <span className="text-red-500">*</span></label>
            <div className="flex items-center gap-3">
              <span className="text-lg font-bold">{ca} + {cb} =</span>
              <input 
                required 
                name="captcha_answer" 
                type="number" 
                value={ans ?? ''} 
                onChange={(e) => setAns(e.target.value ? Number(e.target.value) : undefined)}
                className="w-24 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="?"
              />
            </div>
          </div>
          <button 
            type="submit"
            disabled={status === 'sending'}
            className="px-6 py-3 bg-primary text-white rounded-md hover:bg-secondary transition-colors font-medium disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {status === 'sending' ? 'Submitting...' : 'Submit Report'}
          </button>
        </form>
      </div>
      {status === 'ok' ? (
        <div className="bg-green-50 border border-green-200 rounded-lg p-6">
          <div className="flex justify-between items-center">
            <div>
              <strong className="text-green-800 text-lg">Report submitted successfully!</strong>
              <p className="text-green-700 text-sm mt-1">Your report has been received and is being processed.</p>
            </div>
            <div className="flex gap-3">
              <a href="/welcome" className="px-4 py-2 bg-gray-800 text-white rounded-md hover:bg-gray-900 transition-colors text-decoration-none font-medium">Back to Home</a>
              <a href="/public/map" className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-decoration-none font-medium">View Map</a>
              <a href="/public/track" className="px-4 py-2 bg-gray-700 text-white rounded-md hover:bg-gray-800 transition-colors text-decoration-none font-medium">Track Case</a>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function ClickMarker({ onPick, lat, lon }: { onPick: (lat: number, lon: number) => void; lat?: number; lon?: number }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng)
    }
  })
  return null
}
