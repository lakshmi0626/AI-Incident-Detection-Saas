import React, { useState, useEffect } from 'react';
import { Bell, Flame, CheckCircle, RefreshCw, X, Play, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { apiRequest } from '../../services/api';
import { NotificationItem } from '../../types';

export const Navbar: React.FC = () => {
  const { currentOrg } = useAuth();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showSimulatorModal, setShowSimulatorModal] = useState(false);
  const [simulatorStatus, setSimulatorStatus] = useState<string | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);

  const fetchNotifications = async () => {
    try {
      const data = await apiRequest('/notifications?unread_only=false&limit=8');
      setNotifications(data || []);
    } catch {}
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 15000);
    return () => clearInterval(interval);
  }, [currentOrg]);

  const unreadCount = notifications.filter((n) => n.status === 'unread').length;

  const triggerScenario = async (scenarioId: string) => {
    setIsSimulating(true);
    setSimulatorStatus('Injecting telemetry anomaly...');
    try {
      const res = await apiRequest('/simulator/trigger', {
        method: 'POST',
        body: JSON.stringify({ scenario_id: scenarioId }),
      });
      setSimulatorStatus(res.message);
      fetchNotifications();
      setTimeout(() => {
        setIsSimulating(false);
      }, 1500);
    } catch (err: any) {
      setSimulatorStatus(`Error: ${err.message}`);
      setIsSimulating(false);
    }
  };

  const markAllRead = async () => {
    try {
      await apiRequest('/notifications/mark-all-read', { method: 'PUT' });
      fetchNotifications();
    } catch {}
  };

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between z-20 sticky top-0 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
          <span>Organization:</span>
          <span className="font-semibold text-slate-800">{currentOrg?.name || 'Default Org'}</span>
          <span className="text-slate-300">/</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 uppercase tracking-wider border border-slate-200">
            {currentOrg?.plan_tier || 'Starter'} Tier
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Real-time Simulator Action Button */}
        <button
          onClick={() => setShowSimulatorModal(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 transition shadow-sm"
        >
          <Flame className="w-4 h-4 text-rose-600 animate-pulse" />
          <span>Simulate Incident</span>
        </button>

        {/* System Health Status Indicator */}
        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
          <span>Detection Engine Active</span>
        </div>

        {/* In-App Notifications Center */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="p-2 rounded-lg text-slate-600 hover:bg-slate-100 relative transition"
            title="Notifications"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center">
                {unreadCount}
              </span>
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 top-12 w-80 sm:w-96 bg-white border border-slate-200 rounded-xl shadow-2xl py-2 z-50">
              <div className="px-4 py-2 border-b border-slate-100 flex items-center justify-between">
                <div className="font-semibold text-xs text-slate-800">
                  Notification Center ({unreadCount} unread)
                </div>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllRead}
                    className="text-[11px] text-emerald-600 hover:text-emerald-700 font-medium"
                  >
                    Mark all read
                  </button>
                )}
              </div>
              <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                {notifications.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-400">No notifications yet.</div>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      className={`p-3 text-xs transition ${
                        n.status === 'unread' ? 'bg-slate-50/80 font-medium' : 'text-slate-600'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="font-semibold text-slate-900 truncate">{n.title}</span>
                        <span
                          className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
                            n.severity === 'Critical'
                              ? 'bg-rose-100 text-rose-700'
                              : 'bg-amber-100 text-amber-700'
                          }`}
                        >
                          {n.severity}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 line-clamp-2">{n.message}</p>
                      <span className="text-[10px] text-slate-400 mt-1 block">
                        {new Date(n.created_at).toLocaleTimeString()}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Simulator Modal Dialog */}
      {showSimulatorModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2">
                <Flame className="w-5 h-5 text-rose-600" />
                <h3 className="text-sm font-bold text-slate-900">Live Incident & Telemetry Simulator</h3>
              </div>
              <button
                onClick={() => {
                  setShowSimulatorModal(false);
                  setSimulatorStatus(null);
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-xs text-slate-600">
                Trigger real-time failure scenarios to test IncidentIQ's automated detection engine,
                multi-rule evaluation, deduplication, and AI root cause hypothesis generator.
              </p>

              <div className="space-y-2.5">
                {[
                  {
                    id: 'db_pool_timeout',
                    title: 'Database Connection Pool Exhaustion',
                    svc: 'payment-gateway',
                    desc: 'HikariCP saturation, 30s timeouts, SQLTransientConnectionException',
                    color: 'border-rose-200 hover:border-rose-400 bg-rose-50/30'
                  },
                  {
                    id: '500_cascade',
                    title: 'Unhandled NullPointerException 500 Storm',
                    svc: 'order-api',
                    desc: 'Checkout pipeline 68% error spike with transaction context loss',
                    color: 'border-amber-200 hover:border-amber-400 bg-amber-50/30'
                  },
                  {
                    id: 'memory_leak',
                    title: 'JVM Heap Exhaustion & OutOfMemoryError',
                    svc: 'inventory-service',
                    desc: '99% heap capacity with 4s Stop-The-World GC pauses',
                    color: 'border-purple-200 hover:border-purple-400 bg-purple-50/30'
                  },
                  {
                    id: 'auth_latency',
                    title: 'OAuth JWKS Latency Spike (>4500ms)',
                    svc: 'auth-service',
                    desc: 'Worker thread pool saturation and socket timeout degradation',
                    color: 'border-blue-200 hover:border-blue-400 bg-blue-50/30'
                  }
                ].map((s) => (
                  <div
                    key={s.id}
                    className={`p-3.5 rounded-xl border flex items-center justify-between transition ${s.color}`}
                  >
                    <div>
                      <div className="text-xs font-bold text-slate-900">{s.title}</div>
                      <div className="text-[11px] text-slate-500">Service: <span className="font-mono text-slate-700">{s.svc}</span></div>
                      <div className="text-[11px] text-slate-600 mt-0.5">{s.desc}</div>
                    </div>
                    <button
                      disabled={isSimulating}
                      onClick={() => triggerScenario(s.id)}
                      className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center gap-1.5 flex-shrink-0 disabled:opacity-50"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Inject</span>
                    </button>
                  </div>
                ))}
              </div>

              {simulatorStatus && (
                <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span>{simulatorStatus}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
