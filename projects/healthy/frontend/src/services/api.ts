/**
 * Cliente HTTP centralizado con interceptores de autenticación y refresco de token.
 * Usa axios (ya en package.json). Tokens guardados en SecureStore.
 */

import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import * as SecureStore from 'expo-secure-store';

// URL por defecto solo para desarrollo local
const DEV_DEFAULT_API_URL = 'http://localhost:3000';

/**
 * SEC-65 (SA-30): resuelve la URL base de la API.
 * - En producción (`!__DEV__`) exige `EXPO_PUBLIC_API_URL` con `https://`; sin fallback a HTTP.
 * - En desarrollo se permite `http://` (localhost / IP local) y el fallback a localhost.
 * Si la configuración no es segura se lanza un error al cargar el módulo: preferimos que la
 * build falle de forma visible antes que enviar tokens y datos de salud en claro.
 */
export function resolveApiBaseUrl(rawUrl: string | undefined, isDev: boolean): string {
  const url = rawUrl?.trim();
  if (!url) {
    if (isDev) return DEV_DEFAULT_API_URL;
    throw new Error('EXPO_PUBLIC_API_URL is required in production builds');
  }
  if (!isDev && !/^https:\/\//i.test(url)) {
    throw new Error('EXPO_PUBLIC_API_URL must use https:// in production builds');
  }
  if (isDev && !/^https?:\/\//i.test(url)) {
    throw new Error('EXPO_PUBLIC_API_URL must start with http:// or https://');
  }
  return url.replace(/\/+$/, '');
}

const BASE_URL = resolveApiBaseUrl(process.env.EXPO_PUBLIC_API_URL, __DEV__);

// Referencia circular: importamos el store en tiempo de ejecución para evitar ciclos
let _getAccessToken: () => string | null = () => null;
let _onLogout: () => void                = () => {};

/** Llamar esto desde authStore una vez creado el store */
export function initApiInterceptors(
  getAccessToken: () => string | null,
  onLogout:       () => void,
) {
  _getAccessToken = getAccessToken;
  _onLogout       = onLogout;
}

export const api: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 20000,
  headers: { 'Content-Type': 'application/json' },
});

// ── Interceptor de petición ───────────────────────────────────────────────────

api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  // Preferimos el token en memoria (store); si no, intentamos SecureStore
  let token = _getAccessToken();
  if (!token) {
    token = await SecureStore.getItemAsync('access_token');
  }
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ── Interceptor de respuesta — manejo de 401 con refresco ────────────────────

let isRefreshing  = false;
let pendingQueue: Array<{ resolve: (t: string) => void; reject: (e: unknown) => void }> = [];

function processQueue(error: unknown, token?: string) {
  pendingQueue.forEach((p) => (error ? p.reject(error) : p.resolve(token!)));
  pendingQueue = [];
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Solo intentar refresco en 401 de token (no de credenciales) y si no es ya el endpoint
    // de refresh. INVALID_CREDENTIALS = contraseña incorrecta (login, DELETE /user/me): el
    // token sigue siendo válido y reintentar gastaría otro intento del limitador (SEC-48).
    if (
      error.response?.status === 401 &&
      error.response?.data?.error !== 'INVALID_CREDENTIALS' &&
      !originalRequest._retry &&
      !originalRequest.url?.includes('/auth/refresh')
    ) {
      if (isRefreshing) {
        // Encolar mientras se refresca
        return new Promise((resolve, reject) => {
          pendingQueue.push({
            resolve: (newToken) => {
              originalRequest.headers.Authorization = `Bearer ${newToken}`;
              resolve(api(originalRequest));
            },
            reject,
          });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshToken = await SecureStore.getItemAsync('refresh_token');
        if (!refreshToken) throw new Error('No refresh token');

        const { data } = await axios.post(`${BASE_URL}/auth/refresh`, {
          refresh_token: refreshToken,
        });

        const newAccess  = data.data?.access_token  ?? data.access_token;
        const newRefresh = data.data?.refresh_token ?? data.refresh_token;

        await SecureStore.setItemAsync('access_token', newAccess);
        if (newRefresh) {
          await SecureStore.setItemAsync('refresh_token', newRefresh);
        }

        // Actualizamos el store en memoria también
        _getAccessToken = () => newAccess;

        processQueue(null, newAccess);
        originalRequest.headers.Authorization = `Bearer ${newAccess}`;
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError);
        // Limpiamos credenciales y lanzamos logout
        await SecureStore.deleteItemAsync('access_token');
        await SecureStore.deleteItemAsync('refresh_token');
        await SecureStore.deleteItemAsync('auth_user');
        _onLogout();
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);

export default api;
