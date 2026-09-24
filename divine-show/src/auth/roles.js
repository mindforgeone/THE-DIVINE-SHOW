export const ADMIN_UID = '5CMckLFqiCPoPCBQLz1YqBkgVXs1';

export function roleForUser(user) {
  if (!user?.uid) return 'guest';
  return user.uid === ADMIN_UID ? 'admin' : 'user';
}

export function isAdminUser(user) {
  return roleForUser(user) === 'admin';
}
