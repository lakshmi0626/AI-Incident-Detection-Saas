import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  AlertTriangle,
  BrainCircuit,
  Boxes,
  ScrollText,
  Activity,
  GitBranch,
  BarChart3,
  Bell,
  Users,
  Settings,
  CreditCard,
  ShieldAlert,
  UserCircle,
  Building2,
  ChevronDown,
  LogOut,
  Sparkles
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const Sidebar: React.FC = () => {
  const { user, currentOrg, organizations, switchOrganization, logout } = useAuth();
  const [orgDropdownOpen, setOrgDropdownOpen] = useState(false);
  const navigate = useNavigate();

  const navGroups = [
    {
      title: 'Operations',
      items: [
        { label: 'Overview', to: '/dashboard', icon: LayoutDashboard },
        { label: 'Incidents', to: '/incidents', icon: AlertTriangle },
        { label: 'AI Investigation', to: '/ai-investigation', icon: BrainCircuit, badge: 'AI' },
        { label: 'Applications', to: '/applications', icon: Boxes },
      ]
    },
    {
      title: 'Observability',
      items: [
        { label: 'Logs Explorer', to: '/logs', icon: ScrollText },
        { label: 'Metrics & Performance', to: '/metrics', icon: Activity },
        { label: 'Distributed Traces', to: '/traces', icon: GitBranch },
      ]
    },
    {
      title: 'Analytics & Alerts',
      items: [
        { label: 'Reports & Analytics', to: '/analytics', icon: BarChart3 },
        { label: 'Notifications', to: '/notifications', icon: Bell },
        { label: 'Team Members', to: '/team', icon: Users },
      ]
    },
    {
      title: 'Platform & SaaS',
      items: [
        { label: 'Organization Settings', to: '/settings/organization', icon: Settings },
        { label: 'Subscription & Usage', to: '/settings/billing', icon: CreditCard },
        { label: 'Security & Audit Logs', to: '/settings/security', icon: ShieldAlert },
      ]
    }
  ];

  return (
    <aside className="w-64 bg-[#111827] text-slate-300 flex flex-col h-screen border-r border-slate-800 select-none flex-shrink-0">
      {/* Brand Header */}
      <div className="h-16 flex items-center px-5 border-b border-slate-800 gap-3">
        <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-emerald-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
          <Sparkles className="w-5 h-5 text-white" />
        </div>
        <div className="flex flex-col">
          <span className="font-bold text-white tracking-tight text-lg leading-tight flex items-center gap-1.5">
            Incident<span className="text-emerald-400">IQ</span>
          </span>
          <span className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold">AI SRE Platform</span>
        </div>
      </div>

      {/* Tenant Switcher Dropdown */}
      <div className="p-3 border-b border-slate-800/80 relative">
        <button
          onClick={() => setOrgDropdownOpen(!orgDropdownOpen)}
          className="w-full flex items-center justify-between p-2.5 rounded-lg bg-slate-900/90 hover:bg-slate-800/90 border border-slate-700/60 transition text-left"
        >
          <div className="flex items-center gap-2.5 overflow-hidden">
            <Building2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <div className="truncate">
              <div className="text-xs font-semibold text-white truncate">{currentOrg?.name || 'Organization'}</div>
              <div className="text-[10px] text-slate-400 uppercase font-medium">{currentOrg?.plan_tier || 'Starter'} Tier</div>
            </div>
          </div>
          <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
        </button>

        {orgDropdownOpen && (
          <div className="absolute top-16 left-3 right-3 bg-slate-900 border border-slate-700 rounded-lg shadow-2xl py-1 z-50">
            <div className="px-3 py-1.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Switch Organization</div>
            {organizations.map((org) => (
              <button
                key={org.id}
                onClick={() => {
                  switchOrganization(org.id);
                  setOrgDropdownOpen(false);
                }}
                className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-slate-800 ${
                  org.id === currentOrg?.id ? 'text-emerald-400 font-semibold bg-emerald-950/30' : 'text-slate-300'
                }`}
              >
                <span className="truncate">{org.name}</span>
                <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">{org.role}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Navigation Scrollable Body */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        {navGroups.map((group) => (
          <div key={group.title} className="space-y-1">
            <div className="px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              {group.title}
            </div>
            {group.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition ${
                    isActive
                      ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-700/30'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                  }`
                }
              >
                <div className="flex items-center gap-2.5">
                  <item.icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    {item.badge}
                  </span>
                )}
              </NavLink>
            ))}
          </div>
        ))}
      </div>

      {/* User Footer Profile */}
      <div className="p-3 border-t border-slate-800 bg-slate-900/60 flex items-center justify-between">
        <NavLink to="/profile" className="flex items-center gap-2.5 overflow-hidden hover:opacity-90">
          <div className="w-8 h-8 rounded-full bg-slate-700 border border-slate-600 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
            {user?.full_name?.charAt(0) || 'U'}
          </div>
          <div className="truncate">
            <div className="text-xs font-semibold text-white truncate">{user?.full_name || 'Engineer'}</div>
            <div className="text-[10px] text-slate-400 truncate capitalize">{user?.role || 'engineer'}</div>
          </div>
        </NavLink>
        <button
          onClick={logout}
          title="Sign out"
          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </aside>
  );
};
