import { useEffect, useMemo, useRef } from 'react';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { roleForUser } from '../auth/roles';
import { calculateStats, getCurrentDayIndex, number, todayKey } from '../marathon/model';

export function buildPublicProfile(user, privateState) {
  const profile = privateState?.profile || {};
  const role = roleForUser(user);
  const currentIndex = privateState?.startDate
    ? getCurrentDayIndex(privateState.startDate, todayKey(), privateState.durationDays)
    : 0;
  const stats = privateState?.days ? calculateStats(privateState, currentIndex, 'all') : null;
  const latestWeight = stats?.lastWeight || number(profile.currentWeight);
  const ruleStats = (stats?.codexStats || []).filter((item) => item.recorded > 0);
  const rulesKeptRate = ruleStats.length
    ? Math.round(ruleStats.reduce((sum, item) => sum + item.completionRate, 0) / ruleStats.length)
    : 0;

  return {
    uid: user.uid,
    displayName: role === 'admin' ? 'Stopmenlaser' : profile.displayName || user.displayName || user.email?.split('@')[0] || 'Участник',
    role,
    photoUrl: profile.photoUrl || user.photoURL || '',
    bio: profile.bio || '',
    discoverable: profile.discoverable !== false,
    shareProgress: profile.shareProgress !== false,
    shareWeight: Boolean(profile.shareWeight),
    durationDays: privateState?.durationDays || null,
    journeyDay: privateState?.startDate ? currentIndex + 1 : 0,
    journeyStatus: privateState?.completedAt ? 'completed' : privateState?.contractAcceptedAt ? 'active' : 'not_started',
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

  useEffect(() => {
    if (!db || !publicProfile?.uid) return undefined;
    const signature = JSON.stringify(publicProfile);
    if (signature === lastSent.current) return undefined;
    let cancelled = false;
    let timer;
    const send = async () => {
      try {
        await setDoc(
          doc(db, 'publicProfiles', publicProfile.uid),
          { ...publicProfile, updatedAtClient: new Date().toISOString(), updatedAt: serverTimestamp() },
          { merge: true },
        );
        if (!cancelled) lastSent.current = signature;
      } catch {
        if (!cancelled) timer = window.setTimeout(send, 60000);
      }
    };
    timer = window.setTimeout(send, 800);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [publicProfile]);
}
