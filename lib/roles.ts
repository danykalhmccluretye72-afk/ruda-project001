export type Role = 'admin' | 'user' | 'info'

export const ROLE_LABELS: Record<Role, string> = {
  admin: 'Администратор',
  user: 'Оператор',
  info: 'Инфо',
}

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  admin: 'Администратор — всё, включая погрузчики и пользователей',
  user: 'Оператор — ввод данных и управление штабелями',
  info: 'Инфо — только просмотр остатков',
}

export function canEdit(role: Role) {
  return role !== 'info'
}

export function normalizeRole(value: unknown): Role {
  return value === 'admin' || value === 'info' ? value : 'user'
}
