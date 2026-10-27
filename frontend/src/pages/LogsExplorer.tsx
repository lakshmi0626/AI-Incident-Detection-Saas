import React, { useState, useEffect } from 'react';
import { useSearchParams, NavLink } from 'react-router-dom';
import { ScrollText, Search, Filter, ShieldCheck, RefreshCw, GitBranch, Terminal } from 'lucide-react';
import { apiRequest } from '../services/api';
import { LogEntry } from '../types';

export const LogsExplorer: React.FC = () => {
  const [searchParams] = useSearchParams();
  const appParam = searchParams.get('application_id');

  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [levelFilter, setLevelFilter] = useState('ALL');
  const [serviceFilter, setServiceFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [loading, setLoading] = useState(false);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      let query = `/telemetry/logs?limit=100`;
      if (appParam) query += `&application_id=${appParam}`;
      if (levelFilter !== 'ALL') query += `&level=${levelFilter}`;
      if (serviceFilter) query += `&service_name=${encodeURIComponent(serviceFilter)}`;
      if (searchQuery) query += `&search=${encodeURIComponent(searchQuery)}`;

      const data = await apiRequest(query);
      setLogs(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [levelFilter, serviceFilter, searchQuery, appParam]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchLogs, 3000);
    return () => clearInterval(interval);
  }, [autoRefresh, levelFilter, serviceFilter, searchQuery]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <ScrollText className="w-5 h-5 text-emerald-600" />
            <span>Structured Logs Explorer</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time log ingestion stream with automated secret redaction, service correlation & trace linking
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Secret redaction active pill */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-medium">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Secret Redaction Engine Active</span>
          </div>

          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition border ${
              autoRefresh
                ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${autoRefresh ? 'animate-spin' : ''}`} />
            <span>{autoRefresh ? 'Streaming (3s)' : 'Live Stream'}</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative w-full md:w-96">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search raw log message, exception or keyword..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-emerald-500 font-mono"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {['ALL', 'FATAL', 'ERROR', 'WARN', 'INFO', 'DEBUG'].map((lvl) => (
            <button
              key={lvl}
              onClick={() => setLevelFilter(lvl)}
              className={`px-2.5 py-1 rounded text-xs font-semibold transition ${
                levelFilter === lvl
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {lvl}
            </button>
          ))}
        </div>
      </div>

      {/* Log Stream Terminal Container */}
      <div className="bg-slate-950 rounded-2xl border border-slate-800 shadow-xl overflow-hidden font-mono text-[11px]">
        {/* Terminal Header */}
        <div className="px-4 py-2.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-slate-400">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-rose-500/80 inline-block" />
            <span className="w-3 h-3 rounded-full bg-amber-500/80 inline-block" />
            <span className="w-3 h-3 rounded-full bg-emerald-500/80 inline-block" />
            <span className="text-xs text-slate-300 font-semibold ml-2">stdout / sanitized stream</span>
          </div>
          <span className="text-[10px] text-slate-500">Showing {logs.length} matching entries</span>
        </div>

        {/* Log rows */}
        <div className="divide-y divide-slate-900 max-h-[600px] overflow-y-auto p-2">
          {logs.length === 0 ? (
            <div className="py-12 text-center text-slate-600">No telemetry log entries found.</div>
          ) : (
            logs.map((l) => (
              <div
                key={l.id}
                onClick={() => setExpandedLogId(expandedLogId === l.id ? null : l.id)}
                className="p-2 hover:bg-slate-900/60 rounded cursor-pointer transition flex flex-col gap-1"
              >
                <div className="flex items-start gap-2.5">
                  <span className="text-slate-500 text-[10px] whitespace-nowrap">
                    {new Date(l.timestamp).toLocaleTimeString()}
                  </span>
                  <span
                    className={`px-1.5 py-0.2 rounded text-[9px] font-bold uppercase whitespace-nowrap ${
                      l.level === 'FATAL' || l.level === 'ERROR'
                        ? 'bg-rose-950 text-rose-400 border border-rose-800'
                        : l.level === 'WARN'
                        ? 'bg-amber-950 text-amber-400 border border-amber-800'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {l.level}
                  </span>
                  <span className="text-cyan-400 font-semibold whitespace-nowrap">{l.service_name}</span>
                  <span className="text-slate-200 break-all flex-1">{l.message}</span>
                  {l.trace_id && (
                    <NavLink
                      to={`/traces?trace_id=${l.trace_id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="text-[10px] text-emerald-400 hover:text-emerald-300 hover:underline flex items-center gap-1 whitespace-nowrap ml-2"
                    >
                      <GitBranch className="w-3 h-3" />
                      <span>Trace</span>
                    </NavLink>
                  )}
                </div>

                {expandedLogId === l.id && l.context_data && (
                  <div className="mt-2 p-3 bg-slate-900 rounded border border-slate-800 text-slate-300 text-[10px]">
                    <div className="text-slate-400 font-bold mb-1">Context Payload (Sanitized):</div>
                    <pre className="text-emerald-400 whitespace-pre-wrap">
                      {JSON.stringify(l.context_data, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
