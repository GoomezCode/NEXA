/**
 * Configuração de URLs da API NEXA.
 *
 - Deriva `apiBase` e `apiOrigin` da `settings.apiUrl`.
 - Funções puras, testáveis fora do navegador.
 */

export function apiBase(apiUrl: string): string {
  return apiUrl.trim().replace(/\/+$/, '');
  // Retorna: '/api/v1' | 'https://api.x.com/api/v1'
}

export function apiOrigin(apiUrl: string): string {
  return apiBase(apiUrl).replace(/\/api\/v1$/, '');
  // Retorna: '' | 'https://api.x.com'
}

// Rotas nativas: ${apiBase}/auth/login, ${apiBase}/chat, ...
// Rotas de raiz: ${apiOrigin}/health, ${apiOrigin}/health/ready, ${apiOrigin}/docs