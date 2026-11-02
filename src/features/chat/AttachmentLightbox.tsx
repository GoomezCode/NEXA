import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';

export default function AttachmentLightbox({
  open,
  onOpenChange,
  src,
  alt,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  src: string;
  alt: string;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[95] nexa-modal-overlay backdrop-blur-sm" />
        <Dialog.Content className="fixed inset-4 z-[96] flex items-center justify-center outline-none sm:inset-8" aria-label={`Imagem: ${alt}`}>
          <Dialog.Title className="sr-only">Imagem anexada: {alt}</Dialog.Title>
          <Dialog.Close asChild>
            <button type="button" className="absolute right-0 top-0 z-10 inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-border bg-surface text-foreground" aria-label="Fechar imagem">
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </Dialog.Close>
          <img src={src} alt={alt} className="max-h-full max-w-full rounded-xl object-contain" />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
