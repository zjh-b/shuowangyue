/// <reference types="vite/client" />

declare const __GAME_VERSION__: string;

interface ImportMetaEnv {
  readonly VITE_FEEDBACK_FORM_ID?: string;
  readonly VITE_ROOMS_API_URL?: string;
}
