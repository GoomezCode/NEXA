import { describe, expect, it } from 'vitest';

import { splitMarkdownBlocks } from '@/lib/split-markdown-blocks';

describe('splitMarkdownBlocks', () => {
  it('usa os limites do AST e preserva listas e cercas de código', () => {
    const source = '# Título\n\n1. Primeiro\n2. Segundo\n\n```ts\nconst x = 1;\n\nconsole.log(x);\n```';
    const blocks = splitMarkdownBlocks(source);

    expect(blocks).toHaveLength(3);
    expect(blocks[0]).toBe('# Título');
    expect(blocks[1]).toBe('1. Primeiro\n2. Segundo');
    expect(blocks[2]).toContain('const x = 1;\n\nconsole.log(x);');
    expect(blocks.join('\n\n')).toBe(source);
  });

  it('retorna lista vazia para conteúdo vazio', () => {
    expect(splitMarkdownBlocks('')).toEqual([]);
  });
});
