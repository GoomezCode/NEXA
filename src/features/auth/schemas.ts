import { z } from 'zod';

const username = z
  .string()
  .trim()
  .min(3, 'Mínimo de 3 caracteres.')
  .max(64, 'Máximo de 64 caracteres.')
  .regex(/^[a-zA-Z0-9._-]+$/, 'Use letras, números, ponto, hífen ou sublinhado.');

const password = z.string().min(8, 'Mínimo de 8 caracteres.').max(128, 'Máximo de 128 caracteres.');

export const loginSchema = z.object({
  username: z.string().trim().min(1, 'Informe o usuário.'),
  password: z.string().min(1, 'Informe a senha.'),
});

export const registerSchema = z
  .object({
    username,
    email: z.union([z.literal(''), z.string().trim().email('E-mail inválido.')]),
    password,
    confirm: z.string(),
  })
  .refine((value) => value.password === value.confirm, {
    path: ['confirm'],
    message: 'As senhas não conferem.',
  });

const authFormFields = z.object({
  username: z.string(),
  email: z.string(),
  password: z.string(),
  confirm: z.string(),
});

export function authFormSchema(mode: 'login' | 'register') {
  return authFormFields.superRefine((values, context) => {
    const result = mode === 'login' ? loginSchema.safeParse(values) : registerSchema.safeParse(values);
    if (result.success) return;
    for (const issue of result.error.issues) {
      context.addIssue({ code: 'custom', path: issue.path, message: issue.message });
    }
  });
}

export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};

  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? '');
    if (key && !out[key]) out[key] = issue.message;
  }

  return out;
}
