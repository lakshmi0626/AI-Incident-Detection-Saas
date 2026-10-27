import React, { useState, useEffect } from 'react';
import { Settings, Building, Save, CheckCircle2, ShieldCheck, Globe } from 'lucide-react';
import { apiRequest } from '../services/api';
import { useAuth } from '../context/AuthContext';

export const OrganizationSettings: React.FC = () => {
  const { currentOrg, refreshProfile } = useAuth();
  const [name, setName] = useState('');
  const [timezone, setTimezone] = useState('UTC');
  const [alertEmail, setAlertEmail] = useState('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (currentOrg) {
      setName(currentOrg.name);
      setTimezone(currentOrg.settings_json?.timezone || 'UTC');
      setAlertEmail(currentOrg.settings_json?.alert_email || '');
    }
  }, [currentOrg]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setStatusMessage(null);
    try {
      await apiRequest('/organizations/current/settings', {
        method: 'PUT',
        body: JSON.stringify({
          name,
          settings: {
            timezone,
            alert_email: alertEmail,
          },
        }),
      });
      setStatusMessage('Organization settings successfully updated.');
      await refreshProfile();
    } catch (err: any) {
      alert(`Error updating settings: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <Settings className="w-5 h-5 text-emerald-600" />
          <span>Organization Configuration</span>
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          General organization parameters, alert routing defaults & localization
        </p>
      </div>

      {statusMessage && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <form onSubmit={handleSave} className="space-y-5">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Organization Legal / Display Name
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Tenant Unique Slug
            </label>
            <input
              type="text"
              readOnly
              disabled
              value={currentOrg?.slug || ''}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono text-slate-500 cursor-not-allowed"
            />
            <span className="text-[10px] text-slate-400 mt-1 block">
              Unique tenant identifier used in multi-tenant database partitions.
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Default Timezone
              </label>
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-500"
              >
                <option value="UTC">UTC (Coordinated Universal Time)</option>
                <option value="America/New_York">America/New_York (EST)</option>
                <option value="America/Los_Angeles">America/Los_Angeles (PST)</option>
                <option value="Europe/London">Europe/London (GMT)</option>
                <option value="Asia/Tokyo">Asia/Tokyo (JST)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Global Escalation Email
              </label>
              <input
                type="email"
                value={alertEmail}
                onChange={(e) => setAlertEmail(e.target.value)}
                placeholder="sre-oncall@company.internal"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-end">
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition shadow-sm disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{loading ? 'Saving...' : 'Save Changes'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
