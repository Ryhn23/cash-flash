import { useAppStore } from '../store/useAppStore.js';

class ApiClient {
  private getCsrfToken(): string | null {
    return useAppStore.getState().csrfToken;
  }

  async request<T>(url: string, options: RequestInit = {}): Promise<T> {
    const headers = new Headers(options.headers || {});

    // Ensure JSON content type if body is stringified JSON and not FormData
    if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    // Attach CSRF token on mutating methods
    const method = (options.method || 'GET').toUpperCase();
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      const csrf = this.getCsrfToken();
      if (csrf) {
        headers.set('X-CSRF-Token', csrf);
      }
    }

    const response = await fetch(url, {
      ...options,
      headers,
      credentials: 'include',
    });

    if (response.status === 401 && !url.includes('/api/auth/login')) {
      useAppStore.getState().logout();
      throw new Error('Sesi telah berakhir. Silakan masuk kembali.');
    }

    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Terjadi kesalahan pada permintaan');
      }
      return data as T;
    }

    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || 'Permintaan gagal');
    }

    return (await response.blob()) as unknown as T;
  }

  get<T>(url: string, options?: RequestInit): Promise<T> {
    return this.request<T>(url, { ...options, method: 'GET' });
  }

  post<T>(url: string, body?: unknown, options?: RequestInit): Promise<T> {
    const isFormData = body instanceof FormData;
    return this.request<T>(url, {
      ...options,
      method: 'POST',
      body: isFormData ? (body as FormData) : JSON.stringify(body),
    });
  }

  patch<T>(url: string, body?: unknown, options?: RequestInit): Promise<T> {
    const isFormData = body instanceof FormData;
    return this.request<T>(url, {
      ...options,
      method: 'PATCH',
      body: isFormData ? (body as FormData) : JSON.stringify(body),
    });
  }

  delete<T>(url: string, options?: RequestInit): Promise<T> {
    return this.request<T>(url, { ...options, method: 'DELETE' });
  }
}

export const api = new ApiClient();
