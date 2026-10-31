import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ErrorBoundary } from '@/components/ErrorBoundary';

function Bomb({ armed }: { armed: boolean }) {
  if (armed) {
    throw new Error('falha simulada');
  }

  return <p>conteúdo recuperado</p>;
}

function Harness() {
  const [armed, setArmed] = useState(true);

  return (
    <ErrorBoundary onReset={() => setArmed(false)}>
      <Bomb armed={armed} />
    </ErrorBoundary>
  );
}

let consoleError: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  cleanup();
  consoleError.mockRestore();
});

describe('ErrorBoundary', () => {
  it('renderiza os filhos quando não há erro', () => {
    render(
      <ErrorBoundary>
        <p>tudo certo</p>
      </ErrorBoundary>,
    );

    expect(screen.getByText('tudo certo')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('mostra o fallback acessível e registra a falha', () => {
    render(
      <ErrorBoundary>
        <Bomb armed />
      </ErrorBoundary>,
    );

    const fallback = screen.getByRole('alert');
    expect(fallback).toHaveTextContent('Interface interrompida');
    expect(fallback).toHaveTextContent(/histórico local está preservado/i);
    expect(screen.getByRole('button', { name: 'Tentar novamente' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Recarregar página' })).toBeInTheDocument();
    expect(consoleError).toHaveBeenCalled();
  });

  it('volta a renderizar os filhos depois de tentar novamente', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    expect(screen.getByRole('alert')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }));

    expect(await screen.findByText('conteúdo recuperado')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
