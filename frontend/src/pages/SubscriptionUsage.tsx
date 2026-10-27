import React, { useState, useEffect } from 'react';
import { CreditCard, Check, Zap, Sparkles, Shield, AlertTriangle, ArrowUpRight } from 'lucide-react';
import { apiRequest } from '../services/api';
import { SubscriptionPlan, UsageQuota } from '../types';
import { useAuth } from '../context/AuthContext';

export const SubscriptionUsage: React.FC = () => {
  const { currentOrg, refreshProfile } = useAuth();
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [usage, setUsage] = useState<UsageQuota | null>(null);
  const [loading, setLoading] = useState(true);
  const [upgradingTier, setUpgradingTier] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const loadBillingData = async () => {
    try {
      const [plansData, usageData] = await Promise.all([
        apiRequest('/billing/plans'),
        apiRequest('/billing/usage'),
      ]);
      setPlans(plansData || []);
      setUsage(usageData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBillingData();
  }, [currentOrg]);

  const handleUpgrade = async (tier: string) => {
    setUpgradingTier(tier);
    setSuccessMessage(null);
    try {
      const res = await apiRequest('/billing/upgrade', {
        method: 'POST',
        body: JSON.stringify({ plan_tier: tier }),
      });
      setSuccessMessage(res.message);
      await refreshProfile();
      await loadBillingData();
    } catch (err: any) {
      alert(`Error updating plan: ${err.message}`);
    } finally {
      setUpgradingTier(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-emerald-600" />
            <span>Subscription & Entitlement Quotas</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            SaaS subscription tier, telemetry ingestion limits, AI investigation allowances & data retention
          </p>
        </div>
      </div>

      {successMessage && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Usage Gauges Card */}
      {usage && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
            <div>
              <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Current Period Consumption ({usage.period_ym})
              </span>
              <p className="text-[11px] text-slate-400">Monthly limits reset on the 1st of each calendar month</p>
            </div>
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase">
              {usage.plan_tier} Tier Active
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {/* Apps Quota */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="font-semibold text-slate-700">Monitored Applications</span>
                <span className="font-mono text-slate-900 font-bold">
                  {usage.apps_count} / {usage.max_apps}
                </span>
              </div>
              <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all"
                  style={{ width: `${Math.min((usage.apps_count / usage.max_apps) * 100, 100)}%` }}
                />
              </div>
              <span className="text-[10px] text-slate-400 mt-1 block">
                {usage.max_apps - usage.apps_count} remaining slots
              </span>
            </div>

            {/* Ingestion Quota */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="font-semibold text-slate-700">Monthly Telemetry Events</span>
                <span className="font-mono text-slate-900 font-bold">
                  {(usage.events_ingested / 1000).toFixed(1)}k / {(usage.max_monthly_events / 1000).toFixed(0)}k
                </span>
              </div>
              <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-cyan-500 rounded-full transition-all"
                  style={{ width: `${Math.min((usage.events_ingested / usage.max_monthly_events) * 100, 100)}%` }}
                />
              </div>
              <span className="text-[10px] text-slate-400 mt-1 block">
                Logs, metrics, and trace spans combined
              </span>
            </div>

            {/* AI Investigations Quota */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="font-semibold text-slate-700">AI Root-Cause Analyses</span>
                <span className="font-mono text-slate-900 font-bold">
                  {usage.ai_investigations_used} / {usage.max_ai_investigations_monthly}
                </span>
              </div>
              <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-purple-500 rounded-full transition-all"
                  style={{
                    width: `${Math.min(
                      (usage.ai_investigations_used / usage.max_ai_investigations_monthly) * 100,
                      100
                    )}%`,
                  }}
                />
              </div>
              <span className="text-[10px] text-slate-400 mt-1 block">
                Advisory SRE diagnostic executions
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Subscription Plans Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {plans.map((p) => {
          const isCurrent = usage?.plan_tier === p.tier;
          return (
            <div
              key={p.id}
              className={`bg-white rounded-2xl border p-6 flex flex-col justify-between transition shadow-sm ${
                isCurrent ? 'border-emerald-500 ring-2 ring-emerald-500/20' : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-bold text-slate-900 text-sm">{p.name}</h3>
                  {isCurrent && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 uppercase">
                      Current
                    </span>
                  )}
                </div>

                <div className="flex items-baseline gap-1 my-3">
                  <span className="text-3xl font-extrabold text-slate-900">${p.price_usd_monthly}</span>
                  <span className="text-xs text-slate-400">/ month</span>
                </div>

                <div className="space-y-2 text-xs text-slate-600 mb-6 border-t border-slate-100 pt-4">
                  <div className="flex items-center gap-2 font-medium">
                    <Check className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                    <span>Up to {p.max_apps} Monitored Apps</span>
                  </div>
                  <div className="flex items-center gap-2 font-medium">
                    <Check className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                    <span>{(p.max_monthly_events / 1000).toFixed(0)}k Events / month</span>
                  </div>
                  <div className="flex items-center gap-2 font-medium">
                    <Check className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                    <span>{p.max_ai_investigations_monthly} AI Diagnoses / month</span>
                  </div>
                  <div className="flex items-center gap-2 font-medium">
                    <Check className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                    <span>{p.retention_days} Days Telemetry Retention</span>
                  </div>
                  {p.features?.map((f, i) => (
                    <div key={i} className="flex items-center gap-2 text-[11px] text-slate-500">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
                      <span>{f}</span>
                    </div>
                  ))}
                </div>
              </div>

              <button
                disabled={isCurrent || upgradingTier === p.tier}
                onClick={() => handleUpgrade(p.tier)}
                className={`w-full py-2.5 rounded-xl text-xs font-semibold transition ${
                  isCurrent
                    ? 'bg-slate-100 text-slate-400 cursor-default'
                    : 'bg-slate-900 hover:bg-slate-800 text-white shadow-sm'
                }`}
              >
                {isCurrent
                  ? 'Active Plan'
                  : upgradingTier === p.tier
                  ? 'Updating...'
                  : `Select ${p.name}`}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
