import { unified } from 'unified';
import remarkParse from 'remark-parse';

interface PositionedNode {
  position?: { start: { offset?: number }; end: { offset?: number } };
}

const parser = unified().use(remarkParse);

/** Split at top-level Markdown AST boundaries so closed blocks stay memoizable. */
export function splitMarkdownBlocks(source: string): string[] {
  if (!source) return [];
  const tree = parser.parse(source) as unknown as { children: PositionedNode[] };
  return tree.children.flatMap((node) => {
    const start = node.position?.start.offset;
    const end = node.position?.end.offset;
    return start === undefined || end === undefined ? [] : [source.slice(start, end)];
  });
}
