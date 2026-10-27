import React, { useState, useEffect } from 'react';
import { useParams, NavLink } from 'react-router-dom';
import {
  AlertTriangle,
  BrainCircuit,
  Clock,
  ArrowLeft,
  CheckCircle2,
  User,
  Send,
  Download,
  Shield,
  Layers,
  Activity,
  FileText
} from 'lucide-react';
import { apiRequest } from '../services/api';
import { Incident, IncidentEvent, IncidentComment, User as UserType } from '../types';

export const IncidentDetails: React.FC = () => {
  const { incidentId } = useParams<{ incidentId: string }>();
  const [incident, setIncident] = useState<Incident | null>(null);
  const [events, setEvents] = useState<IncidentEvent[]>([]);
  const [comments, setComments] = useState<IncidentComment[]>([]);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [commentText, setCommentText] = useState('');
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      const [incData, eventsData, membersData] = await Promise.all([
        apiRequest(`/incidents/${incidentId}`),
        apiRequest(`/incidents/${incidentId}/timeline`),
        apiRequest('/organizations/current/members'),
      ]);
      setIncident(incData);
      setEvents(eventsData || []);
      setTeamMembers(membersData || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [incidentId]);

  const handleStatusTransition = async (newStatus: string) => {
    try {
      const res = await apiRequest(`/incidents/${incidentId}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status: newStatus }),
      });
      loadData();
    } catch (err: any) {
      alert(`Error updating status: ${err.message}`);
    }
  };

  const handleAssign = async (userId: string) => {
    try {
      await apiRequest(`/incidents/${incidentId}/assign`, {
        method: 'PUT',
        body: JSON.stringify({ user_id: userId || null }),
      });
      loadData();
    } catch (err: any) {
      alert(`Error assigning incident: ${err.message}`);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    try {
      await apiRequest(`/incidents/${incidentId}/comments`, {
        method: 'POST',
        body: JSON.stringify({ content: commentText }),
      });
      setCommentText('');
      loadData();
    } catch (err: any) {
      alert(`Error adding note: ${err.message}`);
    }
  };

  const handleDownloadReport = async () => {
    try {
      const token = localStorage.getItem('incidentiq_token');
      const orgId = localStorage.getItem('incidentiq_org_id');
      const res = await fetch(`/api/v1/incidents/${incidentId}/report?format=markdown`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Organization-Id': orgId || '',
        },
      });
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `incident-${incidentId?.slice(0, 8)}-postmortem.md`;
      a.click();
    } catch (err: any) {
      alert(`Failed to download report: ${err.message}`);
    }
  };

  if (!incident && !loading) {
    return <div className="p-8 text-center text-slate-500">Incident not found.</div>;
  }

  return (
    <div className="space-y-6">
      {/* Back button & Action Header */}
      <div>
        <NavLink
          to="/incidents"
          className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 font-medium mb-3"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to All Incidents</span>
        </NavLink>

        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5">
              <span
                className={`px-2.5 py-0.5 rounded text-xs font-bold uppercase ${
                  incident?.severity === 'Critical'
                    ? 'bg-rose-100 text-rose-700 border border-rose-200'
                    : incident?.severity === 'High'
                    ? 'bg-amber-100 text-amber-700 border border-amber-200'
                    : 'bg-blue-100 text-blue-700 border border-blue-200'
                }`}
              >
                {incident?.severity}
              </span>
              <span className="font-mono text-xs text-slate-500">Service: {incident?.service_name}</span>
              <span className="text-slate-300">•</span>
              <span className="text-xs text-slate-500">Env: {incident?.environment}</span>
            </div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">{incident?.title}</h1>
            <p className="text-xs text-slate-600 max-w-2xl">{incident?.description}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <NavLink
              to={`/ai-investigation?incident_id=${incident?.id}`}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-sm transition"
            >
              <BrainCircuit className="w-4 h-4" />
              <span>AI Root Cause Analysis</span>
            </NavLink>

            <button
              onClick={handleDownloadReport}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition border border-slate-200"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Report</span>
            </button>
          </div>
        </div>
      </div>

      {/* Lifecycle Status & Assignee Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        {/* Status transition pipeline */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 w-full md:w-auto">
          {['Triggered', 'Acknowledged', 'Investigating', 'Mitigated', 'Resolved', 'Closed'].map((s) => {
            const isCurrent = incident?.status === s;
            return (
              <button
                key={s}
                onClick={() => handleStatusTransition(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  isCurrent
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                {s}
              </button>
            );
          })}
        </div>

        {/* Assignee Picker */}
        <div className="flex items-center gap-2 text-xs text-slate-600">
          <User className="w-4 h-4 text-slate-400" />
          <span className="font-medium">Assigned Engineer:</span>
          <select
            value={incident?.assigned_to_user_id || ''}
            onChange={(e) => handleAssign(e.target.value)}
            className="border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-800 bg-slate-50 focus:outline-none"
          >
            <option value="">Unassigned</option>
            {teamMembers.map((m) => (
              <option key={m.user_id} value={m.user_id}>
                {m.full_name} ({m.role})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Grid: Timeline and Investigation Notes */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chronological Event Timeline (2 cols) */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-5 border-b border-slate-100 pb-3">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Clock className="w-4 h-4 text-emerald-600" />
              <span>Incident Lifecycle Timeline ({events.length} Events)</span>
            </h3>
            <span className="text-[11px] text-slate-400 font-mono">
              MTTD: {incident?.mttd_seconds || 35}s | MTTR: {incident?.mttr_seconds ? `${Math.round(incident.mttr_seconds / 60)}m` : 'In Progress'}
            </span>
          </div>

          <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
            {events.map((ev) => (
              <div key={ev.id} className="relative group">
                <span className="absolute -left-6 top-1 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white ring-2 ring-slate-200" />
                <div className="text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-slate-900">{ev.actor_name}</span>
                    <span className="text-[11px] text-slate-400 font-mono">
                      {new Date(ev.created_at).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="text-slate-600 mt-0.5 text-[11px] leading-relaxed">{ev.message}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Investigation Notes & Discussion Thread (1 col) */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex flex-col justify-between">
          <div>
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3">
              Engineer War Room Notes
            </h3>
            <p className="text-[11px] text-slate-500 mb-4">
              Collaborative notes, remediation checkpoints, and communication logs.
            </p>

            <div className="space-y-3 max-h-72 overflow-y-auto mb-4">
              {comments.length === 0 ? (
                <div className="text-center py-6 text-xs text-slate-400">
                  No notes recorded yet. Add an update below.
                </div>
              ) : (
                comments.map((c) => (
                  <div key={c.id} className="p-3 rounded-lg bg-slate-50 border border-slate-100 text-xs">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-slate-800">{c.author_name}</span>
                      <span className="text-[10px] text-slate-400">{new Date(c.created_at).toLocaleTimeString()}</span>
                    </div>
                    <p className="text-slate-600 text-[11px]">{c.content}</p>
                  </div>
                ))
              )}
            </div>
          </div>

          <form onSubmit={handleAddComment} className="pt-3 border-t border-slate-100">
            <textarea
              rows={3}
              required
              placeholder="Record investigation findings or remediation steps..."
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              className="w-full border border-slate-200 rounded-lg p-2.5 text-xs text-slate-900 focus:outline-none focus:border-emerald-500 mb-2"
            />
            <button
              type="submit"
              className="w-full py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Post Investigation Note</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
