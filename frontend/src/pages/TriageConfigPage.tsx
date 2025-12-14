import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/axios'
import { useState, FormEvent } from 'react'
import { showToast } from '../lib/toast'
import { hasAnyRole, ROLES } from '../lib/roles'
import { Navigate } from 'react-router-dom'

type TriageRule = {
  id: number
  name: string
  enabled: boolean
  threshold: number
  county?: string
}

export default function TriageConfigPage() {
  const canAccess = hasAnyRole([ROLES.SuperAdmin])
  
  if (!canAccess) {
    return <Navigate to="/dashboard" replace />
  }

  const queryClient = useQueryClient()
  const [editingRule, setEditingRule] = useState<TriageRule | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    enabled: true,
    threshold: 70,
    county: '',
  })

  const { data: rules, isLoading } = useQuery({
    queryKey: ['triage_rules'],
    queryFn: async () => {
      const res = await api.get<TriageRule[]>('/admin/triage_rules/')
      return res.data
    },
  })

  const createMutation = useMutation({
    mutationFn: async (data: Partial<TriageRule>) => {
      const res = await api.post('/admin/triage_rules/', data)
      return res.data
    },
    onSuccess: () => {
      showToast('Triage rule created', 'success')
      queryClient.invalidateQueries({ queryKey: ['triage_rules'] })
      setFormData({ name: '', enabled: true, threshold: 70, county: '' })
      setEditingRule(null)
    },
    onError: (err: any) => {
      showToast(err?.response?.data?.detail || 'Failed to create rule', 'error')
    },
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<TriageRule> }) => {
      const res = await api.patch(`/admin/triage_rules/${id}/`, data)
      return res.data
    },
    onSuccess: () => {
      showToast('Triage rule updated', 'success')
      queryClient.invalidateQueries({ queryKey: ['triage_rules'] })
      setEditingRule(null)
      setFormData({ name: '', enabled: true, threshold: 70, county: '' })
    },
    onError: (err: any) => {
      showToast(err?.response?.data?.detail || 'Failed to update rule', 'error')
    },
  })

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!formData.name) {
      showToast('Rule name is required', 'error')
      return
    }
    if (editingRule) {
      updateMutation.mutate({ id: editingRule.id, data: formData })
    } else {
      createMutation.mutate(formData)
    }
  }

  function startEdit(rule: TriageRule) {
    setEditingRule(rule)
    setFormData({
      name: rule.name,
      enabled: rule.enabled,
      threshold: rule.threshold,
      county: rule.county || '',
    })
  }

  function cancelEdit() {
    setEditingRule(null)
    setFormData({ name: '', enabled: true, threshold: 70, county: '' })
  }

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-purple-600 to-indigo-800 text-white rounded-lg shadow-lg p-6">
        <h2 className="text-3xl font-bold mb-2">Triage & Scoring Engine Control</h2>
        <p className="text-gray-100 text-sm">Configure severity thresholds and triage rules</p>
      </div>

      {/* Create/Edit Form */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-xl font-bold mb-4 text-gray-800">
          {editingRule ? 'Edit Triage Rule' : 'Create New Triage Rule'}
        </h3>
        <form onSubmit={handleSubmit} className="space-y-4 max-w-2xl">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Rule Name <span className="text-red-500">*</span>
            </label>
            <input
              required
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary focus:border-transparent"
              placeholder="e.g., Critical Severity Threshold"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Threshold (0-100) <span className="text-red-500">*</span>
              </label>
              <input
                required
                type="number"
                min="0"
                max="100"
                value={formData.threshold}
                onChange={(e) => setFormData({ ...formData, threshold: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary focus:border-transparent"
              />
              <small className="text-gray-500 text-xs mt-1 block">
                Reports scoring above this threshold will be assigned this severity level
              </small>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">County (Optional)</label>
              <input
                type="text"
                value={formData.county}
                onChange={(e) => setFormData({ ...formData, county: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="Leave empty for all counties"
              />
              <small className="text-gray-500 text-xs mt-1 block">
                Apply this rule only to a specific county
              </small>
            </div>
          </div>
          <div className="flex items-center">
            <input
              type="checkbox"
              id="enabled"
              checked={formData.enabled}
              onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
              className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
            />
            <label htmlFor="enabled" className="ml-2 text-sm font-medium text-gray-700">
              Rule Enabled
            </label>
          </div>
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={createMutation.isPending || updateMutation.isPending}
              className="px-6 py-2 bg-primary text-white rounded-md hover:bg-secondary transition-colors font-medium disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {editingRule
                ? updateMutation.isPending
                  ? 'Updating...'
                  : 'Update Rule'
                : createMutation.isPending
                ? 'Creating...'
                : 'Create Rule'}
            </button>
            {editingRule && (
              <button
                type="button"
                onClick={cancelEdit}
                className="px-6 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Rules List */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="p-4 bg-gray-50 border-b">
          <h3 className="text-lg font-bold text-gray-800">Configured Triage Rules</h3>
        </div>
        {isLoading ? (
          <div className="p-8 text-center text-gray-500">Loading rules...</div>
        ) : !rules || rules.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No triage rules configured</div>
        ) : (
          <div className="divide-y">
            {rules.map((rule) => (
              <div key={rule.id} className="p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h4 className="font-semibold text-gray-800">{rule.name}</h4>
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          rule.enabled
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {rule.enabled ? 'Enabled' : 'Disabled'}
                      </span>
                    </div>
                    <div className="text-sm text-gray-600">
                      <span className="font-medium">Threshold:</span> {rule.threshold}
                      {rule.county && (
                        <>
                          {' • '}
                          <span className="font-medium">County:</span> {rule.county}
                        </>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => startEdit(rule)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm"
                  >
                    Edit
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Info Section */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-semibold text-blue-900 mb-2">How Triage Rules Work</h4>
        <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
          <li>Each rule defines a severity threshold (0-100)</li>
          <li>Reports are scored based on multiple factors (location, time, type, history)</li>
          <li>Rules can be county-specific or apply to all counties</li>
          <li>Only enabled rules are active in the triage engine</li>
          <li>Rules are evaluated in order of priority (highest threshold first)</li>
        </ul>
      </div>
    </div>
  )
}

