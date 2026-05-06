/**
 * Unified API Client for Admin Panel
 * Handles base URL, auth tokens, timeout, and common error processing.
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '';
const DEFAULT_TIMEOUT = 8000;

export class ApiError extends Error {
    constructor(public status: number, message: string) {
        super(message);
        this.name = 'ApiError';
    }
}

interface FetchOptions extends RequestInit {
    timeout?: number;
}

export const apiClient = {
    async fetch<T>(endpoint: string, options: FetchOptions = {}): Promise<T> {
        const { timeout = DEFAULT_TIMEOUT, ...fetchOptions } = options;
        
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), timeout);
        
        const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null;
        
        const headers: HeadersInit = {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
            ...fetchOptions.headers,
        };

        try {
            const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;
            const response = await fetch(url, {
                ...fetchOptions,
                headers,
                signal: controller.signal,
            });

            clearTimeout(id);

            if (!response.ok) {
                let errorMessage = 'An error occurred';
                try {
                    const errorData = await response.json();
                    errorMessage = errorData.error || errorData.message || errorMessage;
                } catch (e) {
                    errorMessage = response.statusText || errorMessage;
                }
                throw new ApiError(response.status, errorMessage);
            }

            // Return null for 204 No Content
            if (response.status === 204) {
                return null as unknown as T;
            }

            return await response.json() as T;
        } catch (error: any) {
            clearTimeout(id);
            if (error.name === 'AbortError') {
                throw new ApiError(408, 'Request Timeout');
            }
            if (error instanceof ApiError) {
                throw error;
            }
            throw new ApiError(500, error.message || 'Network Error');
        }
    },

    get<T>(endpoint: string, options?: FetchOptions) {
        return this.fetch<T>(endpoint, { ...options, method: 'GET' });
    },

    post<T>(endpoint: string, data: any, options?: FetchOptions) {
        return this.fetch<T>(endpoint, {
            ...options,
            method: 'POST',
            body: JSON.stringify(data),
        });
    },

    put<T>(endpoint: string, data: any, options?: FetchOptions) {
        return this.fetch<T>(endpoint, {
            ...options,
            method: 'PUT',
            body: JSON.stringify(data),
        });
    },

    patch<T>(endpoint: string, data: any, options?: FetchOptions) {
        return this.fetch<T>(endpoint, {
            ...options,
            method: 'PATCH',
            body: JSON.stringify(data),
        });
    },

    delete<T>(endpoint: string, options?: FetchOptions) {
        return this.fetch<T>(endpoint, { ...options, method: 'DELETE' });
    },
};
