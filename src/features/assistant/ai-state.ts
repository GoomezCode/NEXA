import type { AiState } from '@/api/types';

export const AI_STATE_LABEL: Record<AiState, string> = {
  idle: 'EM ESPERA',
  listening: 'OUVINDO',
  processing: 'PROCESSANDO',
  responding: 'RESPONDENDO',
  error: 'ERRO',
};
