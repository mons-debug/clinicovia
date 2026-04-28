import { useAuthStore } from "@/stores/auth-store";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface FetchOptions extends RequestInit {
  token?: string;
}

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const { refreshToken, updateTokens, logout } = useAuthStore.getState();
  if (!refreshToken) {
    logout();
    return null;
  }

  try {
    const res = await fetch(`${API_BASE_URL}/api/v1/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (!res.ok) {
      logout();
      return null;
    }
    const data = await res.json();
    if (data.tokens?.access_token) {
      updateTokens(data.tokens.access_token, data.tokens.refresh_token);
      return data.tokens.access_token;
    }
    logout();
    return null;
  } catch {
    logout();
    return null;
  }
}

export async function apiClient<T>(
  endpoint: string,
  options: FetchOptions = {}
): Promise<T> {
  const { token: explicitToken, headers: customHeaders, ...restOptions } = options;

  // Use explicit token if provided, otherwise read latest from store
  const token = explicitToken ?? useAuthStore.getState().accessToken ?? undefined;

  const makeRequest = async (accessToken?: string) => {
    const headers: HeadersInit = {
      "Content-Type": "application/json",
      ...customHeaders,
    };

    if (accessToken) {
      (headers as Record<string, string>)["Authorization"] = `Bearer ${accessToken}`;
    }

    return fetch(`${API_BASE_URL}/api/v1${endpoint}`, {
      headers,
      ...restOptions,
    });
  };

  let response = await makeRequest(token);

  // On 401, try refreshing the token once
  if (response.status === 401 && token) {
    if (!refreshPromise) {
      refreshPromise = refreshAccessToken().finally(() => {
        refreshPromise = null;
      });
    }
    const newToken = await refreshPromise;
    if (newToken) {
      response = await makeRequest(newToken);
    }
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Request failed" }));
    let message = `HTTP ${response.status}`;
    if (typeof error.detail === "string") {
      message = error.detail;
    } else if (Array.isArray(error.detail)) {
      message = error.detail.map((e: { msg?: string }) => e.msg || "Validation error").join(", ");
    } else if (error.message) {
      message = error.message;
    }
    throw new Error(message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}
