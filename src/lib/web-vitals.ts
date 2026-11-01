import { onCLS, onINP, onLCP, type Metric } from 'web-vitals';

function logMetric(metric: Metric) {
  console.info(`[web-vitals] ${metric.name}: ${Math.round(metric.value)} ${metric.rating}`);
}

export function reportWebVitals() {
  if (!import.meta.env.DEV) return;

  onCLS(logMetric);
  onINP(logMetric);
  onLCP(logMetric);
}
