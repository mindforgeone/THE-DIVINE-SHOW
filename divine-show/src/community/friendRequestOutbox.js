const keyFor = (uid) => `day-one-friend-requests:${uid}`;

export function loadFriendRequestOutbox(uid) {
  if (!uid) return [];
  try {
    const value = JSON.parse(localStorage.getItem(keyFor(uid)) || '[]');
    return Array.isArray(value) ? value.filter((item) => item?.id && item?.to) : [];
  } catch {
    return [];
  }
}

export function saveFriendRequestOutbox(uid, items) {
  if (!uid) return;
  try {
    if (items.length) localStorage.setItem(keyFor(uid), JSON.stringify(items));
    else localStorage.removeItem(keyFor(uid));
  } catch {
    // Firestore still gets a direct attempt when browser storage is unavailable.
  }
}

export function queueFriendRequest(uid, request) {
  const next = [...loadFriendRequestOutbox(uid).filter((item) => item.id !== request.id), request];
  saveFriendRequestOutbox(uid, next);
  return next;
}

export function removeFriendRequestFromOutbox(uid, requestId) {
  const next = loadFriendRequestOutbox(uid).filter((item) => item.id !== requestId);
  saveFriendRequestOutbox(uid, next);
  return next;
}
