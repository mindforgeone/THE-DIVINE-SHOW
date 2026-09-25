import { CLOUD_DOCUMENT_ID, LEGACY_DOCUMENT_IDS, STORAGE_KEY, clearLegacyCache } from './model.js';
import { ADMIN_UID } from '../auth/roles.js';

export const RESET_GENERATION = '2026-09-24-life-platform-v1';
const REQUESTED_ACCOUNT_HASH = '15fe470ce74dbfd4c6a3cbeca0a7b4ca15bdfceec7b3eebd1157ced908dfb3e9';
const MEMBER_RESET_GENERATION = '2026-09-25-all-members-fresh-start-v2';

// Admin history stays isolated; every member uses the same clean schema generation.
export async function resolveAccountStorage(user, requestedAccountHash = REQUESTED_ACCOUNT_HASH) {
  const email = (user.email || '').trim().toLowerCase();
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(email));
  const fingerprint = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
  const ownerReset = user.uid === ADMIN_UID || fingerprint === requestedAccountHash;
  const memberReset = !ownerReset;
  const resetRequested = ownerReset;
  return {
    documentId: ownerReset ? 'marathon-current-v11' : 'marathon-member-v12',
    cacheNamespace: ownerReset ? 'marathon-current-v11' : 'marathon-member-v12',
    resetRequested,
    generation: ownerReset ? RESET_GENERATION : MEMBER_RESET_GENERATION,
    oldDocumentIds: ownerReset
      ? [...LEGACY_DOCUMENT_IDS, CLOUD_DOCUMENT_ID, 'marathon120-20260906', 'steps-v1', 'life-v1', 'marathon-history-v1']
      : memberReset
        ? [...LEGACY_DOCUMENT_IDS, CLOUD_DOCUMENT_ID, 'marathon-member-v10', 'marathon120-20260906', 'marathon-history-v1']
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
