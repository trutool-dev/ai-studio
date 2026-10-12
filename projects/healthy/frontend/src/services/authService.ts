/**
 * authService — llamadas al backend de autenticación.
 * El backend devuelve { success, data: { user, access_token, refresh_token } }.
 */

import api from './api';

export interface AuthUser {
  id:       string;
  email:    string;
  name?:    string;
  has_plan?: boolean;
}

export interface AuthTokens {
  access_token:  string;
  refresh_token: string;
}

export interface AuthResponse {
  user:          AuthUser;
  access_token:  string;
  refresh_token: string;
}

/** Extrae AuthResponse del wrapper { success, data } o respuesta plana */
function extractAuth(responseData: any): AuthResponse {
  const d = responseData?.data ?? responseData;
  return {
    user:          d.user,
    access_token:  d.access_token  ?? d.token,
    refresh_token: d.refresh_token ?? '',
  };
}

export const authService = {
  register: (email: string, phoneNumber: string) =>
    api.post('/auth/register', { email, phone_number: phoneNumber }),

  verifyEmail: async (email: string, code: string) => {
    const res = await api.post('/auth/verify-email', { email, code });
    return extractAuth(res.data);
  },

  resendCode: (email: string) =>
    api.post('/auth/resend-code', { email }),

  setPassword: async (email: string, code: string, password: string) => {
    const res = await api.post('/auth/set-password', { email, code, password });
    return extractAuth(res.data);
  },

  login: async (email: string, password: string) => {
    const res = await api.post('/auth/login', { email, password });
    return extractAuth(res.data);
  },

  forgotPassword: (email: string) =>
    api.post('/auth/forgot-password', { email }),

  resetPassword: (token: string, password: string) =>
    api.post('/auth/reset-password', { token, password }),

  logout: () =>
    api.post('/auth/logout'),

  me: async () => {
    const res = await api.get('/auth/me');
    const d   = res.data?.data ?? res.data;
    return d.user as AuthUser;
  },
};
