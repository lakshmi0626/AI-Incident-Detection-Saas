import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import {
  AlertTriangle,
  Activity,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  BrainCircuit,
  Flame,
  Shield,
  Zap,
  TrendingDown,
  Layers
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar
} from 'recharts';
import { apiRequest } from '../services/api';
import { Incident, MetricSummaryPoint } from '../types';

export const OverviewDashboard: React.FC = () => {
  const [analytics, setAnalytics] = useState<any>(null);
  const [recentIncidents, setRecentIncidents] = useState<Incident[]>([]);
  const [metricPoints, setMetricPoints] = useState<MetricSummaryPoint[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      const [overviewData, incidentsData, metricsData] = await Promise.all([
        apiRequest('/analytics/overview'),
        apiRequest('/incidents?limit=5'),
        apiRequest('/telemetry/metrics/summary?time_range_minutes=60'),
      ]);
      setAnalytics(overviewData);
      setRecentIncidents(incidentsData || []);
      setMetricPoints(metricsData?.points || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-6">
      {/* Top Banner & Quick Status */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">System Reliability Overview</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time incident detection, automated AI root-cause hypotheses, and service performance
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-600">Health Index:</span>
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <span>{analytics?.health_index ?? 92} / 100 Operational</span>
          </div>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Active Incidents */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Active Incidents</span>
            <AlertTriangle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">{analytics?.active_incidents ?? 2}</span>
            <span className="text-xs text-rose-600 font-medium">
              ({analytics?.severity_counts?.Critical ?? 1} Critical)
            </span>
          </div>
          <div className="text-[11px] text-slate-400 mt-2 flex items-center gap-1">
            <span>Deduplication & alert grouping active</span>
          </div>
        </div>

        {/* MTTD */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Mean Time To Detect</span>
            <Zap className="w-4 h-4 text-amber-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">{analytics?.avg_mttd_seconds ?? 32}s</span>
            <span className="text-xs text-emerald-600 font-medium">94% automated</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-2 flex items-center gap-1">
            <span>Rules evaluated sub-second</span>
          </div>
        </div>

        {/* MTTR */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Mean Time To Resolve</span>
            <Clock className="w-4 h-4 text-cyan-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">
              {Math.round((analytics?.avg_mttr_seconds ?? 840) / 60)}m
            </span>
            <span className="text-xs text-emerald-600 font-medium">-38% with AI SRE</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-2 flex items-center gap-1">
            <span>Includes root-cause diffs</span>
          </div>
        </div>

        {/* Total Resolved */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Resolved Outages</span>
            <Shield className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">{analytics?.resolved_incidents ?? 14}</span>
            <span className="text-xs text-slate-500 font-medium">Post-mortems archived</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-2 flex items-center gap-1">
            <span>Verified root-causes indexed</span>
          </div>
        </div>
      </div>

      {/* Main Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Latency & Error Rate Trend */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Response Latency (p95) & Error Rate
              </h3>
              <p className="text-[11px] text-slate-400">Past 60 minutes real-time telemetry</p>
            </div>
            <div className="flex items-center gap-3 text-[11px]">
              <span className="flex items-center gap-1 text-cyan-600 font-medium">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-500" /> p95 (ms)
              </span>
              <span className="flex items-center gap-1 text-rose-600 font-medium">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500" /> Error %
              </span>
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={metricPoints}>
                <defs>
                  <linearGradient id="colorLatency" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorError" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="time" stroke="#94a3b8" fontSize={10} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', color: '#fff', fontSize: '11px' }}
                />
                <Area type="monotone" dataKey="latency_p95" stroke="#0891b2" fillOpacity={1} fill="url(#colorLatency)" />
                <Area type="monotone" dataKey="error_rate" stroke="#e11d48" fillOpacity={1} fill="url(#colorError)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Throughput & Service Distribution */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Incident Frequency by Service
              </h3>
              <p className="text-[11px] text-slate-400">Total detected anomalies per microservice</p>
            </div>
            <span className="text-[11px] font-medium text-slate-500">Auto-correlated</span>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics?.service_breakdown || [
                { service: 'payment-gateway', count: 6 },
                { service: 'order-api', count: 4 },
                { service: 'inventory-service', count: 3 },
                { service: 'auth-service', count: 2 },
                { service: 'notification-worker', count: 1 },
              ]}>
                <XAxis dataKey="service" stroke="#94a3b8" fontSize={9} tickLine={false} interval={0} />
                <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', color: '#fff', fontSize: '11px' }}
                />
                <Bar dataKey="count" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Active Incidents & AI Triage Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Flame className="w-4 h-4 text-rose-500" />
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Recent Incidents & Automated AI Hypotheses
            </h3>
          </div>
          <NavLink
            to="/incidents"
            className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
          >
            <span>View All Incidents</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </NavLink>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 border-b border-slate-100 font-semibold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-4">Severity</th>
                <th className="py-3 px-4">Incident Title</th>
                <th className="py-3 px-4">Service</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">AI Investigation</th>
                <th className="py-3 px-4">Detected</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recentIncidents.map((inc) => (
                <tr key={inc.id} className="hover:bg-slate-50/80 transition">
                  <td className="py-3 px-4">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        inc.severity === 'Critical'
                          ? 'bg-rose-100 text-rose-700 border border-rose-200'
                          : inc.severity === 'High'
                          ? 'bg-amber-100 text-amber-700 border border-amber-200'
                          : 'bg-blue-100 text-blue-700 border border-blue-200'
                      }`}
                    >
                      {inc.severity}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-semibold text-slate-900 max-w-xs truncate">
                    {inc.title}
                  </td>
                  <td className="py-3 px-4 font-mono text-slate-600 text-[11px]">
                    {inc.service_name}
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        inc.status === 'Resolved' || inc.status === 'Closed'
                          ? 'bg-emerald-50 text-emerald-700'
                          : inc.status === 'Triggered'
                          ? 'bg-rose-50 text-rose-700 animate-pulse'
                          : 'bg-amber-50 text-amber-700'
                      }`}
                    >
                      {inc.status}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <NavLink
                      to={`/ai-investigation?incident_id=${inc.id}`}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-[11px] font-semibold border border-emerald-200 transition"
                    >
                      <BrainCircuit className="w-3.5 h-3.5 text-emerald-600" />
                      <span>{inc.ai_status === 'verified' ? 'Verified Cause' : 'Inspect AI Diagnosis'}</span>
                    </NavLink>
                  </td>
                  <td className="py-3 px-4 text-slate-400 text-[11px]">
                    {new Date(inc.created_at).toLocaleTimeString()}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <NavLink
                      to={`/incidents/${inc.id}`}
                      className="text-xs font-semibold text-slate-700 hover:text-emerald-600"
                    >
                      Details & Timeline →
                    </NavLink>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
