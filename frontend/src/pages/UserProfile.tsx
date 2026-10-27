import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { UserCircle, Key, Lock, CheckCircle2, Shield, AlertTriangle, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../services/api';
import { Incident } from '../types';

export const UserProfile: React.FC = () => {
  const { user } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordStatus, setPasswordStatus] = useState<string | null>(null);
  const [assignedIncidents, setAssignedIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    apiRequest('/incidents?limit=50').then((data: Incident[]) => {
      const myInc = (data || []).filter((i) => i.assigned_to_user_id === user?.id);
      setAssignedIncidents(myInc);
    });
  }, [user]);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      alert('New passwords do not match');
      return;
    }
    setLoading(true);
    setPasswordStatus(null);
    try {
      await apiRequest('/auth/password', {
        method: 'POST',
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
        }),
      });
      setPasswordStatus('Password changed successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      alert(`Error updating password: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <UserCircle className="w-5 h-5 text-emerald-600" />
          <span>User Profile & Security Credentials</span>
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Account information, password management, and personal incident assignment roster
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Profile Card (1 col) */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 text-center flex flex-col items-center">
          <div className="w-20 h-20 rounded-full bg-slate-900 text-white font-extrabold text-2xl flex items-center justify-center mb-4 shadow-lg">
            {user?.full_name?.charAt(0) || 'U'}
          </div>
          <h2 className="text-base font-bold text-slate-900">{user?.full_name}</h2>
          <span className="text-xs text-slate-400 font-mono mt-0.5">{user?.email}</span>

          <div className="mt-4 flex flex-wrap gap-2 justify-center">
            <span className="px-3 py-1 rounded-full text-xs font-bold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
              {user?.role || 'Engineer'}
            </span>
            {user?.is_superuser && (
              <span className="px-3 py-1 rounded-full text-xs font-bold uppercase bg-purple-50 text-purple-700 border border-purple-200">
                Superuser
              </span>
            )}
          </div>

          <div className="mt-6 pt-5 border-t border-slate-100 text-left w-full text-xs space-y-2 text-slate-500">
            <div>
              <span className="font-semibold text-slate-700">Account ID: </span>
              <span className="font-mono text-[10px] text-slate-400">{user?.id}</span>
            </div>
            <div>
              <span className="font-semibold text-slate-700">Member Since: </span>
              <span>{user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'Active'}</span>
            </div>
          </div>
        </div>

        {/* Change Password & Security (2 cols) */}
        <div className="md:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2 flex items-center gap-2">
            <Key className="w-4 h-4 text-emerald-600" />
            <span>Update Account Password</span>
          </h3>
          <p className="text-[11px] text-slate-500 mb-4">
            IncidentIQ hashes passwords with Argon2 and enforces secure minimum lengths.
          </p>

          {passwordStatus && (
            <div className="p-3 mb-4 rounded-lg bg-emerald-50 text-emerald-800 text-xs font-medium flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>{passwordStatus}</span>
            </div>
          )}

          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Current Password</label>
              <input
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full border border-slate-300 rounded-lg p-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">New Password (8+ chars)</label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Confirm New Password</label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="py-2.5 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition"
            >
              {loading ? 'Updating Password...' : 'Save New Password'}
            </button>
          </form>
        </div>
      </div>

      {/* Incidents Assigned to You */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-500" />
          <span>Incidents Assigned to You ({assignedIncidents.length})</span>
        </h3>
        <p className="text-[11px] text-slate-500 mb-4">
          Open investigations assigned to your queue for diagnosis and remediation.
        </p>

        {assignedIncidents.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-slate-100">
            You currently have no open assigned incidents.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {assignedIncidents.map((inc) => (
              <div key={inc.id} className="py-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      inc.severity === 'Critical'
                        ? 'bg-rose-100 text-rose-700'
                        : 'bg-amber-100 text-amber-700'
                    }`}
                  >
                    {inc.severity}
                  </span>
                  <div>
                    <NavLink
                      to={`/incidents/${inc.id}`}
                      className="font-bold text-xs text-slate-900 hover:text-emerald-600"
                    >
                      {inc.title}
                    </NavLink>
                    <div className="text-[10px] text-slate-400 font-mono">
                      Service: {inc.service_name} • Status: {inc.status}
                    </div>
                  </div>
                </div>

                <NavLink
                  to={`/incidents/${inc.id}`}
                  className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 inline-flex items-center gap-1"
                >
                  <span>Investigate</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </NavLink>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
