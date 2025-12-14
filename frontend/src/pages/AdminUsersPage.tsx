import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { listUsersWithRoles, createSecurityOrgUser, CreateSecurityOrgUserPayload } from '../api/admin'
import { useState, FormEvent } from 'react'
import { showToast } from '../lib/toast'
import { hasAnyRole, ROLES } from '../lib/roles'
import { Navigate } from 'react-router-dom'

export default function AdminUsersPage() {
  // Only SuperAdmin can access this page
  const canAccess = hasAnyRole([ROLES.SuperAdmin])
  
  if (!canAccess) {
    return <Navigate to="/dashboard" replace />
  }
  const queryClient = useQueryClient()
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [formData, setFormData] = useState<CreateSecurityOrgUserPayload>({
    username: '',
    password: '',
    email: '',
    role: 'SecurityOrgUser',  // Default role for new users
    organization_name: '',
    organization_type: 'other',
    contact_person: '',
    contact_email: '',
    contact_phone: '',
    allowed_ip_ranges: [],
    allowed_vpn_names: [],
    notes: ''
  })
  const [ipRangeInput, setIpRangeInput] = useState('')
  const [vpnNameInput, setVpnNameInput] = useState('')

  const query = useQuery({
    queryKey: ['admin_users_roles'],
    queryFn: () => listUsersWithRoles()
  })

  const createUserMutation = useMutation({
    mutationFn: createSecurityOrgUser,
    onSuccess: () => {
      showToast('User created successfully', 'success')
      setShowCreateForm(false)
      setFormData({
        username: '',
        password: '',
        email: '',
        role: 'SecurityOrgUser',
        organization_name: '',
        organization_type: 'other',
        contact_person: '',
        contact_email: '',
        contact_phone: '',
        allowed_ip_ranges: [],
        allowed_vpn_names: [],
        notes: ''
      })
      setIpRangeInput('')
      setVpnNameInput('')
      queryClient.invalidateQueries({ queryKey: ['admin_users_roles'] })
    },
    onError: (err: any) => {
      showToast(err?.response?.data?.detail || 'Failed to create user', 'error')
    }
  })

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!formData.username || !formData.password || !formData.organization_name) {
      showToast('Please fill in all required fields', 'error')
      return
    }
    createUserMutation.mutate(formData)
  }

  function addIpRange() {
    if (ipRangeInput.trim()) {
      setFormData({
        ...formData,
        allowed_ip_ranges: [...(formData.allowed_ip_ranges || []), ipRangeInput.trim()]
      })
      setIpRangeInput('')
    }
  }

  function removeIpRange(index: number) {
    setFormData({
      ...formData,
      allowed_ip_ranges: formData.allowed_ip_ranges?.filter((_, i) => i !== index) || []
    })
  }

  function addVpnName() {
    if (vpnNameInput.trim()) {
      setFormData({
        ...formData,
        allowed_vpn_names: [...(formData.allowed_vpn_names || []), vpnNameInput.trim()]
      })
      setVpnNameInput('')
    }
  }

  function removeVpnName(index: number) {
    setFormData({
      ...formData,
      allowed_vpn_names: formData.allowed_vpn_names?.filter((_, i) => i !== index) || []
    })
  }

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-primary to-secondary text-white rounded-lg shadow-lg p-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-3xl font-bold mb-2">Users & Roles</h2>
            <p className="text-gray-100 text-sm">Manage user accounts and their roles</p>
          </div>
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="px-4 py-2 bg-white text-primary rounded-lg hover:bg-gray-100 transition-colors font-medium"
          >
            {showCreateForm ? 'Cancel' : '+ Create User'}
          </button>
        </div>
      </div>

      {showCreateForm && (
        <div className="bg-white shadow-md rounded-lg p-6 border border-gray-200">
          <h3 className="text-xl font-bold mb-4 text-gray-800 border-b pb-3">Create Security Org User</h3>
          <form onSubmit={handleSubmit} className="grid gap-4 max-w-3xl">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Username <span className="text-red-500">*</span>
                </label>
                <input
                  required
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="Enter username"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Password <span className="text-red-500">*</span>
                </label>
                <input
                  required
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="Enter password"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="Enter email (optional)"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Organization Name <span className="text-red-500">*</span>
                </label>
                <input
                  required
                  type="text"
                  value={formData.organization_name}
                  onChange={(e) => setFormData({ ...formData, organization_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="e.g., Nairobi County Command Center"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Organization Type <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={formData.organization_type}
                  onChange={(e) => setFormData({ ...formData, organization_type: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary focus:border-transparent bg-white"
                >
                  <option value="police">National Police Service</option>
                  <option value="county_command">County Command Center</option>
                  <option value="private_security">Private Security Firm</option>
                  <option value="emergency">Emergency Responder</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contact Person</label>
                <input
                  type="text"
                  value={formData.contact_person}
                  onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="Contact person name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contact Email</label>
                <input
                  type="email"
                  value={formData.contact_email}
                  onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="contact@example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contact Phone</label>
                <input
                  type="tel"
                  value={formData.contact_phone}
                  onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="+254..."
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Allowed IP Ranges (CIDR notation)</label>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={ipRangeInput}
                  onChange={(e) => setIpRangeInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addIpRange())}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="e.g., 192.168.1.0/24"
                />
                <button
                  type="button"
                  onClick={addIpRange}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  Add
                </button>
              </div>
              {formData.allowed_ip_ranges && formData.allowed_ip_ranges.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {formData.allowed_ip_ranges.map((ip, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 border border-blue-200 rounded-md text-sm"
                    >
                      {ip}
                      <button
                        type="button"
                        onClick={() => removeIpRange(idx)}
                        className="text-red-600 hover:text-red-800"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <small className="text-gray-500 text-xs mt-1 block">Leave empty to allow all IPs. Use CIDR notation (e.g., 192.168.1.0/24)</small>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Allowed VPN Names</label>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={vpnNameInput}
                  onChange={(e) => setVpnNameInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addVpnName())}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="VPN identifier/name"
                />
                <button
                  type="button"
                  onClick={addVpnName}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  Add
                </button>
              </div>
              {formData.allowed_vpn_names && formData.allowed_vpn_names.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {formData.allowed_vpn_names.map((vpn, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-2 px-3 py-1 bg-green-50 border border-green-200 rounded-md text-sm"
                    >
                      {vpn}
                      <button
                        type="button"
                        onClick={() => removeVpnName(idx)}
                        className="text-red-600 hover:text-red-800"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <small className="text-gray-500 text-xs mt-1 block">Optional: List VPN names/identifiers allowed for this organization</small>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary focus:border-transparent resize-y"
                placeholder="Additional notes about this organization/user"
              />
            </div>
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={createUserMutation.isPending}
                className="px-6 py-2 bg-primary text-white rounded-md hover:bg-secondary transition-colors font-medium disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {createUserMutation.isPending ? 'Creating...' : 'Create User'}
              </button>
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="px-6 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {query.data && (
        <div className="bg-white shadow-md rounded-lg p-6 border border-gray-200">
          <div className="mb-4">
            <div className="text-lg font-semibold text-gray-800 mb-3">Total users: <span className="text-primary">{query.data.total ?? query.data.results.length}</span></div>
            {query.data.by_role && (
              <div className="flex gap-3 flex-wrap">
                {Object.entries(query.data.by_role).map(([role, count]) => (
                  <span key={role} className="px-3 py-1 bg-gray-100 border border-gray-300 rounded-full text-sm font-medium text-gray-700">
                    {role}: {String(count)}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
      {query.isLoading && (
        <div className="bg-white shadow-md rounded-lg p-6 text-center">
          <p className="text-gray-600">Loading...</p>
        </div>
      )}
      {query.isError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-600">Failed to load users.</p>
        </div>
      )}
      {query.data && (
        <div className="bg-white shadow-md rounded-lg overflow-hidden border border-gray-200">
          <div className="p-4 bg-gray-50 border-b">
            <h3 className="text-lg font-bold text-gray-800">User List</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left table-bordered" style={{ minWidth: 800 }}>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Username</th>
                  <th>Email</th>
                  <th>Roles</th>
                  <th>Organization</th>
                  <th>Whitelist Status</th>
                  <th>Flags</th>
                </tr>
              </thead>
              <tbody>
                {query.data.results.map((u: any) => (
                  <tr key={u.id} className="transition-colors hover:bg-blue-50">
                    <td className="font-mono text-sm">{u.id}</td>
                    <td className="font-medium">{u.username}</td>
                    <td>{u.email || '-'}</td>
                    <td>
                      {u.roles.length ? (
                        <div className="flex gap-2 flex-wrap">
                          {u.roles.map((r: string) => (
                            <span key={r} className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium">
                              {r}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td>
                      {u.whitelist ? (
                        <div className="space-y-1">
                          <div className="font-medium text-sm">{u.whitelist.organization_name}</div>
                          <div className="text-xs text-gray-600 capitalize">{u.whitelist.organization_type.replace('_', ' ')}</div>
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td>
                      {u.whitelist ? (
                        <div className="space-y-1">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            u.whitelist.is_active 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {u.whitelist.is_active ? '✓ Active' : '✗ Inactive'}
                          </span>
                          {(u.whitelist.has_ip_restrictions || u.whitelist.has_vpn_restrictions) && (
                            <div className="text-xs text-gray-600">
                              {u.whitelist.has_ip_restrictions && <span className="mr-2">🔒 IP</span>}
                              {u.whitelist.has_vpn_restrictions && <span>🔒 VPN</span>}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-400 text-xs">Not whitelisted</span>
                      )}
                    </td>
                    <td>
                      {[u.is_superuser ? 'superuser' : null, u.is_staff ? 'staff' : null].filter(Boolean).length > 0 ? (
                        <div className="flex gap-2">
                          {u.is_superuser && <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded text-xs font-medium">superuser</span>}
                          {u.is_staff && <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs font-medium">staff</span>}
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
