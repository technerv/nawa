import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, API_BASE_URL } from '../api/axios'
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { formatDate } from '../lib/dateFormat'
import { formatLocation } from '../lib/locationFormat'
import { showToast } from '../lib/toast'
import { useWebSocket } from '../hooks/useWebSocket'
import { getCrimeReport } from '../api/crime'
import { resolveMediaUrl } from '../lib/media'
import { me } from '../api/auth'
import { isSuperAdmin } from '../lib/roles'
import WebSocketViewer from '../components/WebSocketViewer'

type Alert = {
  id: number
  report_id?: number  // Optional, fallback to id
  severity: string
  status: string
  location_name?: string
  county?: string
  sub_county?: string
  latitude?: number
  longitude?: number
  created_at?: string
  date_created?: string
  acknowledged_at?: string
  assigned_to?: string
  category?: string
  category_of_crime_name?: string
  name_of_crime?: string
  description?: string
  occurance_book_number?: string
}

type IncidentStats = {
  total: number
  pending: number
  in_progress: number
  resolved: number
  avg_response_time?: number
  sla_compliance?: number
}

export default function SecurityDashboardPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null)
  const [filterSeverity, setFilterSeverity] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')

  // Fetch user profile to get organization info
  const { data: userProfile } = useQuery({
    queryKey: ['me'],
    queryFn: me,
  })

  // Build WebSocket URL based on user role and organization
  // SuperAdmin connects to /ws/alerts/ (all alerts)
  // Security Org Users connect to /ws/alerts/{org_id}/ (org-specific)
  const wsUrl = userProfile
    ? isSuperAdmin(userProfile.roles)
      ? `${API_BASE_URL.replace('/api', '')}/ws/alerts/`
      : userProfile.organization
      ? `${API_BASE_URL.replace('/api', '')}/ws/alerts/${userProfile.organization.id}/`
      : `${API_BASE_URL.replace('/api', '')}/ws/alerts/` // Fallback to all alerts
    : `${API_BASE_URL.replace('/api', '')}/ws/alerts/` // Default while loading

  const { isConnected: wsConnected, lastMessage: wsMessage } = useWebSocket(wsUrl, (message) => {
    if (message.type === 'alert' && message.data) {
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['security_alerts'] })
      queryClient.invalidateQueries({ queryKey: ['security_stats'] })
      
      // Show toast notification for new alerts
      if (message.data.type === 'new_report') {
        showToast(`New ${message.data.severity} alert: ${message.data.location || message.data.county}`, 'info')
      }
    }
  })

  // Fetch live alerts (org-specific)
  const { data: alerts, isLoading: alertsLoading } = useQuery({
    queryKey: ['security_alerts', { filterSeverity, filterStatus }],
    queryFn: async () => {
      const params: any = {}
      if (filterSeverity !== 'all') params.severity = filterSeverity
      if (filterStatus !== 'all') params.status = filterStatus
      const res = await api.get<{ results?: Alert[] } | Alert[]>('/crimereportbook/', { params })
      const data = res.data
      if (Array.isArray(data)) return data
      if (data && 'results' in data && Array.isArray(data.results)) return data.results
      return []
    },
    refetchInterval: wsConnected ? false : 10000, // Use WebSocket if connected, otherwise poll every 10 seconds
  })

  // Fetch incident statistics (org-specific)
  const { data: stats } = useQuery({
    queryKey: ['security_stats'],
    queryFn: async () => {
      const res = await api.get<IncidentStats>('/crimereportbook/stats/')
      return res.data
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  })

  // Acknowledge alert
  const acknowledgeMutation = useMutation({
    mutationFn: async (reportId: number) => {
      const res = await api.patch(`/crimereportbook/${reportId}/`, { 
        status: 'acknowledged',
        change_note: 'Alert acknowledged by security team'
      })
      return res.data
    },
    onSuccess: () => {
      showToast('Alert acknowledged', 'success')
      queryClient.invalidateQueries({ queryKey: ['security_alerts'] })
      queryClient.invalidateQueries({ queryKey: ['security_stats'] })
      setSelectedAlert(null) // Close detail view
    },
  })
  
  // State for report detail modal
  const [reportDetail, setReportDetail] = useState<any>(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
  
  // Fetch full report details
  const { data: fullReport, isLoading: reportLoading } = useQuery({
    queryKey: ['report_detail', reportDetail?.id],
    queryFn: async () => {
      if (!reportDetail?.id) return null
      const res = await api.get(`/crimereportbook/${reportDetail.id}/`)
      return res.data
    },
    enabled: !!reportDetail?.id,
  })

  // Assign responder
  const assignMutation = useMutation({
    mutationFn: async ({ alertId, responder }: { alertId: number; responder: string }) => {
      const res = await api.patch(`/crimereportbook/${alertId}/`, { assigned_to: responder })
      return res.data
    },
    onSuccess: () => {
      showToast('Responder assigned', 'success')
      queryClient.invalidateQueries({ queryKey: ['security_alerts'] })
    },
  })

  const getSeverityColor = (severity: string) => {
    const s = severity?.toLowerCase() || ''
    if (s === 'critical') return 'bg-violet-100 text-violet-800 border-violet-300'
    if (s === 'high') return 'bg-red-100 text-red-800 border-red-300'
    if (s === 'medium') return 'bg-amber-100 text-amber-800 border-amber-300'
    if (s === 'low') return 'bg-emerald-100 text-emerald-800 border-emerald-300'
    return 'bg-gray-100 text-gray-800 border-gray-300'
  }

  const getStatusColor = (status: string) => {
    const s = status?.toLowerCase() || ''
    if (s === 'resolved' || s === 'closed') return 'bg-green-100 text-green-800'
    if (s === 'in_progress' || s === 'acknowledged') return 'bg-blue-100 text-blue-800'
    if (s === 'pending' || s === 'submitted') return 'bg-yellow-100 text-yellow-800'
    return 'bg-gray-100 text-gray-800'
  }

  const criticalAlerts = alerts?.filter((a: Alert) => a.severity?.toLowerCase() === 'critical') || []
  const highAlerts = alerts?.filter((a: Alert) => a.severity?.toLowerCase() === 'high') || []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white rounded-lg shadow-lg p-6">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-3xl font-bold mb-2">Security Dashboard</h2>
            <p className="text-gray-100 text-sm">Real-time incident response and coordination</p>
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${wsConnected ? 'bg-green-400' : 'bg-red-400'}`} title={wsConnected ? 'WebSocket Connected' : 'WebSocket Disconnected'} />
            <span className="text-xs text-gray-200">{wsConnected ? 'Live' : 'Polling'}</span>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-md p-4 border-l-4 border-blue-500">
          <div className="text-sm font-medium text-gray-600 mb-1">Total Incidents</div>
          <div className="text-3xl font-bold text-gray-900">{stats?.total || 0}</div>
        </div>
        <div className="bg-white rounded-lg shadow-md p-4 border-l-4 border-yellow-500">
          <div className="text-sm font-medium text-gray-600 mb-1">Pending</div>
          <div className="text-3xl font-bold text-yellow-600">{stats?.pending || 0}</div>
        </div>
        <div className="bg-white rounded-lg shadow-md p-4 border-l-4 border-blue-500">
          <div className="text-sm font-medium text-gray-600 mb-1">In Progress</div>
          <div className="text-3xl font-bold text-blue-600">{stats?.in_progress || 0}</div>
        </div>
        <div className="bg-white rounded-lg shadow-md p-4 border-l-4 border-green-500">
          <div className="text-sm font-medium text-gray-600 mb-1">Resolved</div>
          <div className="text-3xl font-bold text-green-600">{stats?.resolved || 0}</div>
        </div>
      </div>

      {/* Performance Metrics */}
      {stats && (stats.avg_response_time !== undefined || stats.sla_compliance !== undefined) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {stats.avg_response_time !== undefined && (
            <div className="bg-white rounded-lg shadow-md p-4">
              <div className="text-sm font-medium text-gray-600 mb-1">Avg Response Time</div>
              <div className="text-2xl font-bold text-gray-900">
                {stats.avg_response_time ? `${stats.avg_response_time.toFixed(1)} min` : 'N/A'}
              </div>
            </div>
          )}
          {stats.sla_compliance !== undefined && (
            <div className="bg-white rounded-lg shadow-md p-4">
              <div className="text-sm font-medium text-gray-600 mb-1">SLA Compliance</div>
              <div className="text-2xl font-bold text-gray-900">
                {stats.sla_compliance ? `${stats.sla_compliance.toFixed(1)}%` : 'N/A'}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Priority Alerts Banner */}
      {(criticalAlerts.length > 0 || highAlerts.length > 0) && (
        <div className="bg-red-50 border-l-4 border-red-500 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-red-800 mb-1">Priority Alerts</h3>
              <p className="text-sm text-red-700">
                {criticalAlerts.length} Critical, {highAlerts.length} High priority incidents require immediate attention
              </p>
            </div>
            <button
              onClick={() => {
                setFilterSeverity('critical')
                setFilterStatus('all')
              }}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
            >
              View Critical
            </button>
          </div>
        </div>
      )}

      {/* Live Alerts Panel */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="p-4 bg-gray-50 border-b flex justify-between items-center">
          <h3 className="text-lg font-bold text-gray-800">Live Alerts</h3>
          <div className="flex gap-2">
            <select
              value={filterSeverity}
              onChange={(e) => setFilterSeverity(e.target.value)}
              className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-primary"
            >
              <option value="all">All Severities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-primary"
            >
              <option value="all">All Statuses</option>
              <option value="submitted">Submitted</option>
              <option value="acknowledged">Acknowledged</option>
              <option value="in_progress">In Progress</option>
              <option value="resolved">Resolved</option>
            </select>
          </div>
        </div>
        {alertsLoading ? (
          <div className="p-8 text-center text-gray-500">Loading alerts...</div>
        ) : !alerts || alerts.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No alerts found</div>
        ) : (
          <div className="divide-y">
            {alerts.map((alert: Alert) => (
              <div
                key={alert.id}
                className={`p-4 hover:bg-gray-50 transition-colors cursor-pointer ${
                  selectedAlert?.id === alert.id ? 'bg-blue-50 border-l-4 border-blue-500' : ''
                }`}
                onClick={() => setSelectedAlert(alert)}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`px-2 py-1 rounded text-xs font-medium border ${getSeverityColor(alert.severity)}`}>
                        {alert.severity?.toUpperCase() || 'UNKNOWN'}
                      </span>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(alert.status)}`}>
                        {alert.status?.replace('_', ' ').toUpperCase() || 'UNKNOWN'}
                      </span>
                      {alert.category && (
                        <span className="px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-700">
                          {alert.category}
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-gray-600 mb-1">
                      <strong>Location:</strong> {formatLocation(alert.location_name, alert.county, alert.sub_county, alert.latitude, alert.longitude) || 'N/A'}
                    </div>
                    <div className="text-xs text-gray-500">
                      <strong>Reported:</strong> {formatDate(alert.created_at || alert.date_created) || 'N/A'}
                      {alert.assigned_to && (
                        <> • <strong>Assigned to:</strong> {alert.assigned_to}</>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 ml-4">
                    {alert.status === 'submitted' && (
                      <button
                        onClick={async (e) => {
                          e.stopPropagation()
                          const reportId = alert.report_id || alert.id
                          acknowledgeMutation.mutate(reportId)
                        }}
                        className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 transition-colors"
                      >
                        Acknowledge
                      </button>
                    )}
                    <button
                      onClick={async (e) => {
                        e.stopPropagation()
                        const reportId = alert.report_id || alert.id
                        try {
                          const report = await getCrimeReport(reportId)
                          setReportDetail(report)
                          setShowDetailModal(true)
                        } catch (err: any) {
                          showToast('Failed to load report details', 'error')
                          console.error('Failed to load report:', err)
                        }
                      }}
                      className="px-3 py-1 bg-gray-600 text-white rounded text-sm hover:bg-gray-700 transition-colors"
                    >
                      View Details
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Incident Workspace (when alert selected) */}
      {selectedAlert && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex justify-between items-start mb-4">
            <h3 className="text-xl font-bold text-gray-800">Incident Workspace</h3>
            <button
              onClick={() => setSelectedAlert(null)}
              className="text-gray-500 hover:text-gray-700"
            >
              ✕
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-semibold text-gray-700 mb-2">Incident Details</h4>
              <div className="space-y-2 text-sm">
                <div><strong>Report ID:</strong> {selectedAlert.report_id || selectedAlert.id}</div>
                <div><strong>OB Number:</strong> {selectedAlert.occurance_book_number || 'N/A'}</div>
                <div><strong>Crime:</strong> {selectedAlert.name_of_crime || 'N/A'}</div>
                <div><strong>Severity:</strong> <span className={getSeverityColor(selectedAlert.severity) + ' px-2 py-1 rounded'}>{selectedAlert.severity || 'N/A'}</span></div>
                <div><strong>Status:</strong> <span className={getStatusColor(selectedAlert.status) + ' px-2 py-1 rounded'}>{selectedAlert.status || 'N/A'}</span></div>
                <div><strong>Location:</strong> {formatLocation(selectedAlert.location_name, selectedAlert.county, selectedAlert.sub_county, selectedAlert.latitude, selectedAlert.longitude) || 'N/A'}</div>
                <div><strong>Reported:</strong> {formatDate(selectedAlert.created_at || selectedAlert.date_created) || 'N/A'}</div>
                {selectedAlert.assigned_to && (
                  <div><strong>Assigned to:</strong> {selectedAlert.assigned_to}</div>
                )}
                {selectedAlert.description && (
                  <div className="mt-2">
                    <strong>Description:</strong>
                    <p className="text-sm text-gray-600 mt-1">{selectedAlert.description}</p>
                  </div>
                )}
              </div>
            </div>
            <div>
              <h4 className="font-semibold text-gray-700 mb-2">Actions</h4>
              <div className="space-y-2">
                <button
                  onClick={() => navigate(`/map?report=${selectedAlert.report_id}`)}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                >
                  View on Map
                </button>
                <button
                  onClick={() => navigate(`/reports?id=${selectedAlert.report_id}`)}
                  className="w-full px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
                >
                  View Full Report
                </button>
                {selectedAlert.status === 'submitted' && (
                  <button
                    onClick={() => {
                      const reportId = selectedAlert.report_id || selectedAlert.id
                      acknowledgeMutation.mutate(reportId)
                    }}
                    className="w-full px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                  >
                    Acknowledge Incident
                  </button>
                )}
                <button
                  onClick={async () => {
                    const reportId = selectedAlert.report_id || selectedAlert.id
                    try {
                      const report = await getCrimeReport(reportId)
                      setReportDetail(report)
                      setShowDetailModal(true)
                    } catch (err: any) {
                      showToast('Failed to load report details', 'error')
                    }
                  }}
                  className="w-full px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors"
                >
                  View Full Details
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Report Detail Modal */}
      {showDetailModal && fullReport && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b p-4 flex justify-between items-center">
              <h3 className="text-2xl font-bold text-gray-800">Report Details</h3>
              <button
                onClick={() => {
                  setShowDetailModal(false)
                  setReportDetail(null)
                }}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ✕
              </button>
            </div>
            <div className="p-6 space-y-6">
              {/* Header Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">OB Number</label>
                  <div className="text-lg font-mono font-bold">{fullReport.occurance_book_number || 'N/A'}</div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Report ID</label>
                  <div className="text-lg font-bold">{fullReport.id}</div>
                </div>
              </div>

              {/* Crime Details */}
              <div>
                <h4 className="font-semibold text-gray-700 mb-2">Crime Information</h4>
                <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                  <div><strong>Crime Name:</strong> {fullReport.name_of_crime || 'N/A'}</div>
                  <div><strong>Category:</strong> {fullReport.category_of_crime_name || 'N/A'}</div>
                  <div><strong>Severity:</strong> <span className={getSeverityColor((fullReport as any).severity || 'medium') + ' px-2 py-1 rounded'}>{(fullReport as any).severity || 'medium'}</span></div>
                  <div><strong>Status:</strong> <span className={getStatusColor((fullReport as any).status || 'submitted') + ' px-2 py-1 rounded'}>{(fullReport as any).status || 'submitted'}</span></div>
                  {fullReport.description && (
                    <div>
                      <strong>Description:</strong>
                      <p className="mt-1 text-gray-700">{fullReport.description}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Location Details */}
              <div>
                <h4 className="font-semibold text-gray-700 mb-2">Location</h4>
                <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                  <div><strong>Location:</strong> {formatLocation(fullReport.location_name, fullReport.county, undefined, fullReport.latitude, fullReport.longitude) || 'N/A'}</div>
                  {fullReport.location_description && (
                    <div><strong>Description:</strong> {fullReport.location_description}</div>
                  )}
                  {fullReport.latitude && fullReport.longitude && (
                    <div className="text-sm text-gray-600">
                      <strong>Coordinates:</strong> {fullReport.latitude}, {fullReport.longitude}
                    </div>
                  )}
                </div>
              </div>

              {/* Criminal Details */}
              {(fullReport.name_of_criminal || fullReport.age || fullReport.criminal_id_number) && (
                <div>
                  <h4 className="font-semibold text-gray-700 mb-2">Suspect Information</h4>
                  <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                    {fullReport.name_of_criminal && (
                      <div><strong>Name:</strong> {fullReport.name_of_criminal}</div>
                    )}
                    {fullReport.age && (
                      <div><strong>Age:</strong> {fullReport.age}</div>
                    )}
                    {fullReport.criminal_id_number && (
                      <div><strong>ID Number:</strong> {fullReport.criminal_id_number}</div>
                    )}
                    {fullReport.upload_criminal_photo && (
                      <div>
                        <strong>Photo:</strong>
                        <img
                          src={resolveMediaUrl(fullReport.upload_criminal_photo) as string}
                          alt="Suspect"
                          className="mt-2 w-32 h-32 object-cover rounded border"
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Dates */}
              <div>
                <h4 className="font-semibold text-gray-700 mb-2">Timeline</h4>
                <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                  <div><strong>Created:</strong> {formatDate(fullReport.date_created) || 'N/A'}</div>
                  <div><strong>Updated:</strong> {formatDate(fullReport.date_updated) || 'N/A'}</div>
                  {fullReport.date_of_arrest && (
                    <div><strong>Date of Arrest:</strong> {fullReport.date_of_arrest}</div>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-4 border-t">
                {(fullReport as any).status === 'submitted' && (
                  <button
                    onClick={() => {
                      acknowledgeMutation.mutate(fullReport.id)
                      setShowDetailModal(false)
                    }}
                    className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                  >
                    Acknowledge Report
                  </button>
                )}
                <button
                  onClick={() => navigate(`/map?report=${fullReport.id}`)}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                >
                  View on Map
                </button>
                <button
                  onClick={() => {
                    setShowDetailModal(false)
                    setReportDetail(null)
                  }}
                  className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-bold text-gray-800 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            onClick={() => navigate('/reports')}
            className="p-4 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors text-left"
          >
            <div className="font-semibold text-blue-900 mb-1">View All Reports</div>
            <div className="text-sm text-blue-700">Browse and filter all incidents</div>
          </button>
          <button
            onClick={() => navigate('/map')}
            className="p-4 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition-colors text-left"
          >
            <div className="font-semibold text-green-900 mb-1">Map View</div>
            <div className="text-sm text-green-700">Geospatial incident visualization</div>
          </button>
          <button
            onClick={() => navigate('/reports/create')}
            className="p-4 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 transition-colors text-left"
          >
            <div className="font-semibold text-purple-900 mb-1">Create Report</div>
            <div className="text-sm text-purple-700">Log a new incident</div>
          </button>
        </div>
      </div>

      {/* WebSocket / Live Updates Viewer */}
      <WebSocketViewer enabled={true} />
    </div>
  )
}

