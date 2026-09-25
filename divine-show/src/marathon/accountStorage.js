import { CLOUD_DOCUMENT_ID, LEGACY_DOCUMENT_IDS, STORAGE_KEY, clearLegacyCache } from './model.js';

export const RESET_GENERATION = '2026-09-24-life-platform-v1';
const REQUESTED_ACCOUNT_HASH = '15fe470ce74dbfd4c6a3cbeca0a7b4ca15bdfceec7b3eebd1157ced908dfb3e9';
const MEMBER_RESET_ACCOUNT_HASH = '90ba4c6cbb8ce73dc5f463a7c19c90df9bcd47ebe941dce79f64a82da02ec030';
const MEMBER_RESET_GENERATION = '2026-09-25-member-fresh-start-v1';

// Only the account that requested the reset moves to a new, isolated history.
export async function resolveAccountStorage(user, requestedAccountHash = REQUESTED_ACCOUNT_HASH) {
  const email = (user.email || '').trim().toLowerCase();
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(email));
  const fingerprint = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
  const ownerReset = fingerprint === requestedAccountHash;
  const memberReset = requestedAccountHash === REQUESTED_ACCOUNT_HASH && fingerprint === MEMBER_RESET_ACCOUNT_HASH;
  const resetRequested = ownerReset || memberReset;
  return {
    documentId: ownerReset ? 'marathon-current-v11' : memberReset ? 'marathon-member-v10' : CLOUD_DOCUMENT_ID,
    cacheNamespace: ownerReset ? 'marathon-current-v11' : memberReset ? 'marathon-member-v10' : STORAGE_KEY,
    resetRequested,
    generation: ownerReset ? RESET_GENERATION : memberReset ? MEMBER_RESET_GENERATION : null,
    oldDocumentIds: ownerReset
      ? [...LEGACY_DOCUMENT_IDS, CLOUD_DOCUMENT_ID, 'marathon120-20260906', 'steps-v1', 'life-v1', 'marathon-history-v1']
      : memberReset
        ? [...LEGACY_DOCUMENT_IDS, CLOUD_DOCUMENT_ID, 'marathon120-20260906', 'marathon-history-v1']
        : [],
  };
}

export function clearRequestedHistoryCache(uid, storage) {
  if (!storage.resetRequested) return;
  try {
    clearLegacyCache(uid);
    localStorage.removeItem(`${STORAGE_KEY}:${uid}`);
    localStorage.removeItem(`marathon-steps-v1:${uid}`);
    localStorage.removeItem(`marathon-life-v1:${uid}`);
  } catch {
    // A blocked browser cache must not prevent access to the cloud account.
  }
}
