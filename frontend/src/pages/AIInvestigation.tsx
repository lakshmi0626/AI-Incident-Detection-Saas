import React, { useState, useEffect } from 'react';
import { useSearchParams, NavLink } from 'react-router-dom';
import {
  BrainCircuit,
  RefreshCw,
  CheckCircle2,
  XCircle,
  HelpCircle,
  ShieldAlert,
  Code2,
  FileSearch,
  Sparkles,
  ArrowRight,
  Send,
  AlertTriangle,
  Layers
} from 'lucide-react';
import { apiRequest } from '../services/api';
import { Incident, AIAnalysis } from '../types';

export const AIInvestigation: React.FC = () => {
  const [searchParams] = useSearchParams();
  const requestedIncidentId = searchParams.get('incident_id');

  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [selectedIncidentId, setSelectedIncidentId] = useState<string>('');
  const [analysis, setAnalysis] = useState<AIAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [feedbackNotes, setFeedbackNotes] = useState('');
  const [verifiedCause, setVerifiedCause] = useState('');
  const [feedbackSuccess, setFeedbackSuccess] = useState<string | null>(null);

  // Load available incidents
  useEffect(() => {
    apiRequest('/incidents?limit=50').then((data) => {
      setIncidents(data || []);
      if (data && data.length > 0) {
        const targetId = requestedIncidentId || data[0].id;
        setSelectedIncidentId(targetId);
      }
    });
  }, [requestedIncidentId]);

  // Load AI analysis when incident changes
  useEffect(() => {
    if (!selectedIncidentId) return;
    loadAnalysis(false);
  }, [selectedIncidentId]);

  const loadAnalysis = async (force: boolean) => {
    setLoading(true);
    setFeedbackSuccess(null);
    try {
      const endpoint = force
        ? `/ai/investigate/${selectedIncidentId}?force_refresh=true`
        : `/ai/investigate/${selectedIncidentId}`;
      const res = await apiRequest(endpoint, { method: force ? 'POST' : 'GET' });
      setAnalysis(res);
      setVerifiedCause(res.verified_root_cause || '');
      setFeedbackNotes(res.feedback_notes || '');
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleFeedback = async (status: 'correct' | 'incorrect' | 'unresolved') => {
    if (!analysis) return;
    try {
      const res = await apiRequest(`/ai/feedback/${analysis.id}`, {
        method: 'POST',
        body: JSON.stringify({
          feedback_status: status,
          verified_root_cause: verifiedCause,
          feedback_notes: feedbackNotes,
        }),
      });
      setFeedbackSuccess(res.message);
      setAnalysis({
        ...analysis,
        feedback_status: status,
        verified_root_cause: verifiedCause,
        feedback_notes: feedbackNotes,
      });
    } catch (err: any) {
      alert(`Error submitting feedback: ${err.message}`);
    }
  };

  const selectedIncident = incidents.find((i) => i.id === selectedIncidentId);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <BrainCircuit className="w-5 h-5 text-emerald-600" />
            <span>AI Root-Cause Investigation Console</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Automated multi-telemetry synthesis, hypothesis evaluation, code-level diffs & verified feedback loop
          </p>
        </div>

        {/* Incident Selector Dropdown */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-slate-700">Target Incident:</label>
          <select
            value={selectedIncidentId}
            onChange={(e) => setSelectedIncidentId(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900 bg-white font-medium focus:outline-none focus:border-emerald-500 max-w-xs truncate shadow-sm"
          >
            {incidents.map((i) => (
              <option key={i.id} value={i.id}>
                [{i.severity}] {i.title}
              </option>
            ))}
          </select>
          <button
            onClick={() => loadAnalysis(true)}
            disabled={loading}
            className="p-1.5 rounded-lg border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-semibold flex items-center gap-1 shadow-sm disabled:opacity-50"
            title="Re-run AI Analysis"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Mandatory Safety Guardrail Notice */}
      <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center gap-2.5">
        <ShieldAlert className="w-4 h-4 text-amber-600 flex-shrink-0" />
        <div>
          <span className="font-bold">Human-in-the-Loop SRE Guardrail:</span> AI-generated hypotheses and code diffs
          are advisory and must be verified by an engineer. IncidentIQ never executes automated remediation in production.
        </div>
      </div>

      {loading ? (
        <div className="p-16 text-center bg-white rounded-2xl border border-slate-200 shadow-sm space-y-3">
          <BrainCircuit className="w-8 h-8 text-emerald-500 animate-bounce mx-auto" />
          <div className="text-sm font-bold text-slate-800">Synthesizing Telemetry & Correlating Events...</div>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Analyzing stack traces, metric latency spikes, and distributed spans to generate structured hypotheses.
          </p>
        </div>
      ) : analysis ? (
        <div className="space-y-6">
          {/* Executive Diagnosis Card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4 mb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200 uppercase tracking-wider">
                    {analysis.model_name}
                  </span>
                  <span className="text-xs text-slate-400 font-mono">Incident #{selectedIncidentId.slice(0, 8)}</span>
                </div>
                <h2 className="text-base font-bold text-slate-900 leading-snug">{analysis.summary}</h2>
              </div>

              {/* Confidence Score Gauge */}
              <div className="flex items-center gap-3 bg-slate-50 px-4 py-2.5 rounded-xl border border-slate-200">
                <div className="text-right">
                  <div className="text-[10px] uppercase font-bold text-slate-400">Diagnosis Confidence</div>
                  <div className="text-lg font-extrabold text-emerald-600">
                    {Math.round(analysis.confidence_score * 100)}%
                  </div>
                </div>
                <div className="w-10 h-10 rounded-full border-4 border-emerald-500 border-t-slate-200 flex items-center justify-center font-bold text-xs text-slate-700">
                  <Sparkles className="w-4 h-4 text-emerald-500" />
                </div>
              </div>
            </div>

            {/* Root Cause Hypothesis */}
            <div>
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-1.5">
                Root-Cause Hypothesis
              </h4>
              <p className="text-xs text-slate-700 leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-200 font-sans">
                {analysis.root_cause_hypothesis}
              </p>
            </div>
          </div>

          {/* Grid: Supporting Evidence & Alternative Causes */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Supporting Evidence Items (2 cols) */}
            <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm p-5">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3 flex items-center gap-2">
                <FileSearch className="w-4 h-4 text-cyan-600" />
                <span>Supporting Telemetry Evidence</span>
              </h3>
              <div className="space-y-3">
                {analysis.supporting_evidence.map((ev, idx) => (
                  <div key={idx} className="p-3 rounded-lg border border-slate-200 bg-slate-50/50 text-xs">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-slate-900">{ev.title}</span>
                      <span className="uppercase text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-200 text-slate-700">
                        {ev.type}
                      </span>
                    </div>
                    <pre className="font-mono text-[11px] text-slate-700 whitespace-pre-wrap break-all bg-white p-2 rounded border border-slate-200 mt-1">
                      {ev.snippet}
                    </pre>
                  </div>
                ))}
              </div>
            </div>

            {/* Alternative Causes & Ruled Out (1 col) */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3">
                Alternative Causes Considered
              </h3>
              <p className="text-[11px] text-slate-500 mb-3">
                Secondary factors ruled out by correlating trace timestamps.
              </p>
              <ul className="space-y-2 text-xs">
                {analysis.alternative_causes.map((c, i) => (
                  <li key={i} className="p-2.5 rounded-lg bg-slate-50 text-slate-700 border border-slate-100 flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400 mt-1.5 flex-shrink-0" />
                    <span>{c}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Recommended Troubleshooting Steps & Code Fix Diff */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Steps & Verification */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
              <div>
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                  Recommended Diagnostic Steps
                </h3>
                <ol className="space-y-2 text-xs">
                  {analysis.recommended_steps.map((s, i) => (
                    <li key={i} className="p-2 rounded-lg bg-slate-50 border border-slate-100 text-slate-800 font-medium flex items-start gap-2">
                      <span className="text-emerald-600 font-bold">{i + 1}.</span>
                      <span>{s}</span>
                    </li>
                  ))}
                </ol>
              </div>

              <div>
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                  Verification Checklist
                </h3>
                <ul className="space-y-1.5 text-xs">
                  {analysis.verification_steps.map((v, i) => (
                    <li key={i} className="flex items-center gap-2 text-slate-700">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                      <span>{v}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Code Fix Diff */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                    <Code2 className="w-4 h-4 text-emerald-600" />
                    <span>Suggested Code / Config Fix</span>
                  </h3>
                  <span className="text-[10px] text-slate-400 font-mono">Unified Git Patch</span>
                </div>
                <p className="text-[11px] text-slate-500 mb-3">
                  Recommended configuration or repository modification to mitigate this failure mode permanently.
                </p>

                {analysis.code_fix_diff ? (
                  <pre className="p-3 rounded-lg bg-slate-900 text-emerald-300 font-mono text-[11px] overflow-x-auto leading-relaxed border border-slate-800 max-h-64">
                    {analysis.code_fix_diff}
                  </pre>
                ) : (
                  <div className="p-4 rounded bg-slate-50 text-xs text-slate-500">
                    No code diff generated for this incident type.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Human Feedback Loop Card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-1">
              Engineer Verification & Model Feedback Loop
            </h3>
            <p className="text-[11px] text-slate-500 mb-4">
              Recording verified root causes improves accuracy of recurring failure pattern clustering.
            </p>

            <div className="flex flex-wrap items-center gap-3 mb-4">
              <span className="text-xs font-semibold text-slate-700">Current Diagnosis Status:</span>
              <span className={`px-2.5 py-1 rounded text-xs font-bold uppercase ${
                analysis.feedback_status === 'correct'
                  ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                  : analysis.feedback_status === 'incorrect'
                  ? 'bg-rose-100 text-rose-700 border border-rose-200'
                  : 'bg-slate-100 text-slate-600'
              }`}>
                {analysis.feedback_status}
              </span>

              <div className="flex items-center gap-2 ml-auto">
                <button
                  onClick={() => handleFeedback('correct')}
                  className="px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold border border-emerald-200 flex items-center gap-1.5 transition"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Mark as Correct</span>
                </button>
                <button
                  onClick={() => handleFeedback('incorrect')}
                  className="px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold border border-rose-200 flex items-center gap-1.5 transition"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  <span>Mark as Incorrect</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Verified Root Cause (if confirmed by engineering team):
                </label>
                <input
                  type="text"
                  value={verifiedCause}
                  onChange={(e) => setVerifiedCause(e.target.value)}
                  placeholder="e.g., Unindexed customer_id query locked orders table under 120 RPS"
                  className="w-full border border-slate-200 rounded-lg p-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Resolution Notes & PR Reference:
                </label>
                <input
                  type="text"
                  value={feedbackNotes}
                  onChange={(e) => setFeedbackNotes(e.target.value)}
                  placeholder="e.g., Fixed in PR #412. Increased maximumPoolSize to 30."
                  className="w-full border border-slate-200 rounded-lg p-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            {feedbackSuccess && (
              <div className="mt-3 p-3 rounded-lg bg-emerald-50 text-emerald-800 text-xs font-medium border border-emerald-200 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>{feedbackSuccess}</span>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="p-12 text-center bg-white rounded-xl border border-slate-200 text-slate-500">
          No incident selected.
        </div>
      )}
    </div>
  );
};
