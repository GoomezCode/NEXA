import { describe, expect, it } from 'vitest';

import { calculateCoreMetrics } from '@/features/layout/use-core-metrics';

describe('calculateCoreMetrics', () => {
  it('calcula tokens e médias somente sobre as métricas disponíveis', () => {
    const result = calculateCoreMetrics([
      { inputTokens: 10, outputTokens: 20, firstTokenMs: 1000, tokensPerSecond: 10, durationMs: 3000, recordedAt: 1 },
      { inputTokens: 4, outputTokens: 8, durationMs: 3000, recordedAt: 2 },
      { inputTokens: 6, outputTokens: 12, firstTokenMs: 3000, tokensPerSecond: 20, durationMs: 3000, recordedAt: 3 },
    ]);
    expect(result.tokenTotals).toEqual({ input: 20, output: 40 });
    expect(result.averageLatency).toBe(2000);
    expect(result.averageSpeed).toBe(15);
    expect(result.latest?.recordedAt).toBe(3);
  });

  it('não produz médias para uma conversa sem medições', () => {
    const result = calculateCoreMetrics([]);
    expect(result.averageLatency).toBeUndefined();
    expect(result.averageSpeed).toBeUndefined();
  });
});
