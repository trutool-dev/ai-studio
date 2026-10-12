/**
 * Utilidad para extraer mensajes de error de respuestas Axios.
 * Soporta el formato legacy { message } y el formato PR-4 { error, details }.
 */
export function extractApiError(err: any, fallback: string): string {
  const data = err?.response?.data;
  if (!data) return fallback;

  // Formato PR-4: { error: 'VALIDATION_ERROR', details: ['campo: mensaje', ...] }
  if (Array.isArray(data.details) && data.details.length > 0) {
    return data.details[0];
  }

  // Formato legacy / errores con mensaje único
  return data.message ?? data.error ?? fallback;
}
