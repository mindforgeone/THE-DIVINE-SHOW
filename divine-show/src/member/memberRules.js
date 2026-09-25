export const MEMBER_RULE_IDS = ['alcohol', 'member-nutrition', 'member-movement'];

const RETIRED_MEMBER_RULES = new Set(['wot', 'reels', 'recover', 'member-alcohol', 'member-calories', 'nutrition-1850']);

export function memberRules(startDate, updatedAt) {
  return [
    { id: 'alcohol', title: 'Без алкоголя', type: 'boolean', target: 1, unit: '', critical: true },
    { id: 'member-nutrition', title: 'Питался по своему плану', type: 'boolean', target: 1, unit: '' },
    { id: 'member-movement', title: 'Сделал выбранную активность', type: 'boolean', target: 1, unit: '' },
  ].map((rule, order) => ({ ...rule, active: true, required: true, scoreEnabled: true, todayVisible: true, statsVisible: true, order, startDate, endDate: '', createdAt: `${startDate}T00:00:00.000Z`, updatedAt, deletedAt: null }));
}

export function migrateMemberState(current, now, user = {}) {
  const rules = current.codexRules || [];
  return {
    ...current,
    memberInitialized: true,
    memberSchemaVersion: 4,
    codexRules: [
      ...rules.filter((rule) => RETIRED_MEMBER_RULES.has(rule.id)).map((rule) => ({ ...rule, active: false, required: false, scoreEnabled: false, todayVisible: false, statsVisible: false, deletedAt: rule.deletedAt || now, updatedAt: now })),
      ...rules.filter((rule) => !RETIRED_MEMBER_RULES.has(rule.id) && !MEMBER_RULE_IDS.includes(rule.id)),
      ...memberRules(current.startDate, now),
    ],
    profile: {
      ...current.profile,
      displayName: current.profile.displayName || user.displayName || '',
      photoUrl: current.profile.photoUrl || user.photoURL || '',
      startWeight: current.profile.startWeight || '',
      calorieTarget: current.profile.calorieTarget || 1850,
      stepTarget: current.profile.stepTarget || 8000,
      trackActiveCalories: Boolean(current.profile.trackActiveCalories),
      discoverable: current.profile.discoverable !== false,
      shareWeight: Boolean(current.profile.shareWeight),
      shareProgress: current.profile.shareProgress !== false,
      bio: current.profile.bio || '',
    },
    bodyLogs: current.bodyLogs || [],
    progressPhotos: current.progressPhotos || [],
    dayCriteria: current.dayCriteria.map((criterion) => criterion.field === 'activeCalories' ? { ...criterion, active: false, required: false, updatedAt: now } : criterion.field === 'steps' ? { ...criterion, required: false, updatedAt: now } : criterion),
  };
}
