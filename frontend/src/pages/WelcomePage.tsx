import { Link } from 'react-router-dom'

export default function WelcomePage() {
  return (
    <div style={{ minHeight: '60vh', display: 'grid', placeItems: 'center', padding: '40px 16px' }}>
      <div style={{ maxWidth: 900, width: '100%', textAlign: 'center' }}>
        <div style={{
          background: 'linear-gradient(135deg, #0ea5e9 0%, #7c3aed 50%, #ef4444 100%)',
          WebkitBackgroundClip: 'text',
          backgroundClip: 'text',
          color: 'transparent',
          fontSize: 48,
          fontWeight: 800,
          lineHeight: 1.1,
          marginBottom: 12
        }}>
          Neighbourhood Alert Watch
        </div>
        <div style={{ fontSize: 18, color: '#64748b', marginBottom: 24 }}>
          See incidents around you, connect with neighbors, and stay safe.
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 24 }}>
          <Link to="/public/dashboard" style={{ padding: '10px 16px', background: '#0ea5e9', color: 'white', borderRadius: 10, textDecoration: 'none', fontWeight: 700 }}>Public Dashboard</Link>
          <Link to="/public/map" style={{ padding: '10px 16px', background: '#7c3aed', color: 'white', borderRadius: 10, textDecoration: 'none', fontWeight: 700 }}>Public Map</Link>
          <Link to="/public/report" style={{ padding: '10px 16px', background: '#ef4444', color: 'white', borderRadius: 10, textDecoration: 'none', fontWeight: 700 }}>Report Incident</Link>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12, marginTop: 24 }}>
          <div className="card" style={{ padding: 16 }}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>Real-time Map</div>
            <div style={{ color: '#64748b' }}>Explore incidents by severity and location.</div>
          </div>
          <div className="card" style={{ padding: 16 }}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>Neighborhoods</div>
            <div style={{ color: '#64748b' }}>Join local groups to receive targeted alerts.</div>
          </div>
          <div className="card" style={{ padding: 16 }}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>Emergency SOS</div>
            <div style={{ color: '#64748b' }}>Send critical alerts with your location when needed.</div>
          </div>
        </div>
        <div style={{ marginTop: 40, color: '#94a3b8', fontSize: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>© {new Date().getFullYear()} NAWA</span>
          <Link to="/login" style={{ color: '#64748b', textDecoration: 'none' }}>Admin Login</Link>
        </div>
      </div>
    </div>
  )
}
