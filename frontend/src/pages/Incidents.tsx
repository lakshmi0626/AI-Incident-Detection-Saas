import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import {
  AlertTriangle,
  Plus,
  Filter,
  Search,
  BrainCircuit,
  Clock,
  ArrowRight,
  Flame,
  User,
  X,
  CheckCircle2
} from 'lucide-react';
import { apiRequest } from '../services/api';
import { Incident, Severity, IncidentStatus } from '../types';

export const Incidents: React.FC = () => {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Form
  const [title, setTitle] = useState('');
  const [serviceName, setServiceName] = useState('payment-gateway');
  const [severity, setSeverity] = useState<Severity>('High');
  const [description, setDescription] = useState('');
  const [apps, setApps] = useState<any[]>([]);
  const [selectedAppId, setSelectedAppId] = useState('');

  const fetchIncidents = async () => {
    try {
      let query = `/incidents?limit=100`;
      if (severityFilter !== 'ALL') query += `&severity=${severityFilter}`;
      if (statusFilter !== 'ALL') query += `&status=${statusFilter}`;
      if (searchQuery) query += `&search=${encodeURIComponent(searchQuery)}`;

      const data = await apiRequest(query);
      setIncidents(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIncidents();
    apiRequest('/applications').then((data) => {
      setApps(data || []);
      if (data && data.length > 0) setSelectedAppId(data[0].id);
    }).catch(() => {});
  }, [severityFilter, statusFilter, searchQuery]);

  const handleCreateIncident = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/incidents', {
        method: 'POST',
        body: JSON.stringify({
          application_id: selectedAppId,
          title,
          service_name: serviceName,
          severity,
          description,
        }),
      });
      setShowCreateModal(false);
      setTitle('');
      setDescription('');
      fetchIncidents();
    } catch (err: any) {
      alert(`Error creating incident: ${err.message}`);
    }
  };

  const handleQuickStatus = async (e: React.MouseEvent, incId: string, newStatus: string) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await apiRequest(`/incidents/${incId}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status: newStatus }),
      });
      fetchIncidents();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Incident Management</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Automated threshold triggers, alert deduplication, lifecycle transitions & AI root-cause triage
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs shadow-sm transition"
        >
          <Plus className="w-4 h-4" />
          <span>Report Incident</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2 w-full md:w-80">
          <div className="relative w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search title, fingerprint or service..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <Filter className="w-3.5 h-3.5" />
            <span>Severity:</span>
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="border border-slate-200 rounded-lg px-2 py-1 text-xs text-slate-700 bg-slate-50 focus:outline-none"
            >
              <option value="ALL">All Severities</option>
              <option value="Critical">Critical</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <span>Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="border border-slate-200 rounded-lg px-2 py-1 text-xs text-slate-700 bg-slate-50 focus:outline-none"
            >
              <option value="ALL">All Statuses</option>
              <option value="Triggered">Triggered</option>
              <option value="Acknowledged">Acknowledged</option>
              <option value="Investigating">Investigating</option>
              <option value="Mitigated">Mitigated</option>
              <option value="Resolved">Resolved</option>
              <option value="Closed">Closed</option>
            </select>
          </div>
        </div>
      </div>

      {/* Incidents Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 border-b border-slate-100 font-semibold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-4">Severity</th>
                <th className="py-3 px-4">Title & Fingerprint</th>
                <th className="py-3 px-4">Service</th>
                <th className="py-3 px-4">Status & Quick Action</th>
                <th className="py-3 px-4">Assignee</th>
                <th className="py-3 px-4">AI Diagnosis</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {incidents.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    No matching incidents found.
                  </td>
                </tr>
              ) : (
                incidents.map((inc) => (
                  <tr key={inc.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3 px-4 whitespace-nowrap">
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
                    <td className="py-3 px-4">
                      <NavLink
                        to={`/incidents/${inc.id}`}
                        className="font-bold text-slate-900 hover:text-emerald-600 block line-clamp-1"
                      >
                        {inc.title}
                      </NavLink>
                      <div className="text-[10px] font-mono text-slate-400 mt-0.5 truncate max-w-xs">
                        fp: {inc.fingerprint}
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-600">
                      {inc.service_name}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
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
                        {inc.status === 'Triggered' && (
                          <button
                            onClick={(e) => handleQuickStatus(e, inc.id, 'Acknowledged')}
                            className="text-[10px] text-emerald-600 hover:underline font-medium"
                          >
                            Ack
                          </button>
                        )}
                        {inc.status === 'Acknowledged' && (
                          <button
                            onClick={(e) => handleQuickStatus(e, inc.id, 'Investigating')}
                            className="text-[10px] text-cyan-600 hover:underline font-medium"
                          >
                            Investigate
                          </button>
                        )}
                        {(inc.status === 'Investigating' || inc.status === 'Mitigated') && (
                          <button
                            onClick={(e) => handleQuickStatus(e, inc.id, 'Resolved')}
                            className="text-[10px] text-emerald-600 hover:underline font-medium"
                          >
                            Resolve
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-600 text-[11px]">
                      {inc.assignee_name || (
                        <span className="text-slate-400 italic">Unassigned</span>
                      )}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <NavLink
                        to={`/ai-investigation?incident_id=${inc.id}`}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-[11px] font-semibold border border-emerald-200 transition"
                      >
                        <BrainCircuit className="w-3.5 h-3.5 text-emerald-600" />
                        <span>{inc.ai_status === 'verified' ? 'Verified Cause' : 'AI Hypotheses'}</span>
                      </NavLink>
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <NavLink
                        to={`/incidents/${inc.id}`}
                        className="font-semibold text-slate-700 hover:text-emerald-600 inline-flex items-center gap-1"
                      >
                        <span>Timeline</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </NavLink>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Manual Report Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h3 className="text-sm font-bold text-slate-900">Manually Report Incident</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateIncident} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Target Application</label>
                <select
                  value={selectedAppId}
                  onChange={(e) => setSelectedAppId(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-500"
                >
                  {apps.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Incident Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., PostgreSQL Deadlock on Order Checkout Table"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Affected Service</label>
                  <input
                    type="text"
                    required
                    value={serviceName}
                    onChange={(e) => setServiceName(e.target.value)}
                    placeholder="payment-gateway"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Severity</label>
                  <select
                    value={severity}
                    onChange={(e) => setSeverity(e.target.value as Severity)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="Critical">Critical</option>
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Description & Initial Symptoms</label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Observed error logs, customer complaints, or telemetry spikes"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition"
              >
                Create Incident & Trigger AI Triage
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
