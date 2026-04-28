"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { useState, useEffect, useRef } from "react";
import { useAuthStore } from "@/stores/auth-store";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    // Consider expired 60s before actual expiry to avoid race conditions
    return payload.exp * 1000 - 60000 < Date.now();
  } catch {
    return true;
  }
}

function TokenRefresher() {
  const { accessToken, refreshToken, updateTokens, logout } = useAuthStore();
  const refreshingRef = useRef(false);

  useEffect(() => {
    if (!accessToken || !refreshToken) return;
    if (!isTokenExpired(accessToken)) return;
    if (refreshingRef.current) return;

    refreshingRef.current = true;

    fetch(`${API_BASE_URL}/api/v1/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    })
      .then((res) => {
        if (!res.ok) throw new Error("Refresh failed");
        return res.json();
      })
      .then((data) => {
        if (data.tokens?.access_token) {
          updateTokens(data.tokens.access_token, data.tokens.refresh_token);
        }
      })
      .catch(() => {
        logout();
      })
      .finally(() => {
        refreshingRef.current = false;
      });
  }, [accessToken, refreshToken, updateTokens, logout]);

  // Set up periodic token refresh check
  useEffect(() => {
    const interval = setInterval(() => {
      const token = useAuthStore.getState().accessToken;
      const refresh = useAuthStore.getState().refreshToken;
      if (token && refresh && isTokenExpired(token) && !refreshingRef.current) {
        refreshingRef.current = true;
        fetch(`${API_BASE_URL}/api/v1/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refresh_token: refresh }),
        })
          .then((res) => {
            if (!res.ok) throw new Error("Refresh failed");
            return res.json();
          })
          .then((data) => {
            if (data.tokens?.access_token) {
              useAuthStore.getState().updateTokens(data.tokens.access_token, data.tokens.refresh_token);
            }
          })
          .catch(() => {
            useAuthStore.getState().logout();
          })
          .finally(() => {
            refreshingRef.current = false;
          });
      }
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  }, []);

  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            retry: (failureCount, error) => {
              // Don't retry on 401 — let the token refresher handle it
              if (error instanceof Error && error.message.includes("401")) return false;
              return failureCount < 1;
            },
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <TokenRefresher />
      {children}
      <Toaster
        position="top-right"
        richColors
        closeButton
        duration={5000}
      />
    </QueryClientProvider>
  );
}
