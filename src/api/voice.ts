import { authorizedFetch } from './auth';
import { request } from './client/http';

export interface VoiceHealth {
  status: 'ok' | 'unavailable';
  stt: boolean;
  model: string;
}

export function getVoiceHealth(): Promise<VoiceHealth> {
  return request<VoiceHealth>('/voice/health');
}

export async function transcribeVoice(audio: Blob, signal: AbortSignal): Promise<{ text: string }> {
  const response = await authorizedFetch('/voice/stt', {
    method: 'POST',
    body: audio,
    headers: { 'Content-Type': audio.type || 'audio/wav' },
    signal,
    timeoutMs: 120_000,
  });
  return response.json() as Promise<{ text: string }>;
}
