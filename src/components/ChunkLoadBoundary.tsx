import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  failed: boolean;
}

/** Recovers the UI when a lazy chunk cannot be downloaded on a weak connection. */
export class ChunkLoadBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  render() {
    if (this.state.failed) {
      return (
        <div role="alert" className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
          <p className="text-sm text-foreground">Não foi possível carregar esta tela.</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="min-h-11 rounded-xl border border-primary/30 bg-primary/10 px-4 py-2 font-mono text-xs text-primary transition active:scale-95"
          >
            Tentar novamente
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
