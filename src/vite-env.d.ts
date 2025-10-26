/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SHEET_WEBAPP_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
