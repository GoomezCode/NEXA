import { useMemo } from 'react';

import { useSessionMetricsStore, type ResponseMetric } from '@/stores/session-metrics-store';

const EMPTY_METRICS: ResponseMetric[] = [];

export function calculateCoreMetrics(rows: ResponseMetric[]) {
  const latencyRows = rows.filter((item) => item.firstTokenMs !== undefined);
  const speedRows = rows.filter((item) => item.tokensPerSecond !== undefined);
  return {
    rows,
    latest: rows.at(-1),
    tokenTotals: rows.reduce((sum, item) => ({
      input: sum.input + (item.inputTokens ?? 0),
      output: sum.output + (item.outputTokens ?? 0),
    }), { input: 0, output: 0 }),
    averageLatency: latencyRows.length ? latencyRows.reduce((sum, item) => sum + (item.firstTokenMs ?? 0), 0) / latencyRows.length : undefined,
    averageSpeed: speedRows.length ? speedRows.reduce((sum, item) => sum + (item.tokensPerSecond ?? 0), 0) / speedRows.length : undefined,
  };
}

export function useCoreMetrics(sessionId: string | null) {
  const rows = useSessionMetricsStore((state) => sessionId ? state.bySession[sessionId] ?? EMPTY_METRICS : EMPTY_METRICS);
  return useMemo(() => calculateCoreMetrics(rows), [rows]);
}
