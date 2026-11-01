import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  DEFAULT_SETTINGS,
  getSettingsSnapshot,
  resetSettingsForTests,
  useSettingsStore,
} from '@/stores/settings-store';

describe('settings-store', () => {
  beforeEach(() => {
    window.localStorage.clear();
    resetSettingsForTests();
  });

  it('começa com os padrões e TTS desligado', () => {
    const settings = getSettingsSnapshot();

    expect(settings).toEqual(DEFAULT_SETTINGS);
    expect(settings.ttsEnabled).toBe(false);
  });

  it('persiste alterações no localStorage', () => {
    useSettingsStore.getState().update({
      displayName: 'Marina',
      ttsEnabled: true,
      speechRate: 1.4,
      reducedMotion: true,
    });

    const raw = window.localStorage.getItem('nexa:settings:v1');
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw ?? '{}')).toMatchObject({
      displayName: 'Marina',
      ttsEnabled: true,
      speechRate: 1.4,
      reducedMotion: true,
    });
    expect(getSettingsSnapshot()).toMatchObject({ displayName: 'Marina', ttsEnabled: true });
  });

  it('recupera preferências válidas do localStorage', async () => {
    window.localStorage.setItem(
      'nexa:settings:v1',
      JSON.stringify({
        displayName: 'Operadora',
        ttsEnabled: true,
        speechRate: 99,
        reducedMotion: true,
      }),
    );

    vi.resetModules();
    const fresh = await import('@/stores/settings-store');

    expect(fresh.getSettingsSnapshot()).toMatchObject({
      displayName: 'Operadora',
      ttsEnabled: true,
      speechRate: 2,
      reducedMotion: true,
    });
  });

  it('migra o valor sentinela antigo do perfil para o campo vazio', async () => {
    window.localStorage.setItem('nexa:settings:v1', JSON.stringify({ displayName: 'Operador' }));
    vi.resetModules();
    const fresh = await import('@/stores/settings-store');
    expect(fresh.getSettingsSnapshot().displayName).toBe('');
  });

  it('ignora valores inválidos e restaura os padrões', () => {
    window.localStorage.setItem('nexa:settings:v1', '{ não é json');
    resetSettingsForTests();

    expect(getSettingsSnapshot()).toEqual(DEFAULT_SETTINGS);

    useSettingsStore.getState().update({ displayName: 'Marina', ttsEnabled: true });
    useSettingsStore.getState().reset();

    expect(window.localStorage.getItem('nexa:settings:v1')).toBeNull();
    expect(getSettingsSnapshot()).toEqual(DEFAULT_SETTINGS);
  });
});
