import { normalizeTags } from '@/lib/tags';
import { SKILL_LIMITS } from '../api';

export interface ParsedSkillFile {
  fileName: string;
  name: string;
  description: string;
  instructions: string;
  tags: string[];
  warnings: string[];
}

export type ParseSkillResult =
  | { ok: true; value: ParsedSkillFile }
  | { ok: false; error: string };

const KNOWN_FIELDS = new Set(['name', 'description', 'tags']);
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

function unquote(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length < 2) return trimmed;
  const quote = trimmed[0];
  if ((quote !== '"' && quote !== "'") || trimmed.at(-1) !== quote) return trimmed;
  const content = trimmed.slice(1, -1);
  return quote === '"' ? content.replace(/\\(["\\])/g, '$1') : content.replace(/''/g, "'");
}

function splitInlineList(value: string): string[] {
  const contents = value.slice(1, -1);
  const values: string[] = [];
  let current = '';
  let quote = '';
  for (const char of contents) {
    if ((char === '"' || char === "'") && (!quote || quote === char)) quote = quote ? '' : char;
    if (char === ',' && !quote) {
      values.push(unquote(current));
      current = '';
    } else current += char;
  }
  if (current.trim()) values.push(unquote(current));
  return values;
}

function filenameName(fileName: string): string {
  const base = fileName.split(/[\\/]/).at(-1) ?? fileName;
  const normalized = base.replace(/\.(md|markdown|txt)$/i, '').replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim().toLocaleLowerCase('pt-BR');
  return normalized.replace(/^\p{L}/u, (letter) => letter.toLocaleUpperCase('pt-BR'));
}

function fallbackName(fileName: string, body: string): string {
  const heading = body.match(/^\s*#\s+(.+?)\s*#*\s*$/m)?.[1]?.trim();
  return heading || filenameName(fileName);
}

function parseFrontmatter(frontmatter: string): { fields: Map<string, string | string[]>; ignored: string[] } {
  const lines = frontmatter.split('\n');
  const fields = new Map<string, string | string[]>();
  const ignored = new Set<string>();
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]!;
    const match = line.match(/^([\w-]+)\s*:\s*(.*)$/);
    if (!match) {
      if (line.trim() && !line.trimStart().startsWith('#')) ignored.add(line.trim().split(':')[0] || 'campo inválido');
      continue;
    }
    const key = match[1]!.toLowerCase();
    const raw = match[2]!.trim();
    if (!KNOWN_FIELDS.has(key)) {
      ignored.add(key);
      while (i + 1 < lines.length && (/^\s+/.test(lines[i + 1]!) || !lines[i + 1]!.trim())) i += 1;
      continue;
    }
    if (key === 'tags') {
      if (raw.startsWith('[') && raw.endsWith(']')) fields.set(key, splitInlineList(raw));
      else if (raw) fields.set(key, unquote(raw).split(','));
      else {
        const values: string[] = [];
        while (i + 1 < lines.length && /^\s+-\s+/.test(lines[i + 1]!)) {
          values.push(unquote(lines[++i]!.replace(/^\s+-\s+/, '')));
        }
        fields.set(key, values);
      }
      continue;
    }
    if ((key === 'description') && (raw === '>' || raw === '|')) {
      const block: string[] = [];
      while (i + 1 < lines.length && (/^\s+/.test(lines[i + 1]!) || !lines[i + 1]!.trim())) {
        block.push(lines[++i]!.trim());
      }
      fields.set(key, block.join(raw === '>' ? ' ' : '\n').trim());
    } else fields.set(key, unquote(raw));
  }
  return { fields, ignored: [...ignored] };
}

export function parseSkillMarkdown(fileName: string, rawText: string): ParseSkillResult {
  if (rawText.includes('\0')) return { ok: false, error: 'Não foi possível ler o arquivo.' };
  const text = rawText.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').replace(CONTROL_CHARS, '');
  if (!text.trim()) return { ok: false, error: 'O arquivo está vazio ou não tem instruções.' };

  let body = text;
  let fields = new Map<string, string | string[]>();
  let ignored: string[] = [];
  const lines = text.split('\n');
  if (lines[0]?.trim() === '---') {
    const closing = lines.findIndex((line, index) => index > 0 && line.trim() === '---');
    if (closing >= 0) {
      const parsed = parseFrontmatter(lines.slice(1, closing).join('\n'));
      fields = parsed.fields;
      ignored = parsed.ignored;
      body = lines.slice(closing + 1).join('\n');
    }
  }

  const warnings: string[] = [];
  if (ignored.length) warnings.push(`${ignored.length} ${ignored.length === 1 ? 'campo ignorado' : 'campos ignorados'}: ${ignored.join(', ')}`);
  const rawName = typeof fields.get('name') === 'string' ? fields.get('name') as string : '';
  const name = (rawName.trim() || fallbackName(fileName, body)).trim();
  const rawDescription = typeof fields.get('description') === 'string' ? fields.get('description') as string : '';
  let description = rawDescription.trim();
  let instructions = body.trim();

  if (!fields.size) {
    const lines = body.split('\n');
    const headingIndex = lines.findIndex((line) => /^\s*#\s+/.test(line));
    if (headingIndex >= 0) lines.splice(headingIndex, 1);
    while (lines.length && !lines[0]!.trim()) lines.shift();
    if (!description && lines.length) {
      const paragraph: string[] = [];
      while (lines.length && lines[0]!.trim()) paragraph.push(lines.shift()!.trim());
      const candidate = paragraph.join(' ');
      if (candidate.length <= SKILL_LIMITS.description) description = candidate;
      else lines.unshift(candidate, '');
    }
    instructions = lines.join('\n').trim();
  }

  if (!instructions.trim()) return { ok: false, error: 'O arquivo está vazio ou não tem instruções.' };
  if (name.length > SKILL_LIMITS.name) warnings.push('Nome truncado para 60 caracteres.');
  if (description.length > SKILL_LIMITS.description) warnings.push('Descrição truncada para 200 caracteres.');
  if (instructions.length > SKILL_LIMITS.instructions) warnings.push('Instruções truncadas para 4.000 caracteres.');

  const rawTags = fields.get('tags');
  const tagValues = Array.isArray(rawTags) ? rawTags.filter((tag) => tag.trim().toLowerCase() !== 'skill') : [];
  const tags = normalizeTags(tagValues, { maxTags: SKILL_LIMITS.tags - 1, maxLength: SKILL_LIMITS.tag, required: [] });
  if (tagValues.length > tags.length) warnings.push('Algumas tags excedentes ou duplicadas foram descartadas.');
  if (tagValues.some((tag) => tag.trim().length > SKILL_LIMITS.tag)) warnings.push('Tags acima de 24 caracteres foram truncadas.');

  return {
    ok: true,
    value: {
      fileName,
      name: name.slice(0, SKILL_LIMITS.name),
      description: description.slice(0, SKILL_LIMITS.description),
      instructions: instructions.slice(0, SKILL_LIMITS.instructions),
      tags,
      warnings,
    },
  };
}
