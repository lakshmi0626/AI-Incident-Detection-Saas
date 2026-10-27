import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppLayout } from './components/layout/AppLayout';

// Pages
import { Login } from './pages/Login';
import { OverviewDashboard } from './pages/OverviewDashboard';
import { Applications } from './pages/Applications';
import { ApplicationDetails } from './pages/ApplicationDetails';
import { Incidents } from './pages/Incidents';
import { IncidentDetails } from './pages/IncidentDetails';
import { AIInvestigation } from './pages/AIInvestigation';
import { LogsExplorer } from './pages/LogsExplorer';
import { MetricsPerformance } from './pages/MetricsPerformance';
import { DistributedTraces } from './pages/DistributedTraces';
import { AnalyticsReports } from './pages/AnalyticsReports';
import { NotificationsPage } from './pages/NotificationsPage';
import { TeamMembers } from './pages/TeamMembers';
import { OrganizationSettings } from './pages/OrganizationSettings';
import { SubscriptionUsage } from './pages/SubscriptionUsage';
import { SecurityAudit } from './pages/SecurityAudit';
import { UserProfile } from './pages/UserProfile';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-slate-900 text-slate-400 text-xs font-mono">
        Loading IncidentIQ Workspace...
      </div>
    );
  }
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route
            path="/"
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<OverviewDashboard />} />
            <Route path="applications" element={<Applications />} />
            <Route path="applications/:appId" element={<ApplicationDetails />} />
            <Route path="incidents" element={<Incidents />} />
            <Route path="incidents/:incidentId" element={<IncidentDetails />} />
            <Route path="ai-investigation" element={<AIInvestigation />} />
            <Route path="logs" element={<LogsExplorer />} />
            <Route path="metrics" element={<MetricsPerformance />} />
            <Route path="traces" element={<DistributedTraces />} />
            <Route path="analytics" element={<AnalyticsReports />} />
            <Route path="notifications" element={<NotificationsPage />} />
            <Route path="team" element={<TeamMembers />} />
            <Route path="settings/organization" element={<OrganizationSettings />} />
            <Route path="settings/billing" element={<SubscriptionUsage />} />
            <Route path="settings/security" element={<SecurityAudit />} />
            <Route path="profile" element={<UserProfile />} />
          </Route>

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;
