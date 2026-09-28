import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

const api = axios.create({
  baseURL: API_URL,
  withCredentials: true, // send cookies (refresh token)
  headers: {
    "Content-Type": "application/json",
  },
});

// ─── Request Interceptor ──────────────────────────────────────────────────────
// Attach access token to every request
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token =
      typeof window !== "undefined"
        ? localStorage.getItem("accessToken")
        : null;

    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// ─── Response Interceptor ─────────────────────────────────────────────────────
// Auto-refresh access token on 401 TOKEN_EXPIRED
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
}> = [];

const processQueue = (error: AxiosError | null, token: string | null) => {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve(token);
  });
  failedQueue = [];
};

// Helper to determine the appropriate login path based on active route
const getRedirectLoginPath = (): string => {
  if (typeof window === "undefined") return "/login";
  const pathname = window.location.pathname.toLowerCase();
  if (
    pathname.startsWith("/store-admin") ||
    pathname.startsWith("/super-admin") ||
    pathname.startsWith("/admin") ||
    pathname.includes("admin")
  ) {
    return "/admin-login";
  }
  return "/login";
};

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    const data = error.response?.data as { code?: string } | undefined;

    if (
      error.response?.status === 401 &&
      data?.code === "TOKEN_EXPIRED" &&
      !originalRequest._retry
    ) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${token}`;
          }
          return api(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const { data: refreshData } = await api.post<{ accessToken: string }>(
          "/auth/refresh"
        );
        const newToken = refreshData.accessToken;
        localStorage.setItem("accessToken", newToken);
        processQueue(null, newToken);
        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
        }
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError as AxiosError, null);
        // Clear auth and redirect to the correct login portal
        localStorage.removeItem("accessToken");
        localStorage.removeItem("user");
        if (typeof window !== "undefined") {
          window.location.href = getRedirectLoginPath();
        }
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    // Catch unhandled 401s after retry or invalid token on protected calls
    if (error.response?.status === 401) {
      const isAuthAttempt =
        originalRequest.url?.includes("/auth/login") ||
        originalRequest.url?.includes("/auth/admin-login") ||
        originalRequest.url?.includes("/auth/verify-otp") ||
        originalRequest.url?.includes("/auth/firebase-login");

      if (!isAuthAttempt && originalRequest._retry) {
        localStorage.removeItem("accessToken");
        localStorage.removeItem("user");
        if (typeof window !== "undefined") {
          window.location.href = getRedirectLoginPath();
        }
      }
    }

    return Promise.reject(error);
  }
);

export default api;
