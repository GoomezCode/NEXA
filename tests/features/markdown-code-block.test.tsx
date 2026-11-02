import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { MarkdownContent } from '@/features/chat/MarkdownContent';

describe('MarkdownContent', () => {
  it('rotula o bloco de código com a linguagem e oferece cópia', async () => {
    render(<MarkdownContent content={'```ts\nconst answer = 42;\n```'} />);

    expect(await screen.findByText('ts')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /copiar/i })).toBeInTheDocument();
    expect(document.querySelector('pre')?.textContent).toContain('const answer = 42;');
  });
});
