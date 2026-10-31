import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Executado antes de renderizar os filhos novamente. */
  onReset?: () => void;
}

interface ErrorBoundaryState {
  failed: boolean;
}

/**
 * Captura falhas de renderização da árvore abaixo e oferece recuperação sem
 * recarregar a página. O histórico local fica intacto (IndexedDB/localStorage).
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('NEXA: erro não tratado na interface.', error, info);
  }

  private retry = () => {
    this.props.onReset?.();
    this.setState({ failed: false });
  };

  render() {
    if (!this.state.failed) {
      return this.props.children;
    }

    return (
      <div
        role="alert"
        className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background p-6 text-center"
      >
        <p className="font-mono text-2xs uppercase tracking-[0.28em] text-danger">
          falha no núcleo
        </p>
        <h1 className="font-display text-xl tracking-[0.12em] text-foreground">
          Interface interrompida
        </h1>
        <p className="max-w-sm text-sm leading-relaxed text-muted">
          Um erro inesperado interrompeu a NEXA. Seu histórico local está preservado.
        </p>

        <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            onClick={this.retry}
            className="inline-flex min-h-11 items-center rounded-xl border border-primary/35 bg-primary/10 px-4 py-2 font-mono text-2xs uppercase tracking-[0.14em] text-primary transition hover:bg-primary/15"
          >
            Tentar novamente
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex min-h-11 items-center rounded-xl border border-white/10 px-4 py-2 font-mono text-2xs uppercase tracking-[0.14em] text-muted transition hover:border-white/20 hover:text-foreground"
          >
            Recarregar página
          </button>
        </div>
      </div>
    );
  }
}
