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
  {
    ...baseProfile,
    uid: 'dLKEXNsepUY3zcllftrj97OvLmA2',
    displayName: 'Ксения Борисова',
    photoUrl: 'https://lh3.googleusercontent.com/a/ACg8ocKNJbwYA99Md2UKQhzMBDgI_fW0QZwm_qu07YjB0RPziDBR2Q=s96-c',
  },
  {
    ...baseProfile,
    uid: 'eTaXSjuPX8bDEdOovlaJnyjFcFX2',
    displayName: 'Мария Гужова',
    photoUrl: 'https://lh3.googleusercontent.com/a/ACg8ocK8vw10t3CvLAcsZ7YPLG2H0KkUfqL9u0IyKXmNaOz9RkrZZdYGlA=s96-c',
  },
  {
    ...baseProfile,
    uid: 'nd9QLCy73VfMYjIe3GDoyXdu4FU2',
    displayName: 'Михаил',
    photoUrl: 'https://lh3.googleusercontent.com/a/ACg8ocKpJhwownk1JdHfCe27DD--WzpWxzg_llYyJ2jSQ8kycACE3w=s96-c',
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
