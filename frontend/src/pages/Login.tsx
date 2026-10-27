import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Shield, Lock, Mail, User, Building, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../services/api';

export const Login: React.FC = () => {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('admin@incidentiq.io');
  const [password, setPassword] = useState('IncidentIQ@2026!');
  const [fullName, setFullName] = useState('');
  const [orgName, setOrgName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { login, refreshProfile } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isRegister) {
        const resp = await apiRequest('/auth/register', {
          method: 'POST',
          body: JSON.stringify({
            email,
            password,
            full_name: fullName,
            organization_name: orgName || undefined,
          }),
        });
        localStorage.setItem('incidentiq_token', resp.access_token);
        localStorage.setItem('incidentiq_org_id', resp.current_organization.id);
        await refreshProfile();
      } else {
        await login(email, password);
      }
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please check credentials.');
    } finally {
      setLoading(false);
    }
  };

  const fillDemoAccount = (demoEmail: string, roleTitle: string) => {
    setEmail(demoEmail);
    setPassword('IncidentIQ@2026!');
    setIsRegister(false);
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center items-center p-4 relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-emerald-500/10 blur-[120px] rounded-full pointer-events-none" />

      {/* Brand Header */}
      <div className="text-center mb-8 z-10">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-tr from-emerald-500 to-cyan-500 shadow-xl shadow-emerald-500/20 mb-3">
          <Sparkles className="w-6 h-6 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-white tracking-tight">
          Incident<span className="text-emerald-400">IQ</span>
        </h1>
        <p className="text-xs text-slate-400 mt-1 max-w-sm">
          Commercial AI-Powered Incident Detection, Distributed Tracing & Automated Root-Cause SRE Platform
        </p>
      </div>

      {/* Main Card */}
      <div className="w-full max-w-md bg-slate-800/90 border border-slate-700/80 rounded-2xl shadow-2xl p-7 z-10 backdrop-blur-md">
        <div className="flex border-b border-slate-700 mb-6">
          <button
            onClick={() => { setIsRegister(false); setError(null); }}
            className={`flex-1 pb-3 text-xs font-semibold border-b-2 transition ${
              !isRegister ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Sign In
          </button>
          <button
            onClick={() => { setIsRegister(true); setError(null); }}
            className={`flex-1 pb-3 text-xs font-semibold border-b-2 transition ${
              isRegister ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Create Organization
          </button>
        </div>

        {error && (
          <div className="p-3 mb-4 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {isRegister && (
            <>
              <div>
                <label className="block text-[11px] font-medium text-slate-300 uppercase tracking-wider mb-1">
                  Full Name
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Alex Mercer"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-300 uppercase tracking-wider mb-1">
                  Organization Name
                </label>
                <div className="relative">
                  <Building className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    required
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    placeholder="Acme Financial Cloud"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
            </>
          )}

          <div>
            <label className="block text-[11px] font-medium text-slate-300 uppercase tracking-wider mb-1">
              Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="engineer@company.com"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-300 uppercase tracking-wider mb-1">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 mt-2 disabled:opacity-50"
          >
            <span>{loading ? 'Authenticating...' : isRegister ? 'Launch SaaS Workspace' : 'Sign In to Workspace'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {/* Demo Fast Pre-fills */}
        {!isRegister && (
          <div className="mt-6 pt-5 border-t border-slate-700/80">
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2.5 text-center">
              One-Click Demo Credentials
            </div>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => fillDemoAccount('admin@incidentiq.io', 'Owner')}
                className="p-2 rounded-lg bg-slate-900 border border-slate-700 hover:border-emerald-500/50 text-[11px] text-slate-300 hover:text-white transition text-center"
              >
                <div className="font-semibold text-emerald-400">Owner</div>
                <div className="text-[9px] text-slate-500">Sarah C.</div>
              </button>
              <button
                type="button"
                onClick={() => fillDemoAccount('engineer@incidentiq.io', 'Engineer')}
                className="p-2 rounded-lg bg-slate-900 border border-slate-700 hover:border-emerald-500/50 text-[11px] text-slate-300 hover:text-white transition text-center"
              >
                <div className="font-semibold text-cyan-400">Engineer</div>
                <div className="text-[9px] text-slate-500">Alex M.</div>
              </button>
              <button
                type="button"
                onClick={() => fillDemoAccount('viewer@incidentiq.io', 'Viewer')}
                className="p-2 rounded-lg bg-slate-900 border border-slate-700 hover:border-emerald-500/50 text-[11px] text-slate-300 hover:text-white transition text-center"
              >
                <div className="font-semibold text-slate-400">Viewer</div>
                <div className="text-[9px] text-slate-500">Morgan V.</div>
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="mt-6 text-[11px] text-slate-500 flex items-center gap-4">
        <span>Multi-Tenant SaaS</span>
        <span>•</span>
        <span>OpenTelemetry Native</span>
        <span>•</span>
        <span>Deterministic AI SRE</span>
      </div>
    </div>
  );
};
