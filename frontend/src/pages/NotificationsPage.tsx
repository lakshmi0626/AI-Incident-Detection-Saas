import React, { useState, useEffect } from 'react';
import { Bell, Plus, CheckCircle2, Send, Trash2, Mail, MessageSquare, Zap, X, ShieldAlert } from 'lucide-react';
import { apiRequest } from '../services/api';
import { NotificationItem, NotificationChannel } from '../types';

export const NotificationsPage: React.FC = () => {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [channels, setChannels] = useState<NotificationChannel[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  // Form
  const [channelType, setChannelType] = useState<'slack' | 'teams' | 'email'>('slack');
  const [channelName, setChannelName] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [recipients, setRecipients] = useState('');

  const loadData = async () => {
    try {
      const [notifsData, channelsData] = await Promise.all([
        apiRequest('/notifications?limit=30'),
        apiRequest('/notifications/channels'),
      ]);
      setNotifications(notifsData || []);
      setChannels(channelsData || []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const config: Record<string, any> = {};
      if (channelType === 'slack' || channelType === 'teams') {
        config.webhook_url = webhookUrl;
      } else {
        config.recipients = recipients;
      }

      await apiRequest('/notifications/channels', {
        method: 'POST',
        body: JSON.stringify({
          channel_type: channelType,
          name: channelName,
          config,
        }),
      });

      setShowAddModal(false);
      setChannelName('');
      setWebhookUrl('');
      setRecipients('');
      loadData();
    } catch (err: any) {
      alert(`Error adding channel: ${err.message}`);
    }
  };

  const handleTestChannel = async (channelId: string) => {
    setTestResult(null);
    try {
      const res = await apiRequest(`/notifications/channels/${channelId}/test`, { method: 'POST' });
      setTestResult(`${res.channel}: ${res.mode} - ${res.message}`);
      loadData();
    } catch (err: any) {
      alert(`Test failed: ${err.message}`);
    }
  };

  const handleDeleteChannel = async (channelId: string) => {
    if (!confirm('Remove this notification integration?')) return;
    try {
      await apiRequest(`/notifications/channels/${channelId}`, { method: 'DELETE' });
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Bell className="w-5 h-5 text-emerald-600" />
            <span>Notification Center & Alert Integrations</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure incident routing rules to Slack webhooks, Microsoft Teams, and email on-call distribution
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition shadow-sm"
        >
          <Plus className="w-4 h-4" />
          <span>Add Alert Channel</span>
        </button>
      </div>

      {testResult && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>{testResult}</span>
          </div>
          <button onClick={() => setTestResult(null)} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Alert Channels Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {channels.map((ch) => (
          <div
            key={ch.id}
            className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex flex-col justify-between"
          >
            <div>
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700">
                    {ch.channel_type === 'slack' ? (
                      <MessageSquare className="w-4 h-4 text-emerald-600" />
                    ) : ch.channel_type === 'teams' ? (
                      <Zap className="w-4 h-4 text-blue-600" />
                    ) : (
                      <Mail className="w-4 h-4 text-cyan-600" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-900">{ch.name}</h3>
                    <span className="text-[10px] uppercase font-bold text-slate-400">{ch.channel_type}</span>
                  </div>
                </div>
                <button
                  onClick={() => handleDeleteChannel(ch.id)}
                  className="text-slate-400 hover:text-rose-600 p-1"
                  title="Delete Channel"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="text-[11px] font-mono text-slate-500 bg-slate-50 p-2.5 rounded border border-slate-100 truncate">
                {ch.config.webhook_url || ch.config.recipients || 'Webhook configured'}
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
              <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500" /> Active
              </span>
              <button
                onClick={() => handleTestChannel(ch.id)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition"
              >
                <Send className="w-3 h-3" />
                <span>Test Alert</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* In-App Notifications History */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
            In-App Alert Activity Feed
          </h3>
          <span className="text-[11px] text-slate-400">Past 30 alerts</span>
        </div>
        <div className="divide-y divide-slate-100">
          {notifications.map((n) => (
            <div key={n.id} className="p-3.5 hover:bg-slate-50 transition flex items-start gap-3">
              <span
                className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase mt-0.5 ${
                  n.severity === 'Critical'
                    ? 'bg-rose-100 text-rose-700'
                    : 'bg-amber-100 text-amber-700'
                }`}
              >
                {n.severity}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-xs text-slate-900 truncate">{n.title}</span>
                  <span className="text-[10px] text-slate-400 font-mono whitespace-nowrap">
                    {new Date(n.created_at).toLocaleTimeString()}
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 mt-0.5">{n.message}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Add Alert Channel Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h3 className="text-sm font-bold text-slate-900">Configure Alert Channel</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateChannel} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Integration Type</label>
                <select
                  value={channelType}
                  onChange={(e) => setChannelType(e.target.value as any)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-500"
                >
                  <option value="slack">Slack Webhook</option>
                  <option value="teams">Microsoft Teams Webhook</option>
                  <option value="email">Email Alert Distribution</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Channel Label</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., #production-incidents or SRE On-Call"
                  value={channelName}
                  onChange={(e) => setChannelName(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-500"
                />
              </div>

              {channelType === 'email' ? (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Email Recipient(s)</label>
                  <input
                    type="email"
                    required
                    placeholder="sre-alerts@company.internal"
                    value={recipients}
                    onChange={(e) => setRecipients(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Incoming Webhook URL</label>
                  <input
                    type="url"
                    required
                    placeholder="https://hooks.slack.com/services/..."
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              )}

              <button
                type="submit"
                className="w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition"
              >
                Save Notification Channel
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
