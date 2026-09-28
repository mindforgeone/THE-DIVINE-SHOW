const DEFAULT_SYNC_ENDPOINT = 'https://day-one-analyst.day-one-analyst-worker.workers.dev/sync/v1';

function endpoint(resource = 'marathon') {
  const configured = String(globalThis.__DAY_ONE_SYNC_URL__ || import.meta.env.VITE_SYNC_API_URL || DEFAULT_SYNC_ENDPOINT).trim();
  return `${configured.replace(/\/(?:marathon|ai-reports)?\/?$/, '')}/${resource}`;
}

async function authorizedRequest(user, resource, options) {
  if (!user?.getIdToken) throw new Error('sync-auth-unavailable');
  const token = await user.getIdToken();
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 20000);
  let response;
  try {
    response = await fetch(endpoint(resource), {
      ...options,
      cache: 'no-store',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(options?.body ? { 'Content-Type': 'application/json' } : {}),
        ...(options?.headers || {}),
      },
    });
  } finally {
    window.clearTimeout(timeout);
  }
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
  return Boolean(user?.getIdToken && endpoint('marathon'));
}

export async function loadCloudResource(user, resource) {
  return authorizedRequest(user, resource, { method: 'GET' });
}

export async function saveCloudResource(user, resource, payload, baseRevision) {
  return authorizedRequest(user, resource, {
    method: 'PUT',
    body: JSON.stringify({ payload, baseRevision }),
  });
}

export const loadCloudPayload = (user) => loadCloudResource(user, 'marathon');
export const saveCloudPayload = (user, payload, baseRevision) => saveCloudResource(user, 'marathon', payload, baseRevision);
