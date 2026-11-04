import type { AuthRole } from '@/stores/auth-store';

export type SkillLimit = number | null;
export function skillLimitFor(input: { offline: boolean; role: AuthRole | null }): SkillLimit {
  if (input.offline || input.role === 'admin') return null;
  return input.role === 'user' ? 5 : 2;
}
export class SkillLimitError extends Error {
  constructor(public readonly limit: number) {
    super(`Você atingiu o limite de ${limit} skills.`);
    this.name = 'SkillLimitError';
  }
}
