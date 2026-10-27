import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { Boxes, Plus, Key, RefreshCw, AlertTriangle, ShieldCheck, Check, Copy, ExternalLink, X } from 'lucide-react';
import { apiRequest } from '../services/api';
import { Application } from '../types';

export const Applications: React.FC = () => {
  const [apps, setApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [appName, setAppName] = useState('');
  const [appDescription, setAppDescription] = useState('');
  const [environments, setEnvironments] = useState('production, staging, qa');
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchApps = async () => {
    try {
      const data = await apiRequest('/applications');
      setApps(data || []);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApps();
  }, []);

  const handleCreateApp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const envList = environments.split(',').map((e) => e.trim().toLowerCase());
      const res = await apiRequest('/applications', {
        method: 'POST',
        body: JSON.stringify({
          name: appName,
          description: appDescription,
          environments: envList,
        }),
      });
      setCreatedKey(res.api_key);
      fetchApps();
    } catch (err: any) {
      setError(err.message || 'Failed to create application');
    }
  };

  const handleRotateKey = async (appId: string) => {
    if (!confirm('Are you sure you want to rotate the Ingestion API Key? The old key will immediately stop working.')) return;
    try {
      const res = await apiRequest(`/applications/${appId}/api-key`, { method: 'POST' });
      alert(`New Ingestion Key Generated:\n\n${res.api_key}\n\nCopy it now, it will not be displayed again.`);
      fetchApps();
    } catch (err: any) {
      alert(`Error rotating key: ${err.message}`);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Monitored Applications</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure target applications, service tiers, environments, and OpenTelemetry ingestion tokens
          </p>
        </div>
        <button
          onClick={() => {
            setShowAddModal(true);
            setCreatedKey(null);
            setAppName('');
            setAppDescription('');
          }}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-sm shadow-emerald-700/20 transition"
        >
          <Plus className="w-4 h-4" />
          <span>Register Application</span>
        </button>
      </div>

      {/* Grid of Applications */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {apps.map((app) => (
          <div
            key={app.id}
            className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex flex-col justify-between hover:border-slate-300 transition"
          >
            <div>
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700">
                    <Boxes className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 leading-snug">{app.name}</h3>
                    <span className="font-mono text-[10px] text-slate-400">{app.slug}</span>
                  </div>
                </div>
                <span
                  className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                    app.status === 'critical'
                      ? 'bg-rose-100 text-rose-700 border border-rose-200'
                      : 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                  }`}
                >
                  {app.status === 'critical' ? 'Incidents Active' : 'Healthy'}
                </span>
              </div>

              <p className="text-xs text-slate-500 line-clamp-2 mt-2">
                {app.description || 'Enterprise microservices collection with automated incident detection.'}
              </p>

              <div className="flex flex-wrap gap-1 mt-3">
                {app.environments_json.map((env) => (
                  <span
                    key={env}
                    className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-medium border border-slate-200"
                  >
                    {env}
                  </span>
                ))}
              </div>
            </div>

            <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5 text-slate-500 font-mono text-[11px]">
                <Key className="w-3.5 h-3.5 text-slate-400" />
                <span>{app.api_key_prefix}••••</span>
                <button
                  onClick={() => handleRotateKey(app.id)}
                  title="Rotate API Key"
                  className="text-slate-400 hover:text-slate-600 ml-1"
                >
                  <RefreshCw className="w-3 h-3" />
                </button>
              </div>

              <NavLink
                to={`/applications/${app.id}`}
                className="font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
              >
                <span>Services ({app.services_count})</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </NavLink>
            </div>
          </div>
        ))}
      </div>

      {/* Register App Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h3 className="text-sm font-bold text-slate-900">Register New Application</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {createdKey ? (
              <div className="p-6 space-y-4">
                <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs">
                  <div className="font-bold mb-1">Application successfully registered!</div>
                  <p className="text-[11px]">
                    Save your telemetry ingestion API key below. It provides write-only access for OpenTelemetry
                    agents and log forwarding daemons.
                  </p>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">
                    Ingestion API Key
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      readOnly
                      value={createdKey}
                      className="flex-1 bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono text-slate-800 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => copyToClipboard(createdKey)}
                      className="px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center gap-1.5"
                    >
                      {copiedKey ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                      <span>{copiedKey ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                </div>

                <button
                  onClick={() => setShowAddModal(false)}
                  className="w-full py-2.5 rounded-lg bg-emerald-600 text-white font-semibold text-xs hover:bg-emerald-500 transition mt-2"
                >
                  Done & Close
                </button>
              </div>
            ) : (
              <form onSubmit={handleCreateApp} className="p-6 space-y-4">
                {error && (
                  <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                    {error}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Application Name</label>
                  <input
                    type="text"
                    required
                    value={appName}
                    onChange={(e) => setAppName(e.target.value)}
                    placeholder="e.g., Billing & Settlement Pipeline"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Description</label>
                  <textarea
                    rows={2}
                    value={appDescription}
                    onChange={(e) => setAppDescription(e.target.value)}
                    placeholder="Brief architectural overview or responsibilities"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Environments (comma separated)
                  </label>
                  <input
                    type="text"
                    value={environments}
                    onChange={(e) => setEnvironments(e.target.value)}
                    placeholder="production, staging, qa"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition shadow-sm"
                >
                  Generate Ingestion Key & Register
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
