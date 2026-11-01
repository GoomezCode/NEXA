import { z } from 'zod';

const frontendEnvSchema = z.object({
  VITE_API_URL: z
    .string()
    .trim()
    .min(1)
    .refine((value) => value.startsWith('/') || /^https?:\/\/[^\s]+$/i.test(value), {
      message: 'VITE_API_URL deve ser um caminho relativo ou uma URL HTTP(S).',
    })
    .default('/api/v1'),
  VITE_DEMO_MODE: z.enum(['true', 'false']).default('false'),
  VITE_REGISTRATION_ENABLED: z.enum(['true', 'false']).default('false'),
});

const parsed = frontendEnvSchema.safeParse(import.meta.env);

if (!parsed.success) {
  throw new Error(`Configuração inválida do frontend: ${parsed.error.message}`);
}

export const appEnv = {
  apiUrl: parsed.data.VITE_API_URL,
  demoMode: parsed.data.VITE_DEMO_MODE === 'true',
  registrationEnabled: parsed.data.VITE_REGISTRATION_ENABLED === 'true',
};
