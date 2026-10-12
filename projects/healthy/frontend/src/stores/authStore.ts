/**
 * authStore — estado global de autenticación con JWT dual-token.
 * Tokens en SecureStore; nunca en AsyncStorage.
 */

import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { initApiInterceptors } from '@/services/api';
import api from '@/services/api';

export interface User {
  id:    string;
  email: string;
  name?: string;
  has_plan?: boolean;
}

interface AuthState {
  user:             User | null;
  accessToken:      string | null;
  refreshToken:     string | null;
  isAuthenticated:  boolean;
  isLoading:        boolean;

  // Acciones
  login:         (user: User, accessToken: string, refreshToken: string) => Promise<void>;
  logout:        () => Promise<void>;
  refreshTokens: (newAccessToken: string, newRefreshToken?: string) => Promise<void>;
  loadStoredAuth:() => Promise<void>;

  /** @deprecated usar login() */
  setAuth: (user: User, token: string) => Promise<void>;
  /** @deprecated usar logout() */
  clearAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => {
  // Inicializamos los interceptores con accesores al store
  initApiInterceptors(
    () => get().accessToken,
    () => get().logout(),
  );

  return {
    user:            null,
    accessToken:     null,
    refreshToken:    null,
    isAuthenticated: false,
    isLoading:       true,

    login: async (user, accessToken, refreshToken) => {
      await SecureStore.setItemAsync('access_token',  accessToken);
      await SecureStore.setItemAsync('refresh_token', refreshToken);
      await SecureStore.setItemAsync('auth_user',     JSON.stringify(user));
      set({ user, accessToken, refreshToken, isAuthenticated: true });
    },

    logout: async () => {
      try { await api.post('/auth/logout'); } catch { /* ignorar errores de red */ }
      await SecureStore.deleteItemAsync('access_token');
      await SecureStore.deleteItemAsync('refresh_token');
      await SecureStore.deleteItemAsync('auth_user');
      set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false });
    },

    refreshTokens: async (newAccessToken, newRefreshToken) => {
      await SecureStore.setItemAsync('access_token', newAccessToken);
      if (newRefreshToken) {
        await SecureStore.setItemAsync('refresh_token', newRefreshToken);
      }
      set({ accessToken: newAccessToken, ...(newRefreshToken ? { refreshToken: newRefreshToken } : {}) });
    },

    loadStoredAuth: async () => {
      try {
        const [accessToken, refreshToken, userJson] = await Promise.all([
          SecureStore.getItemAsync('access_token'),
          SecureStore.getItemAsync('refresh_token'),
          SecureStore.getItemAsync('auth_user'),
        ]);

        if (accessToken && userJson) {
          const user = JSON.parse(userJson) as User;
          set({ user, accessToken, refreshToken, isAuthenticated: true });

          // Validar sesión con el backend
          try {
            const { data } = await api.get('/auth/me');
            const freshUser = data.data?.user ?? data.user ?? user;
            set({ user: freshUser });
          } catch {
            // Si falla /me, el interceptor de 401 ya gestionará el logout
          }
        }
      } catch {
        await SecureStore.deleteItemAsync('access_token');
        await SecureStore.deleteItemAsync('refresh_token');
        await SecureStore.deleteItemAsync('auth_user');
      } finally {
        set({ isLoading: false });
      }
    },

    // ── Compatibilidad con código existente ─────────────────────────────────

    setAuth: async (user, token) => {
      // Llamado desde código antiguo que sólo pasa un token
      await SecureStore.setItemAsync('access_token',  token);
      await SecureStore.setItemAsync('auth_user',     JSON.stringify(user));
      set({ user, accessToken: token, isAuthenticated: true });
    },

    clearAuth: async () => {
      await get().logout();
    },
  };
});
