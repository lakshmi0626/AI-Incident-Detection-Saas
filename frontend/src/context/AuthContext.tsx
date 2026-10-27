import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, Organization } from '../types';
import { apiRequest } from '../services/api';

interface AuthContextType {
  user: User | null;
  currentOrg: Organization | null;
  organizations: Organization[];
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  switchOrganization: (orgId: string) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [currentOrg, setCurrentOrg] = useState<Organization | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const refreshProfile = async () => {
    try {
      const data = await apiRequest('/auth/me');
      setUser({
        id: data.id,
        email: data.email,
        full_name: data.full_name,
        role: data.role,
        is_active: data.is_active,
        is_superuser: data.is_superuser,
        created_at: data.created_at,
      });
      setCurrentOrg(data.current_organization);
      setOrganizations(data.organizations || []);
      localStorage.setItem('incidentiq_org_id', data.current_organization.id);
    } catch (err) {
      logout();
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('incidentiq_token');
    if (token) {
      refreshProfile();
    } else {
      setIsLoading(false);
    }
  }, []);

  const login = async (email: string, password: string) => {
    const resp = await apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    localStorage.setItem('incidentiq_token', resp.access_token);
    localStorage.setItem('incidentiq_org_id', resp.current_organization.id);
    setUser(resp.user);
    setCurrentOrg(resp.current_organization);
    setOrganizations(resp.organizations);
  };

  const logout = () => {
    localStorage.removeItem('incidentiq_token');
    localStorage.removeItem('incidentiq_org_id');
    setUser(null);
    setCurrentOrg(null);
    setOrganizations([]);
  };

  const switchOrganization = async (orgId: string) => {
    const resp = await apiRequest(`/auth/switch-org?org_id=${orgId}`, {
      method: 'POST',
    });
    localStorage.setItem('incidentiq_token', resp.access_token);
    localStorage.setItem('incidentiq_org_id', resp.current_organization.id);
    setCurrentOrg(resp.current_organization);
    await refreshProfile();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        currentOrg,
        organizations,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
        switchOrganization,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
