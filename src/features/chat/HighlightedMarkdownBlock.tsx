import { useState, type ReactElement, type ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import rehypeSanitize from 'rehype-sanitize';
import remarkGfm from 'remark-gfm';
import 'highlight.js/styles/github-dark.css';

export default function HighlightedMarkdownBlock({ source }: { source: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeSanitize, rehypeHighlight]}
      components={{
        table: ({ children }) => <div className="nexa-markdown-table"><table>{children}</table></div>,
        pre: ({ children }) => <CodeBlock>{children}</CodeBlock>,
      }}
    >
      {source}
    </ReactMarkdown>
  );
}

function CodeBlock({ children }: { children?: ReactNode }) {
  const [copied, setCopied] = useState(false);
  const text = extractText(children);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="group relative my-3 min-w-0">
      <button type="button" onClick={() => void copy()} className="absolute right-2 top-2 z-10 min-h-9 rounded-lg border border-border bg-surface px-2.5 text-2xs text-muted opacity-100 transition hover:text-primary sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
        {copied ? 'Copiado' : 'Copiar código'}
      </button>
      <pre className="max-w-full overflow-x-auto rounded-xl border border-border/60 bg-background/70 p-3 pt-12 font-mono text-xs leading-relaxed">{children}</pre>
    </div>
  );
}

function extractText(value: ReactNode): string {
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (Array.isArray(value)) return value.map(extractText).join('');
  if (value && typeof value === 'object' && 'props' in value) {
    return extractText((value as ReactElement<{ children?: ReactNode }>).props.children);
  }
  return '';
}
