/**
 * Firebase project configuration (web) — T-127 / T-250.
 *
 * These values are **not secrets**. A Firebase web "apiKey" is a public project
 * identifier that ships in every client bundle by design; access is gated by
 * Firebase Security Rules + App Check, not by hiding this key (see Firebase docs:
 * "Is it safe to expose Firebase config?"). Committing it keeps the web build
 * self-contained and matches the `projectId: strand-descent` the CI deploy step
 * already references.
 *
 * Each field can still be overridden at build time via a `VITE_FIREBASE_*` env
 * var (useful for a staging project or per-developer sandbox) without touching
 * code; the committed values are the production defaults.
 */

export interface FirebaseConfig {
  readonly apiKey: string;
  readonly authDomain: string;
  readonly projectId: string;
  readonly storageBucket: string;
  readonly messagingSenderId: string;
  readonly appId: string;
  readonly measurementId: string;
}

/** Reads `import.meta.env[key]` defensively (absent in node/test). */
function env(key: string): string | undefined {
  try {
    const meta = import.meta as unknown as { env?: Record<string, string | undefined> };
    return meta.env?.[key];
  } catch {
    return undefined;
  }
}

export const firebaseConfig: FirebaseConfig = {
  apiKey: env('VITE_FIREBASE_API_KEY') ?? 'AIzaSyC1KV6qSfAzPO8uTPldujoK0Pu7bXT8ijw',
  authDomain: env('VITE_FIREBASE_AUTH_DOMAIN') ?? 'strand-descent.firebaseapp.com',
  projectId: env('VITE_FIREBASE_PROJECT_ID') ?? 'strand-descent',
  storageBucket: env('VITE_FIREBASE_STORAGE_BUCKET') ?? 'strand-descent.firebasestorage.app',
  messagingSenderId: env('VITE_FIREBASE_MESSAGING_SENDER_ID') ?? '702398841150',
  appId: env('VITE_FIREBASE_APP_ID') ?? '1:702398841150:web:aa61c661816e6cbd482c6f',
  measurementId: env('VITE_FIREBASE_MEASUREMENT_ID') ?? 'G-4D9XG7WJCZ',
};
