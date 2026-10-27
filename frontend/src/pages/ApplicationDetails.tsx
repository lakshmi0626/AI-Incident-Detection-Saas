import React, { useState, useEffect } from 'react';
import { useParams, NavLink } from 'react-router-dom';
import { Boxes, Plus, Server, CheckCircle2, AlertOctagon, ArrowLeft, X } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { apiRequest } from '../services/api';
import { Application, Service, LogEntry, MetricSummaryPoint } from '../types';

export const ApplicationDetails: React.FC = () => {
  const { appId } = useParams<{ appId: string }>();
  const [app, setApp] = useState<any>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [metricPoints, setMetricPoints] = useState<MetricSummaryPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddServiceModal, setShowAddServiceModal] = useState(false);
  const [svcName, setSvcName] = useState('');
  const [svcLanguage, setSvcLanguage] = useState('java');
  const [svcTier, setSvcTier] = useState('backend');

  const loadAppData = async () => {
    try {
      const [appData, logsData, metricsData] = await Promise.all([
        apiRequest(`/applications/${appId}`),
        apiRequest(`/telemetry/logs?application_id=${appId}&limit=15`),
        apiRequest(`/telemetry/metrics/summary?application_id=${appId}&time_range_minutes=60`),
      ]);
      setApp(appData);
      setLogs(logsData || []);
      setMetricPoints(metricsData?.points || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAppData();
  }, [appId]);

  const handleAddService = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest(`/applications/${appId}/services`, {
        method: 'POST',
        body: JSON.stringify({
          name: svcName,
          language: svcLanguage,
          tier: svcTier,
        }),
      });
      setShowAddServiceModal(false);
      setSvcName('');
      loadAppData();
    } catch (err: any) {
      alert(`Error adding service: ${err.message}`);
    }
  };

  if (!app && !loading) {
    return <div className="p-8 text-center text-slate-500">Application not found.</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <NavLink
          to="/applications"
          className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 font-medium mb-3"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Applications</span>
        </NavLink>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold">
              <Boxes className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">{app?.name}</h1>
              <p className="text-xs text-slate-500">{app?.description}</p>
            </div>
          </div>
          <button
            onClick={() => setShowAddServiceModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition"
          >
            <Plus className="w-4 h-4" />
            <span>Add Microservice</span>
          </button>
        </div>
      </div>

      {/* Services Breakdown */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-4">
          Registered Microservices & Components ({app?.services?.length || 0})
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {(app?.services || []).map((s: any) => (
            <div
              key={s.id}
              className="p-3.5 rounded-lg border border-slate-200 hover:border-slate-300 transition flex items-start justify-between"
            >
              <div>
                <div className="font-bold text-slate-900 text-xs">{s.name}</div>
                <div className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-1">
                  <span className="capitalize">{s.language}</span>
                  <span>•</span>
                  <span className="capitalize">{s.tier}</span>
                </div>
              </div>
              <span
                className={`w-2.5 h-2.5 rounded-full mt-1 ${
                  s.health_status === 'healthy'
                    ? 'bg-emerald-500'
                    : s.health_status === 'degraded'
                    ? 'bg-amber-500'
                    : 'bg-rose-500 animate-ping'
                }`}
                title={`Health: ${s.health_status}`}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Metrics Chart */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
          Throughput & Latency Trend for {app?.name}
        </h3>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={metricPoints}>
              <XAxis dataKey="time" stroke="#94a3b8" fontSize={10} tickLine={false} />
              <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} />
              <Tooltip
                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', color: '#fff', fontSize: '11px' }}
              />
              <Area type="monotone" dataKey="latency_p95" stroke="#0891b2" fill="#06b6d4" fillOpacity={0.2} />
              <Area type="monotone" dataKey="error_rate" stroke="#e11d48" fill="#f43f5e" fillOpacity={0.2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent Application Logs */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            Recent Telemetry Stream
          </h3>
          <NavLink to={`/logs?application_id=${appId}`} className="text-xs font-semibold text-emerald-600 hover:text-emerald-700">
            Open in Logs Explorer →
          </NavLink>
        </div>
        <div className="divide-y divide-slate-100 font-mono text-[11px]">
          {logs.map((log) => (
            <div key={log.id} className="p-3 flex items-start gap-3 hover:bg-slate-50 transition">
              <span
                className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                  log.level === 'FATAL' || log.level === 'ERROR'
                    ? 'bg-rose-100 text-rose-700'
                    : log.level === 'WARN'
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                {log.level}
              </span>
              <span className="text-slate-400 text-[10px] whitespace-nowrap">
                {new Date(log.timestamp).toLocaleTimeString()}
              </span>
              <span className="text-slate-600 font-semibold">{log.service_name}:</span>
              <span className="text-slate-900 break-all">{log.message}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Add Service Modal */}
      {showAddServiceModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h3 className="text-sm font-bold text-slate-900">Add Microservice</h3>
              <button onClick={() => setShowAddServiceModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAddService} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Service Name</label>
                <input
                  type="text"
                  required
                  value={svcName}
                  onChange={(e) => setSvcName(e.target.value)}
                  placeholder="e.g., checkout-worker"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Language / Runtime</label>
                <select
                  value={svcLanguage}
                  onChange={(e) => setSvcLanguage(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-500"
                >
                  <option value="java">Java (Spring Boot / Micronaut)</option>
                  <option value="python">Python (FastAPI / Django / Flask)</option>
                  <option value="go">Go (Golang)</option>
                  <option value="node">Node.js (TypeScript)</option>
                  <option value="rust">Rust</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Architecture Tier</label>
                <select
                  value={svcTier}
                  onChange={(e) => setSvcTier(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-500"
                >
                  <option value="api-gateway">API Gateway / Edge</option>
                  <option value="backend">Backend Microservice</option>
                  <option value="database">Database / Persistence</option>
                  <option value="queue">Queue / Event Worker</option>
                </select>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition"
              >
                Register Service
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
