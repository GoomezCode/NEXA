import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

import { createId } from '@/lib/id';
import type { AttachmentMeta } from '@/api/types';

const MAX_PAGES = 50;
const MAX_EXTRACTED_CHARS = 500_000;

export async function processPdf(
  file: File,
  bytes: Uint8Array,
  name: string,
): Promise<{ meta: AttachmentMeta; blob: Blob; text: string }> {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  const loadingTask = pdfjs.getDocument({ data: bytes });
  const document = await loadingTask.promise;
  try {
    if (document.numPages > MAX_PAGES) throw new Error('PDFs podem ter até 50 páginas.');
    const pages: string[] = [];
    let chars = 0;
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      const pageText = content.items.flatMap((item) => 'str' in item ? [item.str] : []).join(' ');
      if (pageText) {
        const remaining = MAX_EXTRACTED_CHARS - chars;
        pages.push(pageText.slice(0, remaining));
        chars += Math.min(pageText.length, remaining);
      }
      page.cleanup();
      if (chars >= MAX_EXTRACTED_CHARS) break;
    }
    const text = pages.join('\n\n');
    if (!text.trim()) throw new Error('PDF sem texto selecionável.');
    const meta: AttachmentMeta = {
      id: createId('att'), kind: 'pdf', name, mime: 'application/pdf', size: file.size,
      pages: document.numPages, textChars: text.length,
      truncated: chars >= MAX_EXTRACTED_CHARS,
      createdAt: new Date().toISOString(),
    };
    return { meta, blob: file, text };
  } finally {
    await loadingTask.destroy();
  }
}
