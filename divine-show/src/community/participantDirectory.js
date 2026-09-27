const baseProfile = {
  role: 'user',
  bio: '',
  discoverable: true,
  shareProgress: true,
  shareWeight: false,
  durationDays: null,
  journeyDay: 0,
  journeyStatus: 'not_started',
  completionRate: 0,
  strongDays: 0,
  totalSteps: 0,
  avgSteps: 0,
  avgCalories: 0,
  rulesKeptRate: 0,
  currentWeight: null,
  weightDelta: 0,
};

export const PARTICIPANT_DIRECTORY = [
  {
    ...baseProfile,
    uid: '5CMckLFqiCPoPCBQLz1YqBkgVXs1',
    displayName: 'Stopmenlaser',
    role: 'admin',
    photoUrl: 'https://lh3.googleusercontent.com/a/ACg8ocJvxorhByauDZHMpSmnHEHXKsgZDpGONntXPKFnm3bV8sCqEvM=s96-c',
  },
];

export function mergeParticipantProfiles(cloudProfiles = []) {
  const profiles = new Map(PARTICIPANT_DIRECTORY.map((profile) => [profile.uid, profile]));
  cloudProfiles.forEach((profile) => {
    const fallback = profiles.get(profile.uid) || baseProfile;
    profiles.set(profile.uid, { ...fallback, ...profile, ...(profile.role === 'admin' ? { displayName: 'Stopmenlaser' } : {}) });
  });
  return [...profiles.values()].filter((profile) => profile.discoverable !== false);
}
