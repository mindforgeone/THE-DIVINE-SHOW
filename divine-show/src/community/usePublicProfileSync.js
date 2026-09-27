import { useEffect, useMemo, useRef } from 'react';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { roleForUser } from '../auth/roles';
import { calculateStats, getCurrentDayIndex, number, todayKey } from '../marathon/model';

function buildProfileBase(user, privateState) {
  const profile = privateState?.profile || {};
  const role = roleForUser(user);
  const currentIndex = privateState?.startDate
    ? getCurrentDayIndex(privateState.startDate, todayKey(), privateState.durationDays)
    : 0;

  return {
    uid: user.uid,
    displayName: role === 'admin' ? 'Stopmenlaser' : profile.displayName || user.displayName || user.email?.split('@')[0] || 'Участник',
    role,
    photoUrl: profile.photoUrl || user.photoURL || '',
    discoverable: profile.discoverable !== false,
    durationDays: privateState?.durationDays || null,
    journeyStatus: privateState?.completedAt ? 'completed' : privateState?.contractAcceptedAt ? 'active' : 'not_started',
    currentIndex,
  };
}

export function buildPublicProfile(user, privateState) {
  const base = buildProfileBase(user, privateState);
  return {
    uid: base.uid,
    displayName: base.displayName,
    role: base.role,
    photoUrl: base.photoUrl,
    discoverable: base.discoverable,
    durationDays: base.durationDays,
    journeyStatus: base.journeyStatus,
  };
}

export function buildFriendProfile(user, privateState) {
  const base = buildProfileBase(user, privateState);
  const profile = privateState?.profile || {};
  const stats = privateState?.days ? calculateStats(privateState, base.currentIndex, 'all') : null;
  const latestWeight = stats?.lastWeight || number(profile.currentWeight);
  const ruleStats = (stats?.codexStats || []).filter((item) => item.recorded > 0);
  const rulesKeptRate = ruleStats.length
    ? Math.round(ruleStats.reduce((sum, item) => sum + item.completionRate, 0) / ruleStats.length)
    : 0;

  return {
    uid: base.uid,
    bio: profile.bio || '',
    shareProgress: profile.shareProgress !== false,
    shareWeight: Boolean(profile.shareWeight),
    journeyDay: privateState?.startDate ? base.currentIndex + 1 : 0,
    startDate: privateState?.startDate || null,
    completionRate: profile.shareProgress !== false ? stats?.completionRate || 0 : null,
    strongDays: profile.shareProgress !== false ? (stats?.resultCounts?.strong || 0) + (stats?.resultCounts?.expansion || 0) : null,
    totalSteps: profile.shareProgress !== false ? stats?.steps?.reduce((sum, item) => sum + item.value, 0) || 0 : null,
    avgSteps: profile.shareProgress !== false ? stats?.avgSteps || 0 : null,
    avgCalories: profile.shareProgress !== false ? stats?.avgCalories || 0 : null,
    rulesKeptRate: profile.shareProgress !== false ? rulesKeptRate : null,
    currentWeight: profile.shareWeight ? latestWeight || null : null,
    weightDelta: profile.shareWeight ? stats?.weightDelta || 0 : null,
  };
}

export function usePublicProfileSync(user, privateState) {
  const lastSent = useRef('');
  const publicProfile = useMemo(
    () => user && privateState !== undefined ? buildPublicProfile(user, privateState) : null,
    [privateState, user],
  );
  const friendProfile = useMemo(
    () => user && privateState !== undefined ? buildFriendProfile(user, privateState) : null,
    [privateState, user],
  );

  useEffect(() => {
    if (!db || !publicProfile?.uid || !friendProfile?.uid) return undefined;
    const signature = JSON.stringify([publicProfile, friendProfile]);
    if (signature === lastSent.current) return undefined;
    let cancelled = false;
    let timer;
    const send = async () => {
      try {
        const updatedAtClient = new Date().toISOString();
        await Promise.all([
          setDoc(
            doc(db, 'publicProfiles', publicProfile.uid),
            { ...publicProfile, updatedAtClient, updatedAt: serverTimestamp() },
          ),
          setDoc(
            doc(db, 'friendProfiles', friendProfile.uid),
            { ...friendProfile, updatedAtClient, updatedAt: serverTimestamp() },
          ),
        ]);
        if (!cancelled) lastSent.current = signature;
      } catch {
        if (!cancelled) timer = window.setTimeout(send, 60000);
      }
    };
    timer = window.setTimeout(send, 800);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [friendProfile, publicProfile]);
}
