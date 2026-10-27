import React, { useState, useEffect } from 'react';
import { ShieldAlert, Search, Filter, Lock, Trash2, CheckCircle2, RefreshCw, Key, ShieldCheck } from 'lucide-react';
import { apiRequest } from '../services/api';
import { AuditLog } from '../types';
import { useAuth } from '../context/AuthContext';

export const SecurityAudit: React.FC = () => {
  const { currentOrg } = useAuth();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [retention, setRetention] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Redaction Live Tester State
  const [testText, setTestText] = useState(
    'Failed payment: Bearer eyJhbGciOiJIUzI1NiJ9.test and password: "SecretProdPassword123" card: 4111-2222-3333-4444 api_key: iq_live_9988776655443322'
  );
  const [redactedResult, setRedactedResult] = useState<any>(null);

  // Retention Form State
  const [logsDays, setLogsDays] = useState(30);
  const [metricsDays, setMetricsDays] = useState(90);
  const [tracesDays, setTracesDays] = useState(14);
  const [autoClean, setAutoClean] = useState(true);
  const [retentionMessage, setRetentionMessage] = useState<string | null>(null);

  // GDPR Modal State
  const [showGdprModal, setShowGdprModal] = useState(false);
  const [confirmPhrase, setConfirmPhrase] = useState('');
  const [gdprMessage, setGdprMessage] = useState<string | null>(null);

  const loadData = async () => {
    try {
      const [auditData, retData] = await Promise.all([
        apiRequest('/security/audit-logs?limit=50'),
        apiRequest('/security/retention'),
      ]);
      setLogs(auditData || []);
      setRetention(retData);
      if (retData) {
        setLogsDays(retData.logs_retention_days);
        setMetricsDays(retData.metrics_retention_days);
        setTracesDays(retData.traces_retention_days);
        setAutoClean(retData.auto_clean_enabled);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    testRedaction();
  }, []);

  const testRedaction = async () => {
    try {
      const res = await apiRequest('/security/redaction-preview', {
        method: 'POST',
        body: JSON.stringify({ text: testText }),
      });
      setRedactedResult(res);
    } catch (err: any) {
      console.error(err);
    }
  };

  const handleUpdateRetention = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/security/retention', {
        method: 'PUT',
        body: JSON.stringify({
          logs_retention_days: logsDays,
          metrics_retention_days: metricsDays,
          traces_retention_days: tracesDays,
          auto_clean_enabled: autoClean,
        }),
      });
      setRetentionMessage('Retention policies updated successfully.');
      loadData();
    } catch (err: any) {
      alert(`Error updating retention: ${err.message}`);
    }
  };

  const handleManualPurge = async () => {
    if (!confirm('Execute retention purge now? Historical records exceeding threshold days will be deleted.')) return;
    try {
      const res = await apiRequest('/security/retention/cleanup', { method: 'POST' });
      alert(`Retention Purge Executed!\n\nDeleted Logs: ${res.purged_records.logs}\nDeleted Metrics: ${res.purged_records.metrics}\nDeleted Spans: ${res.purged_records.traces}`);
      loadData();
    } catch (err: any) {
      alert(`Purge failed: ${err.message}`);
    }
  };

  const handleGdprDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiRequest('/security/gdpr-delete', {
        method: 'POST',
        body: JSON.stringify({ confirmation_phrase: confirmPhrase }),
      });
      setGdprMessage(res.message);
      setShowGdprModal(false);
      loadData();
    } catch (err: any) {
      alert(`GDPR request failed: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-emerald-600" />
            <span>Security, Audit Logs & Data Retention</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Immutable audit trail, real-time secret redaction engine, retention policies & GDPR compliance
          </p>
        </div>

        <button
          onClick={() => setShowGdprModal(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold border border-rose-200 transition"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>GDPR Data Erasure</span>
        </button>
      </div>

      {gdprMessage && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span>{gdprMessage}</span>
        </div>
      )}

      {/* Secret Redaction Engine Live Tester */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-emerald-600" />
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Secret Redaction Engine (Interactive Tester)
            </h3>
          </div>
          <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
            Zero-Leak Guard Active
          </span>
        </div>
        <p className="text-xs text-slate-600">
          Incoming logs, traces, and payloads are filtered prior to storage and before transmission to AI models.
          Test secret detection below with Bearer tokens, passwords, database passwords, credit cards, and API keys.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">
              Sample Raw Log Input:
            </label>
            <textarea
              rows={4}
              value={testText}
              onChange={(e) => setTestText(e.target.value)}
              className="w-full font-mono text-[11px] border border-slate-300 rounded-lg p-3 text-slate-800 focus:outline-none focus:border-emerald-500 bg-slate-50"
            />
            <button
              onClick={testRedaction}
              className="mt-2 px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition"
            >
              Test Redaction Engine
            </button>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">
              Sanitized Output (Safe for AI & Storage):
            </label>
            <div className="p-3 rounded-lg bg-slate-950 font-mono text-[11px] text-emerald-400 border border-slate-800 min-h-[96px] break-all whitespace-pre-wrap">
              {redactedResult?.redacted_text || 'Testing...'}
            </div>
            {redactedResult?.detected_secrets?.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {redactedResult.detected_secrets.map((s: string, idx: number) => (
                  <span
                    key={idx}
                    className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold"
                  >
                    ✓ Masked {s}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Retention Policies Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
            Data Retention & Purge Policies
          </h3>
          <button
            onClick={handleManualPurge}
            className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold border border-slate-200 transition"
          >
            Run Immediate Purge
          </button>
        </div>

        {retentionMessage && (
          <div className="p-3 mb-3 rounded-lg bg-emerald-50 text-emerald-800 text-xs font-medium">
            {retentionMessage}
          </div>
        )}

        <form onSubmit={handleUpdateRetention} className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Logs Retention</label>
            <div className="flex items-center gap-1">
              <input
                type="number"
                min={1}
                max={365}
                value={logsDays}
                onChange={(e) => setLogsDays(parseInt(e.target.value))}
                className="w-full border border-slate-300 rounded-lg p-2 text-xs text-slate-900"
              />
              <span className="text-xs text-slate-500">days</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Metrics Retention</label>
            <div className="flex items-center gap-1">
              <input
                type="number"
                min={1}
                max={730}
                value={metricsDays}
                onChange={(e) => setMetricsDays(parseInt(e.target.value))}
                className="w-full border border-slate-300 rounded-lg p-2 text-xs text-slate-900"
              />
              <span className="text-xs text-slate-500">days</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Traces Retention</label>
            <div className="flex items-center gap-1">
              <input
                type="number"
                min={1}
                max={90}
                value={tracesDays}
                onChange={(e) => setTracesDays(parseInt(e.target.value))}
                className="w-full border border-slate-300 rounded-lg p-2 text-xs text-slate-900"
              />
              <span className="text-xs text-slate-500">days</span>
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition"
          >
            Update Retention
          </button>
        </form>
      </div>

      {/* Immutable Audit Logs Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
            Organization Audit Trail ({logs.length} entries)
          </h3>
          <span className="text-[11px] text-slate-400">All authentication, member & incident mutations</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 border-b border-slate-100 font-semibold uppercase text-[10px]">
              <tr>
                <th className="py-2.5 px-4">Action</th>
                <th className="py-2.5 px-4">Actor</th>
                <th className="py-2.5 px-4">Resource</th>
                <th className="py-2.5 px-4">Details</th>
                <th className="py-2.5 px-4">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {logs.map((al) => (
                <tr key={al.id} className="hover:bg-slate-50 transition">
                  <td className="py-2.5 px-4">
                    <span className="font-mono text-emerald-700 font-semibold text-[11px]">
                      {al.action}
                    </span>
                  </td>
                  <td className="py-2.5 px-4 text-slate-700 font-medium">
                    {al.user_email || 'System'}
                  </td>
                  <td className="py-2.5 px-4 capitalize text-slate-600">
                    {al.resource_type}
                  </td>
                  <td className="py-2.5 px-4 font-mono text-[10px] text-slate-500 max-w-xs truncate">
                    {JSON.stringify(al.details)}
                  </td>
                  <td className="py-2.5 px-4 text-slate-400 text-[11px] whitespace-nowrap">
                    {new Date(al.created_at).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* GDPR Modal */}
      {showGdprModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-rose-50/50">
              <h3 className="text-sm font-bold text-rose-900 flex items-center gap-2">
                <Trash2 className="w-4 h-4 text-rose-600" />
                <span>GDPR Permanent Data Erasure Request</span>
              </h3>
            </div>
            <form onSubmit={handleGdprDelete} className="p-6 space-y-4">
              <p className="text-xs text-slate-600 leading-relaxed">
                This will permanently delete all historical telemetry logs, metrics, distributed traces, and
                incidents for <span className="font-bold text-slate-900">{currentOrg?.name}</span>. This action is irreversible.
              </p>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Type <span className="font-bold text-rose-600">{currentOrg?.name}</span> to confirm:
                </label>
                <input
                  type="text"
                  required
                  value={confirmPhrase}
                  onChange={(e) => setConfirmPhrase(e.target.value)}
                  placeholder={currentOrg?.name}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-rose-500"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowGdprModal(false)}
                  className="flex-1 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={confirmPhrase.trim().toLowerCase() !== currentOrg?.name?.trim().toLowerCase()}
                  className="flex-1 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs transition disabled:opacity-40"
                >
                  Permanently Purge
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
