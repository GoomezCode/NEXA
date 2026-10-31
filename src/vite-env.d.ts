/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_DEMO_MODE?: string;
  readonly VITE_APP_NAME?: string;
  readonly VITE_MOCK_TOKEN_DELAY?: string;
  readonly VITE_AUTH_STORAGE?: 'session' | 'memory';
  readonly VITE_REGISTRATION_ENABLED?: string;
  readonly VITE_OLLAMA_URL?: string;
  readonly VITE_OLLAMA_NUM_CTX?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
