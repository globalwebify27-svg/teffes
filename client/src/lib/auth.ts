import api from "./api";

export interface User {
  id: string;
  name?: string;
  email?: string;
  phone?: string;
  role: "customer" | "admin" | "rider" | "superadmin" | "storeadmin";
  isVerified: boolean;
}

// ─── Storage Helpers ──────────────────────────────────────────────────────────
export const saveAuth = (accessToken: string, user: User) => {
  localStorage.setItem("accessToken", accessToken);
  localStorage.setItem("user", JSON.stringify(user));
};

export const clearAuth = () => {
  localStorage.removeItem("accessToken");
  localStorage.removeItem("user");
};

export const getStoredUser = (): User | null => {
  if (typeof window === "undefined") return null;
  const stored = localStorage.getItem("user");
  if (!stored) return null;
  try {
    return JSON.parse(stored) as User;
  } catch {
    return null;
  }
};

export const getAccessToken = (): string | null => {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("accessToken");
};

export const isAuthenticated = (): boolean => {
  return !!getAccessToken();
};

// ─── API Calls ────────────────────────────────────────────────────────────────
export const sendOTP = async (phone: string) => {
  const { data } = await api.post<{ success: boolean; message: string; otp?: string }>(
    "/auth/send-otp",
    { phone }
  );
  return data;
};

export const verifyOTP = async (phone: string, otp: string) => {
  const { data } = await api.post<{
    success: boolean;
    accessToken: string;
    user: User & { isNewUser: boolean };
  }>("/auth/verify-otp", { phone, otp });

  if (data.success) {
    saveAuth(data.accessToken, data.user);
  }

  return data;
};

export const adminLogin = async (email: string, password: string) => {
  const { data } = await api.post<{
    success: boolean;
    accessToken: string;
    user: User;
  }>("/auth/admin-login", { email, password });

  if (data.success) {
    saveAuth(data.accessToken, data.user);
  }

  return data;
};

export const logout = async () => {
  try {
    await api.post("/auth/logout");
  } finally {
    clearAuth();
  }
};

// ─── Mock / Demo Admin Login (Frontend-only, bypasses backend) ───────────────
export const DEMO_ADMIN_USERS: Record<string, { password: string; user: User; token: string }> = {
  "superadmin@teffes.com": {
    password: "Super@12345",
    token: "demo-superadmin-token-001",
    user: {
      id: "sa-001",
      name: "Teffes Super Admin",
      email: "superadmin@teffes.com",
      role: "superadmin",
      isVerified: true,
    },
  },
  "storeadmin@teffes.com": {
    password: "Store@12345",
    token: "demo-storeadmin-token-001",
    user: {
      id: "sta-001",
      name: "Ranchi Store Admin",
      email: "storeadmin@teffes.com",
      role: "storeadmin",
      isVerified: true,
    },
  },
};

export const demoAdminLogin = (email: string, password: string): { success: boolean; user?: User } => {
  const entry = DEMO_ADMIN_USERS[email.trim().toLowerCase()];
  if (entry && entry.password === password) {
    saveAuth(entry.token, entry.user);
    return { success: true, user: entry.user };
  }
  return { success: false };
};

export const getMe = async () => {
  const { data } = await api.get<{ success: boolean; user: User }>("/auth/me");
  return data.user;
};
