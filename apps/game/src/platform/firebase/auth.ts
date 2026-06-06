import { type Auth, getAuth, onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import { getFirebaseApp, isBrowser } from './app';

/**
 * Anonymous authentication — T-127 (TDD §11.1).
 *
 * Every install gets a Firebase-generated anonymous UID on first launch; that
 * UID is the only identifier (no email, no name). It persists across sessions in
 * the SDK's local store, so a returning player keeps the same UID without any
 * sign-in step. Cross-device sync is explicitly *not* built on this (native
 * iCloud / Play Games handle cloud save, TDD §10.1) — the UID is for backend
 * identity + anonymised analytics.
 *
 * The whole thing is best-effort: the game must run fully offline, so a failure
 * (no network, auth disabled, blocked) resolves to `null` rather than throwing.
 * Callers treat "no UID yet" as a normal state.
 */

let authPromise: Promise<string | null> | null = null;

/** Resolves the cached browser Auth instance, or null outside a browser. */
function getAuthInstance(): Auth | null {
  const app = getFirebaseApp();
  if (app === null) return null;
  return getAuth(app);
}

/**
 * Ensures the player is signed in anonymously and resolves their UID. Idempotent
 * and memoised: concurrent callers share one in-flight sign-in, and a returning
 * session resolves to the already-restored UID. Resolves `null` if auth is
 * unavailable (offline / non-browser / disabled) — never rejects.
 */
export function ensureAnonymousAuth(): Promise<string | null> {
  if (authPromise !== null) return authPromise;

  authPromise = (async (): Promise<string | null> => {
    const auth = getAuthInstance();
    if (auth === null) return null;
    try {
      // A persisted session may still be restoring; if a user is already present
      // use it, otherwise create the anonymous account.
      if (auth.currentUser !== null) return auth.currentUser.uid;
      const cred = await signInAnonymously(auth);
      return cred.user.uid;
    } catch {
      // Offline, auth disabled, or blocked — degrade silently to no-UID.
      return null;
    }
  })();

  return authPromise;
}

/** The current anonymous UID if one is already established, else null (sync). */
export function currentUid(): string | null {
  const auth = getAuthInstance();
  return auth?.currentUser?.uid ?? null;
}

/**
 * Subscribes to UID changes (sign-in completes, session restores). Returns an
 * unsubscribe fn, or a no-op outside a browser. Useful for wiring the UID into
 * analytics user properties once it lands.
 */
export function onUid(cb: (uid: string | null) => void): () => void {
  if (!isBrowser()) return () => {};
  const auth = getAuthInstance();
  if (auth === null) return () => {};
  return onAuthStateChanged(auth, (user) => cb(user?.uid ?? null));
}

/** Test-only: clear the memoised sign-in so a fresh call re-runs. */
export function _resetAuthForTests(): void {
  authPromise = null;
}
