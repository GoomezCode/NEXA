import { describe, expect, it } from 'vitest';

import { bytesToBase64 } from '@/features/chat/attachments/encode';
import { resizeDimensions, sanitizeAttachmentName, sniffAttachmentKind } from '@/features/chat/attachments/validate';

describe('processamento básico de anexos', () => {
  it('detecta tipos pelo conteúdo e recusa SVG e arquivos binários', () => {
    expect(sniffAttachmentKind(new Uint8Array([0x89, 0x50, 0x4e, 0x47]), 'imagem.bin')).toBe('image');
    expect(sniffAttachmentKind(new TextEncoder().encode('conteúdo simples'), 'dados.txt')).toBe('text');
    expect(() => sniffAttachmentKind(new TextEncoder().encode('<svg viewBox="0 0 1 1"></svg>'), 'imagem.txt')).toThrow('SVG');
    expect(() => sniffAttachmentKind(new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0]), 'arquivo.zip')).toThrow('binário');
  });

  it('limpa o nome e limita dimensões mantendo a proporção', () => {
    expect(sanitizeAttachmentName('../pasta/relatorio\u0000.txt')).toBe('relatorio.txt');
    expect(resizeDimensions(2560, 1280)).toEqual({ width: 1280, height: 640 });
    expect(resizeDimensions(800, 400)).toEqual({ width: 800, height: 400 });
  });

  it('converte bytes em base64 sem estouro de pilha em blobs grandes', () => {
    expect(bytesToBase64(new Uint8Array([0, 1, 2, 253, 254, 255]))).toBe('AAEC/f7/');
    expect(bytesToBase64(new Uint8Array(100_000))).toHaveLength(133_336);
  });
});
