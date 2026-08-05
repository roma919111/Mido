/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

declare const __APP_VERSION__: string;

interface ImportMetaEnv {
  readonly VITE_APP_USERNAME: string;
  readonly VITE_APP_PASSWORD: string;
  readonly VITE_PROVISION_WEBHOOK?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
