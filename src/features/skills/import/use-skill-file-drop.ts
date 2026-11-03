import { useEffect, useRef, useState } from 'react';

export function useSkillFileDrop(onFiles: (files: File[]) => void) {
  const ref = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const depth = useRef(0);
  const callback = useRef(onFiles);
  useEffect(() => { callback.current = onFiles; }, [onFiles]);

  useEffect(() => {
    const area = ref.current;
    if (!area) return;
    const hasFiles = (event: DragEvent) => Array.from(event.dataTransfer?.types ?? []).includes('Files');
    const enter = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      depth.current += 1;
      setDragging(true);
    };
    const over = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
    };
    const leave = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      depth.current = Math.max(0, depth.current - 1);
      if (depth.current === 0) setDragging(false);
    };
    const drop = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      depth.current = 0;
      setDragging(false);
      callback.current(Array.from(event.dataTransfer?.files ?? []));
    };
    area.addEventListener('dragenter', enter);
    area.addEventListener('dragover', over);
    area.addEventListener('dragleave', leave);
    area.addEventListener('drop', drop);
    return () => {
      area.removeEventListener('dragenter', enter);
      area.removeEventListener('dragover', over);
      area.removeEventListener('dragleave', leave);
      area.removeEventListener('drop', drop);
    };
  }, []);

  return { dropRef: ref, isDragging: dragging };
}
