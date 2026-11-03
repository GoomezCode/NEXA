import { parseSkillMarkdown, type ParseSkillResult } from './parse-skill-md';

export const SKILL_FILE_MAX_BYTES = 100 * 1024;
const ACCEPTED_EXTENSION = /\.(md|markdown|txt)$/i;

export async function readSkillFile(file: File): Promise<ParseSkillResult> {
  if (!ACCEPTED_EXTENSION.test(file.name)) {
    return { ok: false, error: 'Formato não suportado. Use um arquivo .md, .markdown ou .txt.' };
  }
  if (file.size > SKILL_FILE_MAX_BYTES) return { ok: false, error: 'Arquivo grande demais (máx. 100 KB).' };
  try {
    const text = await file.text();
    if (text.includes('\0')) return { ok: false, error: 'Não foi possível ler o arquivo.' };
    return parseSkillMarkdown(file.name, text);
  } catch {
    return { ok: false, error: 'Não foi possível ler o arquivo.' };
  }
}
