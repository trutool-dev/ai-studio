/**
 * privacyService — derechos RGPD desde la app (SEC-47 / SEC-48).
 *  - Retirar el consentimiento de datos de salud (art. 7.3 y 9): DELETE /onboarding/health-consent
 *  - Suprimir la cuenta (art. 17): DELETE /user/me con { password }
 */

import api from './api';

export interface HealthConsentStatus {
  valid:    boolean;
  given_at: string | null;
}

export interface WithdrawConsentResult {
  withdrawn:    boolean;
  withdrawn_at: string;
  deleted: {
    conditions:        number;
    food_restrictions: number;
    injuries_cleared:  boolean;
  };
}

/** Códigos de error del backend relevantes para estas pantallas */
export const PRIVACY_ERRORS = {
  INVALID_CREDENTIALS:     'INVALID_CREDENTIALS',
  VALIDATION_ERROR:        'VALIDATION_ERROR',
  TOO_MANY_REQUESTS:       'TOO_MANY_REQUESTS',
  HEALTH_CONSENT_REQUIRED: 'HEALTH_CONSENT_REQUIRED',
} as const;

/** Código de error del backend ({ error }) de una respuesta Axios, si lo hay */
export function apiErrorCode(err: any): string | undefined {
  return err?.response?.data?.error;
}

export const privacyService = {
  /** Estado del consentimiento (GET /user/me/profile → health_consent). null si no se pudo leer */
  getHealthConsentStatus: async (): Promise<HealthConsentStatus | null> => {
    const { data } = await api.get('/user/me/profile');
    return data?.data?.health_consent ?? null;
  },

  /** Retira el consentimiento y borra los datos de salud en el servidor */
  withdrawHealthConsent: async (): Promise<WithdrawConsentResult> => {
    const { data } = await api.delete('/onboarding/health-consent');
    return data?.data as WithdrawConsentResult;
  },

  /** Borra la cuenta de forma permanente. Requiere la contraseña actual */
  deleteAccount: async (password: string): Promise<void> => {
    await api.delete('/user/me', { data: { password } });
  },
};
