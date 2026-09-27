const keyFor = (uid) => `day-one-friend-requests:${uid}`;
const inboxKeyFor = (uid) => `day-one-friend-inbox:${uid}`;
export const FRIEND_REQUESTS_CHANGED = 'day-one-friend-requests-changed';

function readList(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(value) ? value.filter((item) => item?.id) : [];
  } catch {
    return [];
  }
}

function writeList(key, items) {
  try {
    if (items.length) localStorage.setItem(key, JSON.stringify(items));
    else localStorage.removeItem(key);
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(FRIEND_REQUESTS_CHANGED));
  } catch {
    // Firestore still gets a direct attempt when browser storage is unavailable.
  }
}

export function loadFriendRequestOutbox(uid) {
  if (!uid) return [];
  return readList(keyFor(uid)).filter((item) => item?.to);
}

export function saveFriendRequestOutbox(uid, items) {
  if (!uid) return;
  writeList(keyFor(uid), items);
}

export function queueFriendRequest(uid, request) {
  const next = [...loadFriendRequestOutbox(uid).filter((item) => item.id !== request.id), request];
  saveFriendRequestOutbox(uid, next);
  queueIncomingFriendRequest(request.to, request);
  return next;
}

export function removeFriendRequestFromOutbox(uid, requestId) {
  const next = loadFriendRequestOutbox(uid).filter((item) => item.id !== requestId);
  saveFriendRequestOutbox(uid, next);
  return next;
}

export function loadIncomingFriendRequests(uid) {
  if (!uid) return [];
  return readList(inboxKeyFor(uid)).filter((item) => item?.from && item?.to === uid);
}

export function queueIncomingFriendRequest(uid, request) {
  if (!uid) return [];
  const next = [...loadIncomingFriendRequests(uid).filter((item) => item.id !== request.id), request];
  writeList(inboxKeyFor(uid), next);
  return next;
}

export function removeIncomingFriendRequest(uid, requestId) {
  const next = loadIncomingFriendRequests(uid).filter((item) => item.id !== requestId);
  writeList(inboxKeyFor(uid), next);
  return next;
}

export function mergeFriendRequests(cloudRequests, localIncoming) {
  const merged = new Map(localIncoming.map((item) => [item.id, { ...item, status: item.status || 'pending', cloudConfirmed: false }]));
  cloudRequests.forEach((item) => merged.set(item.id, { ...item, cloudConfirmed: true }));
  return [...merged.values()];
}
