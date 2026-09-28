/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** "true" enables in-browser API mocks (MSW) for frontend-only development. */
  readonly VITE_API_MOCKS?: string;
  /** Public repository URL for the landing page. */
  readonly VITE_REPO_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
