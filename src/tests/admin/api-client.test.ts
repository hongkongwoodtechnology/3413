import { apiClient, ApiError } from '../../lib/api/client';

// Mock the global fetch
global.fetch = jest.fn();

describe('API Client', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock localStorage for token
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: jest.fn(() => 'mock_token'),
      },
      writable: true
    });
  });

  it('should successfully fetch data', async () => {
    const mockData = { success: true, data: 'test' };
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockData,
    });

    const result = await apiClient.get('/test-endpoint');
    
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/test-endpoint'),
      expect.objectContaining({
        headers: expect.objectContaining({
          'Authorization': 'Bearer mock_token',
        })
      })
    );
    expect(result).toEqual(mockData);
  });

  it('should handle 404 errors correctly', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ error: 'Not Found' }),
    });

    await expect(apiClient.get('/not-found')).rejects.toThrow(ApiError);
    await expect(apiClient.get('/not-found')).rejects.toMatchObject({
      status: 404,
      message: 'Not Found'
    });
  });

  it('should handle network errors / timeouts', async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network Error'));

    await expect(apiClient.get('/timeout')).rejects.toThrow('Network Error');
  });
});
