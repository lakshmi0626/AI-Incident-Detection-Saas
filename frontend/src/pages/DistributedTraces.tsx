import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { GitBranch, Search, Filter, Clock, CheckCircle2, AlertOctagon, Layers } from 'lucide-react';
import { apiRequest } from '../services/api';
import { TraceSpan } from '../types';

export const DistributedTraces: React.FC = () => {
  const [searchParams] = useSearchParams();
  const requestedTraceId = searchParams.get('trace_id');

  const [traces, setTraces] = useState<any[]>([]);
  const [selectedTraceId, setSelectedTraceId] = useState<string>('');
  const [waterfallData, setWaterfallData] = useState<any>(null);
  const [selectedSpan, setSelectedSpan] = useState<TraceSpan | null>(null);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchTraceList = async () => {
    try {
      let query = `/telemetry/traces?limit=30`;
      if (statusFilter !== 'ALL') query += `&status_code=${statusFilter}`;
      const res = await apiRequest(query);
      setTraces(res || []);
      if (res && res.length > 0) {
        const target = requestedTraceId || res[0].trace_id;
        setSelectedTraceId(target);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchTraceList();
  }, [statusFilter]);

  useEffect(() => {
    if (!selectedTraceId) return;
    setLoading(true);
    apiRequest(`/telemetry/traces/${selectedTraceId}`)
      .then((data) => {
        setWaterfallData(data);
        if (data.spans && data.spans.length > 0) {
          setSelectedSpan(data.spans[0]);
        }
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, [selectedTraceId]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <GitBranch className="w-5 h-5 text-emerald-600" />
          <span>Distributed Tracing & Waterfall Visualizer</span>
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          End-to-end request propagation, span timeline latency breakdown & failure localization
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Recent Traces List (1 col) */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-col h-[700px]">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Recent Traces</h3>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="border border-slate-200 rounded px-2 py-0.5 text-xs text-slate-600 bg-slate-50 focus:outline-none"
            >
              <option value="ALL">All Status</option>
              <option value="ERROR">Errors Only</option>
              <option value="OK">OK</option>
            </select>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {traces.map((t) => {
              const isSelected = t.trace_id === selectedTraceId;
              return (
                <div
                  key={t.trace_id}
                  onClick={() => setSelectedTraceId(t.trace_id)}
                  className={`p-3 rounded-lg cursor-pointer transition ${
                    isSelected ? 'bg-emerald-50/80 border border-emerald-200' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="font-semibold text-xs text-slate-900 truncate">
                      {t.root_span_name}
                    </span>
                    <span
                      className={`text-[9px] font-bold uppercase px-1.5 py-0.2 rounded ${
                        t.status_code === 'ERROR'
                          ? 'bg-rose-100 text-rose-700'
                          : 'bg-emerald-100 text-emerald-700'
                      }`}
                    >
                      {t.status_code}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <span className="font-mono text-cyan-600">{t.service_name}</span>
                    <span className="font-semibold">{Math.round(t.duration_ms)} ms</span>
                  </div>
                  <div className="text-[10px] font-mono text-slate-400 mt-1 truncate">
                    id: {t.trace_id}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Waterfall Span Visualizer (2 cols) */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col h-[700px]">
          {waterfallData ? (
            <div className="flex flex-col h-full">
              {/* Trace Header */}
              <div className="border-b border-slate-100 pb-4 mb-4 flex items-center justify-between">
                <div>
                  <div className="text-xs font-mono text-slate-400">Trace ID: {waterfallData.trace_id}</div>
                  <h2 className="text-sm font-bold text-slate-900 mt-0.5">
                    Waterfall Execution Graph ({waterfallData.total_spans} Spans)
                  </h2>
                </div>
                <div className="text-right">
                  <div className="text-[10px] uppercase font-bold text-slate-400">Total Duration</div>
                  <div className="text-base font-extrabold text-slate-900 font-mono">
                    {waterfallData.total_duration_ms.toFixed(1)} ms
                  </div>
                </div>
              </div>

              {/* Waterfall Spans Area */}
              <div className="flex-1 overflow-y-auto space-y-2.5 pr-2">
                {waterfallData.spans.map((s: TraceSpan) => {
                  const maxDuration = Math.max(waterfallData.total_duration_ms, 1);
                  const leftPct = (s.offset_ms / maxDuration) * 100;
                  const widthPct = Math.max((s.duration_ms / maxDuration) * 100, 3);
                  const isSelected = selectedSpan?.span_id === s.span_id;

                  return (
                    <div
                      key={s.span_id}
                      onClick={() => setSelectedSpan(s)}
                      className={`p-2.5 rounded-lg border cursor-pointer transition ${
                        isSelected
                          ? 'border-emerald-500 bg-emerald-50/20'
                          : 'border-slate-100 hover:border-slate-300 bg-slate-50/50'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              s.status_code === 'ERROR' ? 'bg-rose-500' : 'bg-emerald-500'
                            }`}
                          />
                          <span className="font-semibold text-slate-900">{s.name}</span>
                          <span className="text-[10px] font-mono text-cyan-600 px-1.5 py-0.2 rounded bg-cyan-50">
                            {s.service_name}
                          </span>
                        </div>
                        <span className="font-mono text-slate-600 text-[11px] font-semibold">
                          {s.duration_ms.toFixed(1)} ms
                        </span>
                      </div>

                      {/* Relative Gantt Duration Bar */}
                      <div className="w-full h-3 bg-slate-200/60 rounded-full relative overflow-hidden">
                        <div
                          className={`absolute top-0 bottom-0 rounded-full transition-all ${
                            s.status_code === 'ERROR' ? 'bg-rose-500' : 'bg-emerald-500'
                          }`}
                          style={{
                            left: `${Math.min(leftPct, 95)}%`,
                            width: `${Math.min(widthPct, 100 - leftPct)}%`,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Selected Span Details Card */}
              {selectedSpan && (
                <div className="mt-4 pt-4 border-t border-slate-100 bg-slate-50 p-4 rounded-xl text-xs">
                  <div className="font-bold text-slate-800 mb-2 flex items-center justify-between">
                    <span>Span Attributes: {selectedSpan.name}</span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${
                        selectedSpan.status_code === 'ERROR' ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'
                      }`}
                    >
                      {selectedSpan.status_code}
                    </span>
                  </div>
                  {selectedSpan.status_message && (
                    <div className="p-2 mb-2 bg-rose-50 border border-rose-200 rounded text-rose-700 font-mono text-[11px]">
                      Error: {selectedSpan.status_message}
                    </div>
                  )}
                  <pre className="font-mono text-[11px] text-slate-700 max-h-28 overflow-y-auto">
                    {JSON.stringify(selectedSpan.attributes, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          ) : (
            <div className="py-20 text-center text-slate-400">Select a trace to view waterfall tree.</div>
          )}
        </div>
      </div>
    </div>
  );
};
