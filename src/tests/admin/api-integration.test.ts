import { GET as getDashboard } from '../../../src/app/api/admin/dashboard/route';
import { GET as getUsers } from '../../../src/app/api/admin/users/route';
import { GET as getLogs } from '../../../src/app/api/admin/logs/route';
import { GET as getAnalytics } from '../../../src/app/api/admin/analytics/route';

// For Jest environment with Next.js App Router API testing, we mock Request and NextRequest
class MockNextRequest {
  public nextUrl: URL;
  public url: string;
  constructor(url: string) {
    this.url = url;
    this.nextUrl = new URL(url);
  }
}
// We also mock NextResponse.json since the native one might rely on actual Response which is missing
const mockNextResponseJson = (body: any, init?: ResponseInit) => {
  return {
    status: init?.status || 200,
    json: async () => body
  };
};

jest.mock('next/server', () => ({
  NextRequest: jest.fn().mockImplementation((url) => new MockNextRequest(url)),
  NextResponse: {
    json: jest.fn().mockImplementation((body, init) => mockNextResponseJson(body, init))
  }
}));

// We also need to mock global Request for the dashboard route fakeRequest
global.Request = MockNextRequest as any;

// Mock match route internally if needed, but since dashboard route now calls it directly,
// we'll just mock the underlying ESPN fetch so tests don't actually hit the network.
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ events: [] }), // Empty mock for ESPN API
  })
) as jest.Mock;

describe('Admin API Integration Tests', () => {
  const mockBaseUrl = 'http://localhost:3000';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('Dashboard API returns correctly formatted data', async () => {
    const { NextRequest } = require('next/server');
    const req = new NextRequest(`${mockBaseUrl}/api/admin/dashboard`);
    const res = await getDashboard(req as any);
    const json = await res.json();
    
    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(Array.isArray(json.data.liveMatches)).toBe(true);
    expect(Array.isArray(json.data.trendData)).toBe(true);
    expect(Array.isArray(json.data.distributionData)).toBe(true);
  });

  it('Users API returns correctly formatted data and supports pagination', async () => {
    const { NextRequest } = require('next/server');
    const req = new NextRequest(`${mockBaseUrl}/api/admin/users?page=1&limit=2`);
    const res = await getUsers(req as any);
    const json = await res.json();
    
    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(Array.isArray(json.data)).toBe(true);
    expect(json.data.length).toBeLessThanOrEqual(2);
    expect(json.meta).toBeDefined();
    expect(json.meta.page).toBe(1);
    expect(json.meta.limit).toBe(2);
  });

  it('Logs API returns correctly formatted and masked data', async () => {
    const { NextRequest } = require('next/server');
    const req = new NextRequest(`${mockBaseUrl}/api/admin/logs`);
    const res = await getLogs(req as any);
    const json = await res.json();
    
    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(Array.isArray(json.data)).toBe(true);
    if (json.data.length > 0) {
      expect(json.data[0].admin).toMatch(/\*{3}/); // Should be masked
      expect(json.data[0].ip).toMatch(/\*/);      // Should be masked
    }
  });

  it('Analytics API returns all required chart data', async () => {
    const res = await getAnalytics();
    const json = await res.json();
    
    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.langDistributionData).toBeDefined();
    expect(json.data.activeHoursData).toBeDefined();
    expect(json.data.prefData).toBeDefined();
  });
});
