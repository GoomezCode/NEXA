export function normalizeTags(values: string[], options: { maxTags: number; maxLength: number; required?: string[] }): string[] {
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const raw of [...(options.required ?? []), ...values]) {
    const tag = raw.trim().toLowerCase().slice(0, options.maxLength);
    if (!tag || seen.has(tag)) continue;
    seen.add(tag);
    tags.push(tag);
    if (tags.length >= options.maxTags) break;
  }
  return tags;
}
