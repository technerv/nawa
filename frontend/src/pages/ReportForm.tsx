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
    <div>
      <div className="row" style={{ alignItems: 'center', justifyContent: 'space-between' }}>
        <h2>Report Incident (Anonymous)</h2>
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
        {errorMsg && (
          <div style={{ background: '#fdecec', border: '1px solid #f5c2c7', color: '#842029', padding: 8, borderRadius: 6, marginBottom: 8 }}>
            {errorMsg}
          </div>
        )}
        <label>Name of Crime</label>
        <input required name="name_of_crime" value={name} onChange={(e) => setName(e.target.value)} />
        <label>Category</label>
        <select required name="category_of_crime" value={categoryId ?? ''} onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : undefined)}>
          <option value="">Select category</option>
          {cats.data?.results.map((c) => (
            <option key={c.id} value={c.id}>{c.crime_category} ({c.crime_short_code})</option>
          ))}
        </select>
        <label>Description</label>
        <textarea name="description" value={desc} onChange={(e) => setDesc(e.target.value)} />
        <label>Video Evidence (optional)</label>
        <input name="evidence_video" type="file" accept="video/*" onChange={(e) => setVideoFile(e.target.files?.[0] || null)} />
        <label>County</label>
        <input name="county" value={county} onChange={(e) => setCounty(e.target.value)} />
        <div style={{ display: 'grid', gap: 8 }}>
          <input name="latitude" style={{ width: '100%' }} placeholder="Latitude" type="number" step="0.000001" value={lat ?? ''} onChange={(e) => { const v = e.target.value ? Math.round(Number(e.target.value) * 1e6) / 1e6 : undefined; setLat(v) }} />
          <input name="longitude" style={{ width: '100%' }} placeholder="Longitude" type="number" step="0.000001" value={lon ?? ''} onChange={(e) => { const v = e.target.value ? Math.round(Number(e.target.value) * 1e6) / 1e6 : undefined; setLon(v) }} />
        </div>
        <div style={{ display: 'grid', gap: 8, alignItems: 'start', marginBottom: 8 }}>
          <button type="button" onClick={() => {
            if (!('geolocation' in navigator)) { showToast('Geolocation not supported', 'error'); return }
            navigator.geolocation.getCurrentPosition(
              (pos) => { const la = Math.round(pos.coords.latitude * 1e6) / 1e6; const lo = Math.round(pos.coords.longitude * 1e6) / 1e6; setLat(la); setLon(lo); showToast('Location detected', 'success') },
              () => showToast('Failed to detect location', 'error'),
              { enableHighAccuracy: true, timeout: 8000 }
            )
          }}>Use my location</button>
          <button type="button" onClick={() => { setLat(undefined); setLon(undefined) }}>Clear location</button>
        </div>
        <div style={{ height: 300, width: '100%', border: '1px solid #ccc', borderRadius: 8, overflow: 'hidden', marginBottom: 12 }}>
          <MapContainer center={[lat ?? -1.286389, lon ?? 36.817223]} zoom={lat && lon ? 12 : 7} style={{ height: '100%', width: '100%' }}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OpenStreetMap contributors' />
            <ClickMarker lat={lat} lon={lon} onPick={(a, b) => { const ra = Math.round(a * 1e6) / 1e6; const rb = Math.round(b * 1e6) / 1e6; setLat(ra); setLon(rb) }} />
            {lat != null && lon != null && (
              <Marker position={[lat, lon]} icon={defaultMarkerIcon}>
                <Popup>
                  <div>
                    <div><strong>County:</strong> {county || 'Detecting…'}</div>
                    <div style={{ fontSize: 12, color: '#666' }}>Lat: {lat.toFixed(6)}, Lon: {lon.toFixed(6)}</div>
                  </div>
                </Popup>
              </Marker>
            )}
          </MapContainer>
        </div>
        {lat != null && lon != null && (
          <div style={{ marginBottom: 8, color: '#2d6a4f', background: '#eef9f1', border: '1px solid #cdeccd', borderRadius: 6, padding: 8 }}>
            Detected county: {county ? county : 'Detecting…'}
          </div>
        )}
        <input name="honeypot" style={{ display: 'none' }} value={hp} onChange={(e) => setHp(e.target.value)} />
        <div style={{ display: 'grid', gap: 8 }}>
          <span>Prove you're human:</span>
          <span>{ca} + {cb} =</span>
          <input required name="captcha_answer" type="number" value={ans ?? ''} onChange={(e) => setAns(e.target.value ? Number(e.target.value) : undefined)} />
        </div>
        <button type="submit">Submit</button>
      </form>
      {status === 'ok' ? (
        <div className="card" style={{ marginTop: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <strong>Report submitted</strong>
            <div style={{ display: 'inline-flex', gap: 8 }}>
              <a href="/welcome" style={{ padding: '6px 10px', background: '#0f172a', color: 'white', borderRadius: 6, textDecoration: 'none' }}>Back to Home</a>
              <a href="/public/map" style={{ padding: '6px 10px', background: '#2563eb', color: 'white', borderRadius: 6, textDecoration: 'none' }}>View Map</a>
              <a href="/public/track" style={{ padding: '6px 10px', background: '#1f2937', color: 'white', borderRadius: 6, textDecoration: 'none' }}>Track Case</a>
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
