import { act, render, renderHook } from '@testing-library/react';
import { useLayoutClass } from '@/hooks/use-layout-class';
import { usePointerType } from '@/hooks/use-pointer-type';
import { useElementSize } from '@/hooks/use-element-size';

const mediaState = new Map<string, boolean>();
const mediaListeners = new Map<string, Set<() => void>>();

beforeEach(() => {
  mediaState.clear();
  mediaListeners.clear();
  vi.spyOn(window, 'matchMedia').mockImplementation((query) => ({
    matches: mediaState.get(query) ?? false,
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: (_type: string, listener: EventListenerOrEventListenerObject) => {
      const listeners = mediaListeners.get(query) ?? new Set();
      listeners.add(listener as EventListener as () => void);
      mediaListeners.set(query, listeners);
    },
    removeEventListener: (_type: string, listener: EventListenerOrEventListenerObject) =>
      mediaListeners.get(query)?.delete(listener as EventListener as () => void),
    dispatchEvent: () => false,
  }) as MediaQueryList);
});

afterEach(() => vi.restoreAllMocks());

test('useLayoutClass atualiza classe e altura em mudanças de media query', () => {
  const { result } = renderHook(() => useLayoutClass());
  expect(result.current).toEqual({ layout: 'expanded', short: false });

  mediaState.set('(max-width: 47.999rem)', true);
  mediaState.set('(max-height: 32rem)', true);
  act(() => {
    mediaListeners.forEach((listeners) => listeners.forEach((listener) => listener()));
  });

  expect(result.current).toEqual({ layout: 'compact', short: true });
});

test('usePointerType detecta ponteiro grosso e atualiza quando muda', () => {
  const { result } = renderHook(() => usePointerType());
  expect(result.current).toBe('none');

  mediaState.set('(pointer: coarse)', true);
  act(() => mediaListeners.forEach((listeners) => listeners.forEach((listener) => listener())));
  expect(result.current).toBe('coarse');
});

test('useElementSize mede o contêiner e expõe as dimensões', () => {
  let observerCallback: ResizeObserverCallback | undefined;
  class MockResizeObserver {
    constructor(callback: ResizeObserverCallback) { observerCallback = callback; }
    observe() {}
    disconnect() {}
    unobserve() {}
  }
  vi.stubGlobal('ResizeObserver', MockResizeObserver);

  let measured = { width: 0, height: 0 };
  function Probe() {
    const size = useElementSize<HTMLDivElement>();
    measured = { width: size.width, height: size.height };
    return <div ref={size.ref} />;
  }
  const view = render(<Probe />);

  act(() => {
    observerCallback?.(
      [{ contentRect: { width: 240, height: 120 } } as ResizeObserverEntry],
      {} as ResizeObserver,
    );
  });

  expect(measured).toEqual({ width: 240, height: 120 });
  expect(view.container.firstElementChild).toHaveStyle({ '--element-width': '240px', '--element-height': '120px' });
});
