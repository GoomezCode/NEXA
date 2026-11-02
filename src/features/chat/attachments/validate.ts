import { createId } from '@/lib/id';
import type { AttachmentKind, AttachmentMeta } from '@/api/types';

export const MAX_FILES = 5;
export const MAX_TEXT_BYTES = 2 * 1024 * 1024;
export const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
export const MAX_PDF_BYTES = 10 * 1024 * 1024;
const MAX_IMAGE_OUTPUT_BYTES = 1.5 * 1024 * 1024;
const MAX_IMAGE_SIDE = 1280;

export function resizeDimensions(width: number, height: number, maxSide = MAX_IMAGE_SIDE): { width: number; height: number } {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) throw new Error('Dimensões de imagem inválidas.');
  const scale = Math.min(1, maxSide / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}
const TEXT_EXTENSIONS = new Set('txt md csv tsv json xml yaml yml log html css js jsx ts tsx py java go rs sql sh c cpp h hpp toml ini'.split(' '));

export function sanitizeAttachmentName(name: string): string {
  const leaf = name.replace(/\\/g, '/').split('/').at(-1) ?? 'arquivo';
  // Nomes recebidos do sistema de arquivos podem conter controles invisíveis.
  // eslint-disable-next-line no-control-regex
  return leaf.replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 120) || 'arquivo';
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function sniffAttachmentKind(bytes: Uint8Array, name: string): AttachmentKind {
  const extensionStart = name.lastIndexOf('.');
  const ext = extensionStart > 0 ? name.slice(extensionStart + 1).toLowerCase() : '';
  const prefix = new TextDecoder().decode(bytes.slice(0, 1024)).trimStart().toLowerCase();
  if (ext === 'svg' || /<svg(?:\s|>)/.test(prefix) || (prefix.startsWith('<?xml') && /<svg(?:\s|>)/.test(prefix))) throw new Error('SVG não é aceito.');
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'image';
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image';
  if (new TextDecoder().decode(bytes.slice(0, 4)) === 'RIFF' && new TextDecoder().decode(bytes.slice(8, 12)) === 'WEBP') return 'image';
  if (new TextDecoder().decode(bytes.slice(0, 3)) === 'GIF') return 'image';
  if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) return 'pdf';
  if (bytes.includes(0)) throw new Error('Arquivo binário não suportado.');
  // Arquivos sem extensão (por exemplo, arquivos de instruções ou saída de
  // terminal) ainda podem ser texto simples. O conteúdo UTF-8 é a validação.
  if (TEXT_EXTENSIONS.has(ext) || ext === '') {
    try { new TextDecoder('utf-8', { fatal: true }).decode(bytes); return 'text'; }
    catch { throw new Error('Arquivo binário não suportado.'); }
  }
  throw new Error(`Formato não suportado: .${ext || 'desconhecido'}. Aceitos: arquivos de texto e imagens PNG, JPEG, WebP e GIF.`);
}

function sniffImageMime(bytes: Uint8Array): string {
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'image/png';
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (new TextDecoder().decode(bytes.slice(0, 4)) === 'RIFF') return 'image/webp';
  return 'image/gif';
}

export async function processTextOrImage(file: File): Promise<{ meta: AttachmentMeta; blob: Blob; text?: string }> {
  const name = sanitizeAttachmentName(file.name);
  const bytes = new Uint8Array(await file.arrayBuffer());
  const kind = sniffAttachmentKind(bytes, name);
  if (kind === 'pdf') {
    if (file.size > MAX_PDF_BYTES) throw new Error('Arquivos PDF podem ter até 10 MB.');
    const { processPdf } = await import('./pdf');
    return processPdf(file, bytes, name);
  }
  if (kind === 'image') return processImage(file, bytes, name);
  if (file.size > MAX_TEXT_BYTES) throw new Error('Arquivos de texto podem ter até 2 MB.');
  const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  const mime = 'text/plain';
  return { meta: { id: createId('att'), kind, name, mime, size: file.size, textChars: text.length, createdAt: new Date().toISOString() }, blob: new Blob([bytes], { type: mime }), text };
}

function canvasBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Não foi possível processar a imagem.')), type, quality);
  });
}

function makeCanvas(width: number, height: number): { canvas: HTMLCanvasElement; context: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Este navegador não oferece suporte ao processamento de imagens.');
  return { canvas, context };
}

async function processImage(file: File, bytes: Uint8Array, name: string): Promise<{ meta: AttachmentMeta; blob: Blob; thumb: Blob }> {
  if (file.size > MAX_IMAGE_BYTES) throw new Error('Imagens podem ter até 20 MB.');
  if (typeof createImageBitmap !== 'function') throw new Error('Este navegador não oferece suporte ao processamento de imagens.');
  const detected = sniffAttachmentKind(bytes, name);
  if (detected !== 'image') throw new Error('O conteúdo do arquivo não corresponde a uma imagem aceita.');
  const sourceMime = sniffImageMime(bytes);
  const source = new Blob([bytes.slice().buffer as ArrayBuffer], { type: sourceMime });
  const bitmap = await createImageBitmap(source, { imageOrientation: 'from-image' });
  try {
    const { width, height } = resizeDimensions(bitmap.width, bitmap.height);
    const { canvas, context } = makeCanvas(width, height);
    context.drawImage(bitmap, 0, 0, width, height);
    const hasTransparency = sourceMime === 'image/png' && context.getImageData(0, 0, width, height).data.some((_, index, pixels) => index % 4 === 3 && pixels[index]! < 255);
    const png = hasTransparency ? await canvasBlob(canvas, 'image/png', 1) : null;
    let output = png && png.size <= MAX_IMAGE_OUTPUT_BYTES ? png : await canvasBlob(canvas, 'image/webp', 0.85);
    if (output.type !== 'image/webp') output = await canvasBlob(canvas, 'image/jpeg', 0.85);
    if (output.size > MAX_IMAGE_OUTPUT_BYTES) {
      output = await canvasBlob(canvas, output.type === 'image/webp' ? 'image/webp' : 'image/jpeg', 0.7);
    }
    if (output.size > MAX_IMAGE_OUTPUT_BYTES) throw new Error('A imagem continua maior que 1,5 MB após a otimização.');
    const thumbScale = Math.min(1, 160 / Math.max(width, height));
    const thumbWidth = Math.max(1, Math.round(width * thumbScale));
    const thumbHeight = Math.max(1, Math.round(height * thumbScale));
    const thumbCanvas = makeCanvas(thumbWidth, thumbHeight);
    thumbCanvas.context.drawImage(canvas, 0, 0, thumbWidth, thumbHeight);
    const thumb = await canvasBlob(thumbCanvas.canvas, 'image/webp', 0.8);
    const meta: AttachmentMeta = {
      id: createId('att'), kind: 'image', name, mime: output.type, size: output.size,
      width, height, createdAt: new Date().toISOString(),
    };
    return { meta, blob: output, thumb };
  } finally {
    bitmap.close();
  }
}
