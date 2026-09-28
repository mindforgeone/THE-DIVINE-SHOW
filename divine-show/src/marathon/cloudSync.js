const DEFAULT_SYNC_ENDPOINT = 'https://day-one-analyst.day-one-analyst-worker.workers.dev/sync/v1/marathon';

function endpoint() {
  return String(globalThis.__DAY_ONE_SYNC_URL__ || import.meta.env.VITE_SYNC_API_URL || DEFAULT_SYNC_ENDPOINT).trim();
}

async function authorizedRequest(user, options) {
  if (!user?.getIdToken) throw new Error('sync-auth-unavailable');
  const token = await user.getIdToken();
  const response = await fetch(endpoint(), {
    ...options,
    cache: 'no-store',
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options?.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options?.headers || {}),
    },
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const failure = new Error(result.error || 'sync-request-failed');
    failure.status = response.status;
    failure.remote = response.status === 409 ? result : null;
    throw failure;
  }
  return result;
}

export function cloudSyncAvailable(user) {
  return Boolean(user?.getIdToken && endpoint());
}

export async function loadCloudPayload(user) {
  return authorizedRequest(user, { method: 'GET' });
}

export async function saveCloudPayload(user, payload, baseRevision) {
  return authorizedRequest(user, {
    method: 'PUT',
    body: JSON.stringify({ payload, baseRevision }),
  });
}
