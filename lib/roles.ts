export type Role = 'admin' | 'user' | 'kirankan' | 'info'

export const ROLE_LABELS: Record<Role, string> = {
  admin: 'Администратор',
  user: 'Оператор',
  kirankan: 'Оператор Киранкан',
  info: 'Инфо',
}

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  admin: 'Администратор — всё, включая погрузчики и пользователей',
  user: 'Оператор — ввод данных и управление штабелями Перевального',
  kirankan: 'Оператор Киранкан — остатки и управление штабелями Киранкана',
  info: 'Инфо — только просмотр остатков',
}

/** Ввод данных и управление штабелями Перевального. */
export function canEdit(role: Role) {
  return role === 'user' || role === 'admin'
}

/** Управление штабелями Киранкана. */
export function canManageKirankan(role: Role) {
  return role === 'kirankan' || role === 'admin'
}

export function normalizeRole(value: unknown): Role {
  return value === 'admin' || value === 'info' || value === 'kirankan' ? value : 'user'
}
