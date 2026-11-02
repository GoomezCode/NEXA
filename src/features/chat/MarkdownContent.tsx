import { lazy, memo, Suspense, useState, type ReactElement, type ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';
import remarkGfm from 'remark-gfm';
import { splitMarkdownBlocks } from '@/lib/split-markdown-blocks';

const HighlightedMarkdownBlock = lazy(() => import('./HighlightedMarkdownBlock'));

const MarkdownBlock = memo(function MarkdownBlock({ source }: { source: string }) {
  if (source.includes('```')) {
    return <Suspense fallback={<PlainMarkdown source={source} />}><HighlightedMarkdownBlock source={source} /></Suspense>;
  }
  return <PlainMarkdown source={source} />;
});

function PlainMarkdown({ source }: { source: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeSanitize]}
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
    <div className="nexa-code-block my-3 min-w-0 overflow-hidden rounded-xl border">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <span className="text-xs text-muted">Código</span>
        <button type="button" onClick={() => void copy()} className="nexa-code-copy">
          {copied ? 'Copiado!' : 'Copiar'}
        </button>
      </div>
      <pre className="max-w-full overflow-x-auto p-4 font-mono text-xs leading-relaxed">{children}</pre>
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

export function MarkdownContent({ content }: { content: string }) {
  return <>{splitMarkdownBlocks(content).map((source, index) => <MarkdownBlock key={index} source={source} />)}</>;
}
