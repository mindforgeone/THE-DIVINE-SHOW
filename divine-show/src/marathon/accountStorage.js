import { CLOUD_DOCUMENT_ID, LEGACY_DOCUMENT_IDS, STORAGE_KEY, clearLegacyCache } from './model.js';

export const RESET_GENERATION = '2026-09-06';
const REQUESTED_ACCOUNT_HASH = '15fe470ce74dbfd4c6a3cbeca0a7b4ca15bdfceec7b3eebd1157ced908dfb3e9';

// Only the account that requested the reset moves to a new, isolated history.
export async function resolveAccountStorage(user, requestedAccountHash = REQUESTED_ACCOUNT_HASH) {
  const email = (user.email || '').trim().toLowerCase();
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(email));
  const fingerprint = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
  const resetRequested = fingerprint === requestedAccountHash;
  return {
    documentId: resetRequested ? 'marathon120-20260906' : CLOUD_DOCUMENT_ID,
    cacheNamespace: resetRequested ? 'marathon-120-20260906' : STORAGE_KEY,
    resetRequested,
    generation: resetRequested ? RESET_GENERATION : null,
    oldDocumentIds: resetRequested ? [...LEGACY_DOCUMENT_IDS, CLOUD_DOCUMENT_ID] : [],
  };
}

export function clearRequestedHistoryCache(uid, storage) {
  if (!storage.resetRequested) return;
  try {
    clearLegacyCache(uid);
    localStorage.removeItem(`${STORAGE_KEY}:${uid}`);
  } catch {
    // A blocked browser cache must not prevent access to the cloud account.
  }
}
