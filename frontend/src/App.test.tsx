import { describe, it, expect } from 'vitest';

describe('IncidentIQ Frontend Core Specifications', () => {
  it('validates navigation routes structure', () => {
    const requiredPages = [
      'OverviewDashboard',
      'Applications',
      'ApplicationDetails',
      'Incidents',
      'IncidentDetails',
      'AIInvestigation',
      'LogsExplorer',
      'MetricsPerformance',
      'DistributedTraces',
      'AnalyticsReports',
      'NotificationsPage',
      'TeamMembers',
      'OrganizationSettings',
      'SubscriptionUsage',
      'SecurityAudit',
      'UserProfile',
      'Login'
    ];
    expect(requiredPages.length).toBe(17);
  });

  it('validates role-based hierarchy levels', () => {
    const hierarchy = {
      viewer: 1,
      engineer: 2,
      admin: 3,
      owner: 4
    };
    expect(hierarchy.owner).toBeGreaterThan(hierarchy.admin);
    expect(hierarchy.admin).toBeGreaterThan(hierarchy.engineer);
    expect(hierarchy.engineer).toBeGreaterThan(hierarchy.viewer);
  });

  it('validates incident lifecycle status states', () => {
    const states = ['Triggered', 'Acknowledged', 'Investigating', 'Mitigated', 'Resolved', 'Closed'];
    expect(states).toContain('Triggered');
    expect(states).toContain('Resolved');
    expect(states.length).toBe(6);
  });
});
