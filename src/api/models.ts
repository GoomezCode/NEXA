import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';

import { useAuthStore } from '@/stores/auth-store';
import { useSettingsStore } from '@/stores/settings-store';
import { useModelStore } from '@/stores/model-store';

import { authorizedRequest } from './auth';
import { shouldRetryRequest } from './errors';
import { useConnectionStore } from '@/stores/connection-store';
import { ollamaChatModels } from './ollama';

export type Capability = 'chat' | 'stream' | 'tools' | 'vision' | 'json_mode';

export interface ModelInfo {
  /** ID do modelo no formato "provedor/nome" */
  model_id: string;
  /** Nome exibível do modelo */
  name: string;
  /** Provedor do modelo */
  provider: string;
  /** Família do modelo */
  family?: string | null;
  /** Indicador de capacidades (a API devolve uma lista) */
  capabilities?: Capability[];
  /** Contexto máximo em tokens */
  context_window?: number | null;
  size_bytes?: number | null;
  parameter_size?: string | null;
  quantization_level?: string | null;
  modified_at?: string | null;
  /** false = o modelo não pode ser escolhido */
  selectable?: boolean;
  key_source?: 'server' | 'user';
}

export interface ProviderInfo {
  provider: string;
  name: string;
  available: boolean;
  default_model: string | null;
  modelCount: number;
  key_source?: 'server' | 'user';
}

export interface ModelsResponse {
  default_model: string | null;
  providers: ProviderInfo[];
  models: ModelInfo[];
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

const CAPABILITIES: readonly Capability[] = [
  'chat',
  'stream',
  'tools',
  'vision',
  'json_mode',
];

function normalizeCapabilities(value: unknown): Capability[] {
  if (Array.isArray(value)) {
    return value.filter(
      (item): item is Capability =>
        typeof item === 'string' && CAPABILITIES.includes(item as Capability),
    );
  }

  const record = asRecord(value);

  if (!record) return [];

  return CAPABILITIES.filter((capability) => {
    const legacy = capability === 'json_mode' ? record.json : undefined;
    return Boolean(record[capability] ?? legacy);
  });
}

/**
 * Normaliza `GET /models` (Apêndice B) para o formato da UI. Aceita também
 * `providers` como lista de strings, usado por respostas antigas/testes, para
 * que um formato inesperado nunca derrube a árvore de componentes.
 */
export function normalizeModelsResponse(raw: unknown): ModelsResponse {
  const body = asRecord(raw) ?? {};
  const rawProviders = Array.isArray(body.providers) ? body.providers : [];

  const providers: ProviderInfo[] = rawProviders.flatMap((item) => {
    if (typeof item === 'string') {
      return [
        {
          provider: item,
          name: item,
          available: true,
          default_model: null,
          modelCount: 0,
          key_source: 'server',
        },
      ];
    }

    const record = asRecord(item);

    if (!record) return [];

    const nested = Array.isArray(record.models) ? record.models : [];
    const provider = asString(record.provider) ?? asString(record.name) ?? 'desconhecido';

    return [
      {
        provider,
        name: asString(record.name) ?? provider,
        available: record.available !== false,
        default_model: asString(record.default_model),
        modelCount: nested.length,
        key_source: record.key_source === 'user' ? 'user' : 'server',
      },
    ];
  });

  const rawModels = Array.isArray(body.models) ? body.models : [];

  const models: ModelInfo[] = rawModels.flatMap((item) => {
    const record = asRecord(item);

    if (!record) return [];

    const modelId = asString(record.model_id);

    if (!modelId) return [];

    return [
      {
        model_id: modelId,
        name: asString(record.name) ?? modelId,
        provider: asString(record.provider) ?? '',
        family: asString(record.family),
        capabilities: normalizeCapabilities(record.capabilities),
        context_window:
          typeof record.context_window === 'number' ? record.context_window : null,
        selectable: record.selectable !== false,
        key_source: record.key_source === 'user' ? 'user' : 'server',
      },
    ];
  });

  return {
    default_model: asString(body.default_model),
    providers,
    models,
  };
}

/** Catálogo de modelos disponíveis (`GET /models`). */
export function useModels(refresh = false) {
  const role = useAuthStore((state) => state.session?.role ?? null);
  const demoMode = useSettingsStore((state) => state.settings.demoMode);
  const offline = useConnectionStoreMode();
  const numCtx = useConnectionStore((state) => state.numCtx);
  const selectedModelId = useModelStore((state) => state.selectedModelId);
  const setSelectedModel = useModelStore((state) => state.setSelectedModel);

  const query = useQuery({
    queryKey: ['models', offline ? 'offline' : role, refresh, offline ? numCtx : null],
    queryFn: async () => offline ? (async () => {
      const entries = await ollamaChatModels();
      const models: ModelInfo[] = entries.map((item) => {
        const name = String(item.name);
        const details = (item.details && typeof item.details === 'object' ? item.details : {}) as Record<string, unknown>;
        return { model_id: `ollama/${name}`, name, provider: 'ollama', family: typeof details.family === 'string' ? details.family : null, capabilities: ['chat', 'stream'] as Capability[], context_window: numCtx, size_bytes: typeof item.size === 'number' ? item.size : null, parameter_size: typeof details.parameter_size === 'string' ? details.parameter_size : null, quantization_level: typeof details.quantization_level === 'string' ? details.quantization_level : null, modified_at: typeof item.modified_at === 'string' ? item.modified_at : null, selectable: true, key_source: 'server' as const };
      }).sort((a, b) => String(entries.find((item) => item.name === b.name)?.modified_at ?? '').localeCompare(String(entries.find((item) => item.name === a.name)?.modified_at ?? '')));
      return { default_model: models[0]?.model_id ?? null, providers: [{ provider: 'ollama', name: 'Ollama local', available: true, default_model: models[0]?.model_id ?? null, modelCount: models.length, key_source: 'server' }], models } satisfies ModelsResponse;
    })() :
      authorizedRequest<unknown>('/models', {
        query: refresh ? { refresh: true } : undefined,
      }).then(normalizeModelsResponse),
    enabled: offline || (!demoMode && role !== null),
    staleTime: offline ? 15_000 : 60_000,
    retry: shouldRetryRequest,
  });

  useEffect(() => {
    if (
      query.data &&
      selectedModelId &&
      !query.data.models.some((model) => model.model_id === selectedModelId)
    ) {
      setSelectedModel(null);
    }
  }, [query.data, selectedModelId, setSelectedModel]);

  return query;
}

function useConnectionStoreMode(): boolean {
  // Read reactively while retaining a synchronous value for the query function.
  return useConnectionStore((state) => state.mode === 'offline');
}
