export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

export async function blobToBase64(blob: Blob): Promise<string> {
  let bytes: Uint8Array;
  if (typeof blob.arrayBuffer === 'function') {
    bytes = new Uint8Array(await blob.arrayBuffer());
  } else {
    bytes = await new Promise<Uint8Array>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => reader.result instanceof ArrayBuffer
        ? resolve(new Uint8Array(reader.result))
        : reject(new Error('Não foi possível ler os bytes do anexo.'));
      reader.onerror = () => reject(reader.error ?? new Error('Não foi possível ler os bytes do anexo.'));
      reader.readAsArrayBuffer(blob);
    });
  }
  return bytesToBase64(bytes);
}
