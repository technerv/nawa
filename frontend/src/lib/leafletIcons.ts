import L from 'leaflet'
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'

// Fix for default icon paths
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
	iconUrl: markerIcon,
	iconRetinaUrl: markerIcon2x,
	shadowUrl: markerShadow,
})

export const defaultMarkerIcon = L.icon({
	iconUrl: markerIcon,
	iconRetinaUrl: markerIcon2x,
	shadowUrl: markerShadow,
	iconSize: [25, 41],
	iconAnchor: [12, 41],
	popupAnchor: [1, -34],
	shadowSize: [41, 41]
})

// Severity color mapping
export const getSeverityColor = (severity: string): string => {
	const s = String(severity || '').toLowerCase()
	if (s === 'low') return '#10b981' // emerald-500
	if (s === 'medium') return '#f59e0b' // amber-500
	if (s === 'high') return '#ef4444' // red-500
	if (s === 'critical') return '#7c3aed' // violet-500
	return '#2563eb' // blue-500 (default)
}

// Create severity-based marker icon
export const createSeverityIcon = (severity: string): L.DivIcon => {
	const color = getSeverityColor(severity)
	return L.divIcon({
		className: 'leaflet-div-icon severity-marker',
		html: `
			<div style="
				width: 20px;
				height: 20px;
				background-color: ${color};
				border: 3px solid white;
				border-radius: 50%;
				box-shadow: 0 2px 8px rgba(0,0,0,0.3);
				position: relative;
			">
				<div style="
					position: absolute;
					top: 50%;
					left: 50%;
					transform: translate(-50%, -50%);
					width: 8px;
					height: 8px;
					background-color: white;
					border-radius: 50%;
				"></div>
			</div>
		`,
		iconSize: [20, 20],
		iconAnchor: [10, 10],
		popupAnchor: [0, -10]
	})
}

