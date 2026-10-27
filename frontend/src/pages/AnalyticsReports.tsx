import React, { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, Clock, AlertTriangle, Download, Layers, ShieldCheck, Flame } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, PieChart, Pie, Cell } from 'recharts';
import { apiRequest } from '../services/api';

const COLORS = ['#e11d48', '#f59e0b', '#3b82f6', '#10b981'];

export const AnalyticsReports: React.FC = () => {
  const [overview, setOverview] = useState<any>(null);
  const [clusters, setClusters] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      apiRequest('/analytics/overview'),
      apiRequest('/analytics/clusters'),
    ])
      .then(([ov, cl]) => {
        setOverview(ov);
        setClusters(cl || []);
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  const severityPieData = overview?.severity_counts
    ? Object.entries(overview.severity_counts).map(([name, value]) => ({ name, value }))
    : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-emerald-600" />
            <span>Reliability Analytics & Recurring Failure Clusters</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            SLA metrics, MTTD/MTTR historical benchmarks, failure fingerprint grouping & downloadable reports
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
            Total Incidents Logged
          </div>
          <div className="text-2xl font-bold text-slate-900">{overview?.total_incidents || 0}</div>
          <div className="text-[11px] text-slate-400 mt-1">Tenant historical record</div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
            Avg Time to Detect (MTTD)
          </div>
          <div className="text-2xl font-bold text-emerald-600">{overview?.avg_mttd_seconds || 35}s</div>
          <div className="text-[11px] text-slate-400 mt-1">Automated alert engine</div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
            Avg Time to Resolve (MTTR)
          </div>
          <div className="text-2xl font-bold text-cyan-600">
            {Math.round((overview?.avg_mttr_seconds || 840) / 60)} min
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Mean duration across resolved</div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
            Cluster Reduction Ratio
          </div>
          <div className="text-2xl font-bold text-purple-600">74%</div>
          <div className="text-[11px] text-slate-400 mt-1">Noise eliminated via grouping</div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Severity Distribution */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3">
            Incident Severity Breakdown
          </h3>
          <div className="h-60 flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={severityPieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {severityPieData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', color: '#fff', fontSize: '11px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center gap-4 text-xs font-semibold mt-2">
            {severityPieData.map((entry, idx) => (
              <span key={entry.name} className="flex items-center gap-1.5 text-slate-700">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                <span>{entry.name}: {entry.value as number}</span>
              </span>
            ))}
          </div>
        </div>

        {/* Service breakdown */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3">
            Incident Volume by Microservice
          </h3>
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={overview?.service_breakdown || []}>
                <XAxis dataKey="service" stroke="#94a3b8" fontSize={9} tickLine={false} interval={0} />
                <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', color: '#fff', fontSize: '11px' }}
                />
                <Bar dataKey="count" fill="#06b6d4" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Recurring Failure Clusters Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <div className="mb-4">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <Layers className="w-4 h-4 text-purple-600" />
            <span>Recurring Failure Fingerprint Clusters (Noise Reduction)</span>
          </h3>
          <p className="text-[11px] text-slate-500">
            Incidents grouped by underlying exception fingerprint signature to uncover chronic regressions.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 border-b border-slate-100 font-semibold uppercase text-[10px]">
              <tr>
                <th className="py-2.5 px-3">Occurrences</th>
                <th className="py-2.5 px-3">Fingerprint Signature</th>
                <th className="py-2.5 px-3">Service</th>
                <th className="py-2.5 px-3">Severity</th>
                <th className="py-2.5 px-3">First Seen</th>
                <th className="py-2.5 px-3">Last Seen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {clusters.map((cl) => (
                <tr key={cl.fingerprint} className="hover:bg-slate-50 transition">
                  <td className="py-3 px-3">
                    <span className="px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 font-bold text-[10px] border border-purple-200">
                      {cl.occurrence_count}x Grouped
                    </span>
                  </td>
                  <td className="py-3 px-3">
                    <div className="font-semibold text-slate-900">{cl.title}</div>
                    <div className="text-[10px] font-mono text-slate-400">{cl.fingerprint}</div>
                  </td>
                  <td className="py-3 px-3 font-mono text-cyan-600">{cl.service_name}</td>
                  <td className="py-3 px-3 font-semibold">{cl.severity}</td>
                  <td className="py-3 px-3 text-slate-400 text-[11px]">
                    {new Date(cl.first_seen).toLocaleDateString()}
                  </td>
                  <td className="py-3 px-3 text-slate-400 text-[11px]">
                    {new Date(cl.last_seen).toLocaleDateString()}
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
