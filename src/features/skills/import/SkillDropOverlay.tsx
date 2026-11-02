import { FileUp } from 'lucide-react';

export function SkillDropOverlay() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-2 z-20 flex items-center justify-center rounded-2xl border-2 border-dashed border-primary bg-surface/95 p-6 text-center shadow-xl">
      <div>
        <FileUp className="mx-auto h-9 w-9 text-primary" />
        <p className="mt-3 font-mono text-sm uppercase tracking-wider text-primary">
          Solte o arquivo .md aqui para criar a skill
        </p>
      </div>
    </div>
  );
}
