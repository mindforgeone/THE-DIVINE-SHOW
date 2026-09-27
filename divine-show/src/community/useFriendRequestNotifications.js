import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import {
  FRIEND_REQUESTS_CHANGED,
  loadIncomingFriendRequests,
  mergeFriendRequests,
} from './friendRequestOutbox';

export function useFriendRequestNotifications(uid) {
  const [cloudRequests, setCloudRequests] = useState([]);
  const [localRequests, setLocalRequests] = useState(() => loadIncomingFriendRequests(uid));

  useEffect(() => {
    const refreshLocal = () => setLocalRequests(loadIncomingFriendRequests(uid));
    refreshLocal();
    window.addEventListener('storage', refreshLocal);
    window.addEventListener(FRIEND_REQUESTS_CHANGED, refreshLocal);
    return () => {
      window.removeEventListener('storage', refreshLocal);
      window.removeEventListener(FRIEND_REQUESTS_CHANGED, refreshLocal);
    };
  }, [uid]);

  useEffect(() => {
    if (!db || !uid) return undefined;
    return onSnapshot(
      query(collection(db, 'friendRequests'), where('participants', 'array-contains', uid)),
      (snapshot) => setCloudRequests(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))),
      () => {},
    );
  }, [uid]);

  return useMemo(
    () => mergeFriendRequests(cloudRequests, localRequests)
      .filter((item) => item.to === uid && item.status === 'pending').length,
    [cloudRequests, localRequests, uid],
  );
}
