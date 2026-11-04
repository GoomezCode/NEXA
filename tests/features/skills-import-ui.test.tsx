import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { SkillsPanel } from '@/features/skills/SkillsPanel';
import { clearSkillsStorage, createSkill, resetSkillsCacheForTests } from '@/features/skills/api';

function renderPanel() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><SkillsPanel /></QueryClientProvider>);
}

const sample = '---\nname: Guia de Python\ndescription: Ao estudar Python\ntags: [python, estudo]\n---\nExplique com exemplos.';

beforeEach(async () => {
  await clearSkillsStorage();
  resetSkillsCacheForTests();
});
afterEach(() => cleanup());

describe('interface de importação de skills', () => {
  it('preenche o formulário pelo seletor sem salvar automaticamente', async () => {
    const user = userEvent.setup();
    renderPanel();
    await user.upload(screen.getByLabelText('Selecionar arquivos de skills'), new File([sample], 'guia.md', { type: 'text/markdown' }));
    expect(await screen.findByDisplayValue('Guia de Python')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Ao estudar Python')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Explique com exemplos.')).toBeInTheDocument();
    expect(screen.getByText('guia.md')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Guia de Python' })).not.toBeInTheDocument();
  });

  it('soltar arquivo abre o formulário e arrastar texto não mostra o overlay', async () => {
    const user = userEvent.setup();
    renderPanel();
    const area = screen.getByTestId('skills-drop-area');
    fireEvent.dragEnter(area, { dataTransfer: { types: ['text/plain'], files: [] } });
    expect(screen.queryByText('Solte o arquivo .md aqui para criar a skill')).not.toBeInTheDocument();
    const file = new File([sample], 'guia.md', { type: 'text/markdown' });
    const dataTransfer = { types: ['Files'], files: [file], dropEffect: 'none' } as unknown as DataTransfer;
    fireEvent.dragEnter(area, { dataTransfer });
    expect(screen.getByText('Solte o arquivo .md aqui para criar a skill')).toBeInTheDocument();
    fireEvent.drop(area, { dataTransfer });
    expect(await screen.findByDisplayValue('Guia de Python')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
  });

  it('não abre o formulário se o convidado já atingiu o limite', async () => {
    await createSkill({ name: 'Uma', description: '', instructions: 'A', tags: [] });
    await createSkill({ name: 'Duas', description: '', instructions: 'B', tags: [] });
    resetSkillsCacheForTests();
    const user = userEvent.setup();
    renderPanel();
    expect(await screen.findByText('2 de 2 skills')).toBeInTheDocument();
    await user.upload(screen.getByLabelText('Selecionar arquivos de skills'), new File([sample], 'guia.md', { type: 'text/markdown' }));
    expect((await screen.findAllByRole('alert'))[0]).toHaveTextContent('Você usou 2 de 2 skills');
    expect(screen.queryByDisplayValue('Guia de Python')).not.toBeInTheDocument();
  });

  it('mostra o resumo de lote e permite desmarcar duplicatas', async () => {
    await createSkill({ name: 'Guia de Python', description: '', instructions: 'Já existe.', tags: [] });
    resetSkillsCacheForTests();
    const user = userEvent.setup();
    renderPanel();
    await user.upload(screen.getByLabelText('Selecionar arquivos de skills'), [
      new File([sample], 'duplicada.md', { type: 'text/markdown' }),
      new File(['---\nname: Nova skill\n---\nInstruções novas.'], 'nova.md', { type: 'text/markdown' }),
    ]);
    expect(await screen.findByRole('heading', { name: 'Resumo da importação' })).toBeInTheDocument();
    expect(screen.getByText(/Já existe skill com esse nome/)).toBeInTheDocument();
    const duplicateCheckbox = screen.getByRole('checkbox', { name: 'Selecionar duplicada.md' });
    expect(duplicateCheckbox).toBeChecked();
    await user.click(duplicateCheckbox);
    await waitFor(() => expect(duplicateCheckbox).not.toBeChecked());
  });
});
