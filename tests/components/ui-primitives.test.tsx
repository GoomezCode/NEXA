import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Badge } from '@/components/ui/Badge';
import { Button, IconButton } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Panel } from '@/components/ui/Panel';
import { Skeleton } from '@/components/ui/Skeleton';
import { Switch } from '@/components/ui/Switch';

describe('primitivos de interface', () => {
  it('expõe variante, ref e rótulo acessível nos botões', () => {
    const ref = vi.fn();
    render(<><Button variant="danger">Excluir</Button><IconButton label="Abrir painel" ref={ref}>i</IconButton></>);
    expect(screen.getByRole('button', { name: 'Excluir' })).toHaveClass('bg-danger/10');
    expect(screen.getByRole('button', { name: 'Abrir painel' })).toBeInTheDocument();
    expect(ref).toHaveBeenCalled();
  });

  it('liga a validação ao campo e mantém rótulo e descrição do painel', () => {
    render(<><Field id="email" label="E-mail" error="E-mail inválido" /><Panel title="Conta"><p>Conteúdo do painel</p></Panel></>);
    expect(screen.getByLabelText('E-mail')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('E-mail')).toHaveAttribute('aria-describedby', 'email-error');
    expect(screen.getByRole('region', { name: 'Conta' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Conta' })).toHaveClass('p-4', 'sm:p-5');
  });

  it('aciona o switch, renderiza o badge e oculta o skeleton da tecnologia assistiva', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<><Switch label="Voz" checked={false} onChange={onChange} /><Badge tone="success">Ativo</Badge><Skeleton data-testid="skeleton" /></>);
    await user.click(screen.getByRole('switch', { name: 'Voz' }));
    expect(onChange).toHaveBeenCalledWith(true);
    expect(screen.getByText('Ativo')).toBeInTheDocument();
    expect(screen.getByTestId('skeleton')).toHaveAttribute('aria-hidden', 'true');
  });
});
