import React, { useState, useEffect } from 'react';
import { Users, Plus, ShieldCheck, Mail, Trash2, X, Check } from 'lucide-react';
import { apiRequest } from '../services/api';
import { useAuth } from '../context/AuthContext';

export const TeamMembers: React.FC = () => {
  const { user } = useAuth();
  const [members, setMembers] = useState<any[]>([]);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('engineer');
  const [loading, setLoading] = useState(true);

  const fetchMembers = async () => {
    try {
      const data = await apiRequest('/organizations/current/members');
      setMembers(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, []);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/organizations/current/members', {
        method: 'POST',
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });
      setShowInviteModal(false);
      setInviteEmail('');
      fetchMembers();
    } catch (err: any) {
      alert(`Error inviting member: ${err.message}`);
    }
  };

  const handleRoleChange = async (memberId: string, newRole: string) => {
    try {
      await apiRequest(`/organizations/current/members/${memberId}`, {
        method: 'PUT',
        body: JSON.stringify({ role: newRole }),
      });
      fetchMembers();
    } catch (err: any) {
      alert(`Error updating role: ${err.message}`);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!confirm('Are you sure you want to remove this member from the organization?')) return;
    try {
      await apiRequest(`/organizations/current/members/${memberId}`, { method: 'DELETE' });
      fetchMembers();
    } catch (err: any) {
      alert(`Error removing member: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Users className="w-5 h-5 text-emerald-600" />
            <span>Team Members & Role-Based Permissions (RBAC)</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage organization engineers, security roles, permissions & access control
          </p>
        </div>
        <button
          onClick={() => setShowInviteModal(true)}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-sm transition"
        >
          <Plus className="w-4 h-4" />
          <span>Invite Member</span>
        </button>
      </div>

      {/* Members Roster Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
            Active Members ({members.length})
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 border-b border-slate-100 font-semibold uppercase text-[10px]">
              <tr>
                <th className="py-3 px-4">User</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Joined Date</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {members.map((m) => {
                const isSelf = m.user_id === user?.id;
                return (
                  <tr key={m.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-700 font-bold flex items-center justify-center text-xs">
                          {m.full_name?.charAt(0)}
                        </div>
                        <div>
                          <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                            <span>{m.full_name}</span>
                            {isSelf && (
                              <span className="text-[10px] text-emerald-600 bg-emerald-50 px-1.5 rounded">
                                (You)
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-400">{m.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <select
                        value={m.role}
                        disabled={isSelf}
                        onChange={(e) => handleRoleChange(m.id, e.target.value)}
                        className="border border-slate-200 rounded px-2 py-1 text-xs text-slate-800 bg-slate-50 focus:outline-none capitalize disabled:opacity-60"
                      >
                        <option value="owner">Owner</option>
                        <option value="admin">Admin</option>
                        <option value="engineer">Engineer</option>
                        <option value="viewer">Viewer</option>
                      </select>
                    </td>
                    <td className="py-3 px-4 text-slate-400 text-[11px]">
                      {new Date(m.joined_at).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {!isSelf && (
                        <button
                          onClick={() => handleRemoveMember(m.id)}
                          className="text-slate-400 hover:text-rose-600 p-1"
                          title="Remove from Organization"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* RBAC Permissions Matrix Reference */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2">
          Role-Based Access Control (RBAC) Permissions Matrix
        </h3>
        <p className="text-[11px] text-slate-500 mb-4">
          IncidentIQ strictly enforces tenant isolation and fine-grained role privileges on every API endpoint.
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border border-slate-100">
            <thead className="bg-slate-50 text-slate-700 font-semibold text-[11px]">
              <tr>
                <th className="p-2.5 border">Capability</th>
                <th className="p-2.5 border text-center">Owner</th>
                <th className="p-2.5 border text-center">Admin</th>
                <th className="p-2.5 border text-center">Engineer</th>
                <th className="p-2.5 border text-center">Viewer</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-[11px] text-slate-600">
              <tr>
                <td className="p-2.5 border font-medium">View Incidents, Logs, Traces & Dashboards</td>
                <td className="p-2.5 border text-center text-emerald-600 font-bold">✓</td>
                <td className="p-2.5 border text-center text-emerald-600 font-bold">✓</td>
                <td className="p-2.5 border text-center text-emerald-600 font-bold">✓</td>
                <td className="p-2.5 border text-center text-emerald-600 font-bold">✓</td>
              </tr>
              <tr>
                <td className="p-2.5 border font-medium">Acknowledge, Mitigate & Resolve Incidents</td>
                <td className="p-2.5 border text-center text-emerald-600 font-bold">✓</td>
                <td className="p-2.5 border text-center text-emerald-600 font-bold">✓</td>
                <td className="p-2.5 border text-center text-emerald-600 font-bold">✓</td>
                <td className="p-2.5 border text-center text-slate-300">—</td>
              </tr>
              <tr>
                <td className="p-2.5 border font-medium">Run AI Investigations & Submit Verified Causes</td>
                <td className="p-2.5 border text-center text-emerald-600 font-bold">✓</td>
                <td className="p-2.5 border text-center text-emerald-600 font-bold">✓</td>
                <td className="p-2.5 border text-center text-emerald-600 font-bold">✓</td>
                <td className="p-2.5 border text-center text-slate-300">—</td>
              </tr>
              <tr>
                <td className="p-2.5 border font-medium">Manage Apps, API Keys & Detection Rules</td>
                <td className="p-2.5 border text-center text-emerald-600 font-bold">✓</td>
                <td className="p-2.5 border text-center text-emerald-600 font-bold">✓</td>
                <td className="p-2.5 border text-center text-slate-300">—</td>
                <td className="p-2.5 border text-center text-slate-300">—</td>
              </tr>
              <tr>
                <td className="p-2.5 border font-medium">Invite Members, Upgrade Subscriptions & Retention</td>
                <td className="p-2.5 border text-center text-emerald-600 font-bold">✓</td>
                <td className="p-2.5 border text-center text-emerald-600 font-bold">✓</td>
                <td className="p-2.5 border text-center text-slate-300">—</td>
                <td className="p-2.5 border text-center text-slate-300">—</td>
              </tr>
              <tr>
                <td className="p-2.5 border font-medium">GDPR Permanent Data Erasure & Tenant Deletion</td>
                <td className="p-2.5 border text-center text-emerald-600 font-bold">✓</td>
                <td className="p-2.5 border text-center text-slate-300">—</td>
                <td className="p-2.5 border text-center text-slate-300">—</td>
                <td className="p-2.5 border text-center text-slate-300">—</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h3 className="text-sm font-bold text-slate-900">Invite Team Member</h3>
              <button onClick={() => setShowInviteModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleInvite} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="engineer@company.internal"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Assigned Role</label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-500"
                >
                  <option value="engineer">Engineer (Investigate & Resolve)</option>
                  <option value="admin">Admin (Manage Apps & Rules)</option>
                  <option value="viewer">Viewer (Read-Only Access)</option>
                </select>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition"
              >
                Send Invite
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
