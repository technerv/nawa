import { useQuery } from '@tanstack/react-query'
import { api } from '../api/axios'
import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { formatDate } from '../lib/dateFormat'
import { normalizeCountyName } from '../lib/normalizeCounty'
import { SeverityDistributionChart, ResponseTimeChart, SLAComplianceChart } from '../components/AnalyticsCharts'
import WebSocketViewer from '../components/WebSocketViewer'

type GlobalStats = {
  total_reports: number
  total_organizations: number
  active_incidents: number
  false_reports: number
  avg_response_time: number
  system_health: number
}

type TriageRule = {
  id: number
  name: string
  enabled: boolean
  threshold: number
  county?: string
}

type OrgPerformance = {
  id: number
  name: string
  type: string
  incidents_handled: number
  avg_response_time: number
  sla_compliance: number
  is_active: boolean
}

export default function SuperAdminDashboardPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  
  // Get model type from URL query parameter, with mapping for button navigation
  const getModelFromQuery = () => {
    const type = searchParams.get('type')
    if (!type) return 'severity'
    
    // Map URL query params to internal model names
    const mapping: Record<string, string> = {
      'performance': 'performance',
      'false_reports': 'false_detection',
      'monetization': 'monetization',
      'hotspots': 'hotspot',
    }
    return mapping[type] || type
  }
  
  const [selectedModel, setSelectedModel] = useState<string>(getModelFromQuery())
  const [dateFrom, setDateFrom] = useState<string>('')
  const [dateTo, setDateTo] = useState<string>('')
  
  // Update selected model when URL query changes
  useEffect(() => {
    const modelFromQuery = getModelFromQuery()
    setSelectedModel(modelFromQuery)
  }, [searchParams])

  // Global incident monitor
  const { data: globalStats } = useQuery({
    queryKey: ['superadmin_global_stats'],
    queryFn: async () => {
      const res = await api.get<GlobalStats>('/admin/global_stats/')
      return res.data
    },
  })

  // Triage rules
  const { data: triageRules } = useQuery({
    queryKey: ['superadmin_triage_rules'],
    queryFn: async () => {
      const res = await api.get<TriageRule[]>('/admin/triage_rules/')
      return res.data
    },
  })

  // Organization performance
  const { data: orgPerformance } = useQuery({
    queryKey: ['superadmin_org_performance'],
    queryFn: async () => {
      const res = await api.get<OrgPerformance[]>('/admin/org_performance/')
      return res.data
    },
  })

  // Recent incidents
  const { data: recentIncidents } = useQuery({
    queryKey: ['superadmin_recent_incidents'],
    queryFn: async () => {
      const res = await api.get<{ results?: any[] } | any[]>('/crimereportbook/', { params: { ordering: '-date_created', limit: 10 } })
      const data = res.data
      if (Array.isArray(data)) return data
      if (data && 'results' in data && Array.isArray(data.results)) return data.results
      return []
    },
  })

  // Analytics data for different models
  const { data: analyticsData } = useQuery({
    queryKey: ['superadmin_analytics', selectedModel, dateFrom, dateTo],
    queryFn: async () => {
      const params: any = { model: selectedModel }
      if (dateFrom) params.date_from = dateFrom
      if (dateTo) params.date_to = dateTo
      const res = await api.get('/admin/analytics/', { params })
      return res.data
    },
    enabled: ['false_detection', 'hotspot', 'monetization'].includes(selectedModel),
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-indigo-800 text-white rounded-lg shadow-lg p-6">
        <h2 className="text-3xl font-bold mb-2">Super Admin Dashboard</h2>
        <p className="text-gray-100 text-sm">System-wide governance, analytics, and control</p>
      </div>

      {/* Global Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="bg-white rounded-lg shadow-md p-4 border-l-4 border-blue-500">
          <div className="text-sm font-medium text-gray-600 mb-1">Total Reports</div>
          <div className="text-2xl font-bold text-gray-900">{globalStats?.total_reports || 0}</div>
        </div>
        <div className="bg-white rounded-lg shadow-md p-4 border-l-4 border-green-500">
          <div className="text-sm font-medium text-gray-600 mb-1">Organizations</div>
          <div className="text-2xl font-bold text-gray-900">{globalStats?.total_organizations || 0}</div>
        </div>
        <div className="bg-white rounded-lg shadow-md p-4 border-l-4 border-yellow-500">
          <div className="text-sm font-medium text-gray-600 mb-1">Active Incidents</div>
          <div className="text-2xl font-bold text-yellow-600">{globalStats?.active_incidents || 0}</div>
        </div>
        <div className="bg-white rounded-lg shadow-md p-4 border-l-4 border-red-500">
          <div className="text-sm font-medium text-gray-600 mb-1">False Reports</div>
          <div className="text-2xl font-bold text-red-600">{globalStats?.false_reports || 0}</div>
        </div>
        <div className="bg-white rounded-lg shadow-md p-4 border-l-4 border-purple-500">
          <div className="text-sm font-medium text-gray-600 mb-1">Avg Response</div>
          <div className="text-2xl font-bold text-gray-900">
            {globalStats?.avg_response_time ? `${globalStats.avg_response_time.toFixed(1)}m` : 'N/A'}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-md p-4 border-l-4 border-indigo-500">
          <div className="text-sm font-medium text-gray-600 mb-1">System Health</div>
          <div className="text-2xl font-bold text-gray-900">
            {globalStats?.system_health ? `${globalStats.system_health}%` : 'N/A'}
          </div>
        </div>
      </div>

      {/* Model Comparison Toggle */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-bold text-gray-800 mb-4">Analytics Models</h3>
        <div className="flex gap-2 flex-wrap mb-4">
          {['severity', 'false_detection', 'hotspot', 'performance', 'monetization'].map((model) => (
            <button
              key={model}
              onClick={() => setSelectedModel(model)}
              className={`px-4 py-2 rounded-md transition-colors ${
                selectedModel === model
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {model.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
            </button>
          ))}
        </div>
        
        {/* Charts based on selected model */}
        {selectedModel === 'severity' && (
          <div className="mt-4">
            <h4 className="font-semibold text-gray-700 mb-3">Severity Distribution</h4>
            <SeverityDistributionChart
              data={[
                { name: 'Low', value: 45 },
                { name: 'Medium', value: 30 },
                { name: 'High', value: 20 },
                { name: 'Critical', value: 5 },
              ]}
            />
          </div>
        )}
        
        {selectedModel === 'performance' && orgPerformance && orgPerformance.length > 0 && (
          <div className="mt-4 space-y-6">
            <div>
              <h4 className="font-semibold text-gray-700 mb-3">Average Response Time by Organization</h4>
              <ResponseTimeChart
                data={orgPerformance.map(org => ({
                  org: org.name.length > 15 ? org.name.substring(0, 15) + '...' : org.name,
                  avgTime: org.avg_response_time,
                }))}
              />
            </div>
            <div>
              <h4 className="font-semibold text-gray-700 mb-3">SLA Compliance by Organization</h4>
              <SLAComplianceChart
                data={orgPerformance.map(org => ({
                  org: org.name.length > 15 ? org.name.substring(0, 15) + '...' : org.name,
                  compliance: org.sla_compliance,
                }))}
              />
            </div>
          </div>
        )}
        
        {selectedModel === 'false_detection' && analyticsData && (
          <div className="mt-4 space-y-4">
            <div>
              <h4 className="font-semibold text-gray-700 mb-3">False Report Detection Analysis</h4>
              {analyticsData.summary && (
                <div className="mb-4 grid grid-cols-2 gap-4">
                  <div className="bg-blue-50 p-3 rounded">
                    <div className="text-sm text-gray-600">Total Analyzed</div>
                    <div className="text-2xl font-bold">{analyticsData.summary.total_analyzed || 0}</div>
                  </div>
                  <div className="bg-red-50 p-3 rounded">
                    <div className="text-sm text-gray-600">High Risk Reports</div>
                    <div className="text-2xl font-bold">{analyticsData.summary.high_risk || 0}</div>
                  </div>
                </div>
              )}
              {analyticsData.data && analyticsData.data.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">OB Number</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Suspicious Score</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Location</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {analyticsData.data.slice(0, 20).map((item: any) => (
                        <tr key={item.report_id} className="hover:bg-gray-50">
                          <td className="px-4 py-2 text-sm font-mono">{item.ob_number}</td>
                          <td className="px-4 py-2 text-sm">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              item.suspicious_score > 70 ? 'bg-red-100 text-red-800' :
                              item.suspicious_score > 50 ? 'bg-yellow-100 text-yellow-800' :
                              'bg-green-100 text-green-800'
                            }`}>
                              {item.suspicious_score}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-sm">{item.location || 'N/A'}</td>
                          <td className="px-4 py-2 text-sm">{item.date ? formatDate(item.date) : 'N/A'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-gray-500">No suspicious reports found.</p>
              )}
            </div>
          </div>
        )}

        {selectedModel === 'hotspot' && analyticsData && (
          <div className="mt-4 space-y-4">
            <div>
              <h4 className="font-semibold text-gray-700 mb-3">Hotspot Prediction Analysis</h4>
              {analyticsData.summary && (
                <div className="mb-4 grid grid-cols-2 gap-4">
                  <div className="bg-blue-50 p-3 rounded">
                    <div className="text-sm text-gray-600">Total Hotspots</div>
                    <div className="text-2xl font-bold">{analyticsData.summary.total_hotspots || 0}</div>
                  </div>
                  {analyticsData.summary.top_hotspot && (
                    <div className="bg-green-50 p-3 rounded">
                      <div className="text-sm text-gray-600">Top Hotspot</div>
                      <div className="text-lg font-bold">{analyticsData.summary.top_hotspot.location_name || analyticsData.summary.top_hotspot.county}</div>
                      <div className="text-xs text-gray-500">{analyticsData.summary.top_hotspot.count} incidents</div>
                    </div>
                  )}
                </div>
              )}
              {analyticsData.data && analyticsData.data.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Location</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">County</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Incident Count</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {analyticsData.data.map((item: any, idx: number) => (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="px-4 py-2 text-sm">{item.location_name || 'N/A'}</td>
                          <td className="px-4 py-2 text-sm">{item.county || 'N/A'}</td>
                          <td className="px-4 py-2 text-sm font-bold">{item.count || 0}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-gray-500">No hotspots found.</p>
              )}
            </div>
          </div>
        )}

        {selectedModel === 'monetization' && analyticsData && (
          <div className="mt-4 space-y-4">
            <div>
              <h4 className="font-semibold text-gray-700 mb-3">Monetization Insights</h4>
              {analyticsData.summary && (
                <div className="mb-4 grid grid-cols-3 gap-4">
                  <div className="bg-blue-50 p-3 rounded">
                    <div className="text-sm text-gray-600">Total Organizations</div>
                    <div className="text-2xl font-bold">{analyticsData.summary.total_orgs || 0}</div>
                  </div>
                  <div className="bg-green-50 p-3 rounded">
                    <div className="text-sm text-gray-600">Total Revenue</div>
                    <div className="text-2xl font-bold">${(analyticsData.summary.total_revenue || 0).toLocaleString()}</div>
                  </div>
                  <div className="bg-red-50 p-3 rounded">
                    <div className="text-sm text-gray-600">Total Cost</div>
                    <div className="text-2xl font-bold">${(analyticsData.summary.total_cost || 0).toLocaleString()}</div>
                  </div>
                </div>
              )}
              {analyticsData.data && analyticsData.data.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Organization</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Incidents Handled</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Cost per Incident</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Total Cost</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Revenue</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">ROI</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {analyticsData.data.map((item: any) => (
                        <tr key={item.org_id} className="hover:bg-gray-50">
                          <td className="px-4 py-2 text-sm font-medium">{item.org_name}</td>
                          <td className="px-4 py-2 text-sm">{item.incidents_handled || 0}</td>
                          <td className="px-4 py-2 text-sm">${item.cost_per_incident?.toFixed(2) || '0.00'}</td>
                          <td className="px-4 py-2 text-sm">${(item.total_cost || 0).toLocaleString()}</td>
                          <td className="px-4 py-2 text-sm">${(item.revenue || 0).toLocaleString()}</td>
                          <td className="px-4 py-2 text-sm">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              item.roi > 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                            }`}>
                              {item.roi?.toFixed(2) || '0.00'}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-gray-500">No monetization data available.</p>
              )}
            </div>
          </div>
        )}

        {!['severity', 'performance', 'false_detection', 'hotspot', 'monetization'].includes(selectedModel) && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600">
              <strong>Selected Model:</strong> {selectedModel.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Model insights and comparisons will be displayed here. This is where multiple AI/ML models can be compared and analyzed.
            </p>
          </div>
        )}
      </div>

      {/* Global Incident Monitor */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="p-4 bg-gray-50 border-b flex justify-between items-center">
          <h3 className="text-lg font-bold text-gray-800">Global Incident Monitor</h3>
          <button
            onClick={() => navigate('/reports')}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm"
          >
            View All Reports
          </button>
        </div>
        {recentIncidents && recentIncidents.length > 0 ? (
          <div className="divide-y">
            {recentIncidents.map((incident: any) => (
              <div
                key={incident.id}
                className="p-4 hover:bg-gray-50 transition-colors cursor-pointer"
                onClick={() => navigate(`/reports?id=${incident.id}`)}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        incident.severity === 'critical' ? 'bg-violet-100 text-violet-800' :
                        incident.severity === 'high' ? 'bg-red-100 text-red-800' :
                        incident.severity === 'medium' ? 'bg-amber-100 text-amber-800' :
                        'bg-emerald-100 text-emerald-800'
                      }`}>
                        {incident.severity?.toUpperCase() || 'UNKNOWN'}
                      </span>
                      <span className="px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-700">
                        {incident.status?.replace('_', ' ').toUpperCase() || 'UNKNOWN'}
                      </span>
                      {incident.county && (
                        <span className="px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-700">
                          {normalizeCountyName(incident.county)}
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-gray-800 font-medium mb-1">{incident.name_of_crime}</div>
                    <div className="text-xs text-gray-500">
                      {formatDate(incident.date_created)} • OB: {incident.occurance_book_number}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center text-gray-500">No recent incidents</div>
        )}
      </div>

      {/* Triage & Scoring Engine Control */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-gray-800">Triage & Scoring Engine Control</h3>
          <button
            onClick={() => navigate('/admin/triage')}
            className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors text-sm"
          >
            Manage Rules
          </button>
        </div>
        {triageRules && triageRules.length > 0 ? (
          <div className="space-y-2">
            {triageRules.map((rule) => (
              <div key={rule.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <div className="font-medium text-gray-800">{rule.name}</div>
                  <div className="text-sm text-gray-600">
                    Threshold: {rule.threshold} {rule.county && `• County: ${rule.county}`}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`px-3 py-1 rounded text-sm ${rule.enabled ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {rule.enabled ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center text-gray-500 py-4">No triage rules configured</div>
        )}
      </div>

      {/* Security Org Management */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-gray-800">Security Organization Performance</h3>
          <button
            onClick={() => navigate('/admin/users')}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors text-sm"
          >
            Manage Organizations
          </button>
        </div>
        {orgPerformance && orgPerformance.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left table-bordered">
              <thead>
                <tr>
                  <th>Organization</th>
                  <th>Type</th>
                  <th>Incidents Handled</th>
                  <th>Avg Response Time</th>
                  <th>SLA Compliance</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {orgPerformance.map((org) => (
                  <tr key={org.id} className="hover:bg-gray-50">
                    <td className="font-medium">{org.name}</td>
                    <td className="capitalize">{org.type.replace('_', ' ')}</td>
                    <td className="text-center">{org.incidents_handled}</td>
                    <td className="text-center">{org.avg_response_time.toFixed(1)}m</td>
                    <td className="text-center">
                      <span className={`px-2 py-1 rounded text-xs ${
                        org.sla_compliance >= 90 ? 'bg-green-100 text-green-800' :
                        org.sla_compliance >= 70 ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {org.sla_compliance.toFixed(1)}%
                      </span>
                    </td>
                    <td>
                      <span className={`px-2 py-1 rounded text-xs ${
                        org.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {org.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center text-gray-500 py-4">No organizations found</div>
        )}
      </div>

      {/* Advanced Analytics */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-bold text-gray-800 mb-4">Advanced Analytics & Insights</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h4 className="font-semibold text-blue-900 mb-2">Hotspot Prediction</h4>
            <p className="text-sm text-blue-700">
              Spatio-temporal clustering analysis showing predicted risk zones based on historical patterns.
            </p>
            <button
              onClick={() => navigate('/map?view=hotspots')}
              className="mt-2 px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
            >
              View Hotspots
            </button>
          </div>
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
            <h4 className="font-semibold text-green-900 mb-2">Response Performance</h4>
            <p className="text-sm text-green-700">
              SLA adherence metrics and organization performance scoring across all security orgs.
            </p>
            <button
              onClick={() => navigate('/admin/analytics?type=performance')}
              className="mt-2 px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
            >
              View Analytics
            </button>
          </div>
          <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
            <h4 className="font-semibold text-purple-900 mb-2">False Report Detection</h4>
            <p className="text-sm text-purple-700">
              Pattern analysis and device/IP behavior tracking to identify and flag suspicious reports.
            </p>
            <button
              onClick={() => navigate('/admin/analytics?type=false_reports')}
              className="mt-2 px-3 py-1 bg-purple-600 text-white rounded text-sm hover:bg-purple-700"
            >
              View Detection
            </button>
          </div>
          <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
            <h4 className="font-semibold text-orange-900 mb-2">Monetization Insights</h4>
            <p className="text-sm text-orange-700">
              Cost per incident, revenue per organization, and ROI analysis per county.
            </p>
            <button
              onClick={() => navigate('/admin/analytics?type=monetization')}
              className="mt-2 px-3 py-1 bg-orange-600 text-white rounded text-sm hover:bg-orange-700"
            >
              View Insights
            </button>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-bold text-gray-800 mb-4">System Management</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <button
            onClick={() => navigate('/admin/users')}
            className="p-4 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors text-left"
          >
            <div className="font-semibold text-blue-900 mb-1">Manage Users</div>
            <div className="text-sm text-blue-700">Create and manage Security Org Users</div>
          </button>
          <button
            onClick={() => navigate('/admin/alerts')}
            className="p-4 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition-colors text-left"
          >
            <div className="font-semibold text-green-900 mb-1">Alert Configuration</div>
            <div className="text-sm text-green-700">Configure alert rules and notifications</div>
          </button>
          <button
            onClick={() => navigate('/categories')}
            className="p-4 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 transition-colors text-left"
          >
            <div className="font-semibold text-purple-900 mb-1">Crime Categories</div>
            <div className="text-sm text-purple-700">Manage crime category definitions</div>
          </button>
          <button
            onClick={() => navigate('/reports')}
            className="p-4 bg-orange-50 border border-orange-200 rounded-lg hover:bg-orange-100 transition-colors text-left"
          >
            <div className="font-semibold text-orange-900 mb-1">All Reports</div>
            <div className="text-sm text-orange-700">View and manage all incident reports</div>
          </button>
        </div>
      </div>

      {/* WebSocket / Live Updates Viewer */}
      <WebSocketViewer enabled={true} />
    </div>
  )
}
