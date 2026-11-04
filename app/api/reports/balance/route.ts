import { getShiftBalanceReport } from '@/lib/queries'
import { canEdit, normalizeRole } from '@/lib/roles'
import { getSession } from '@/lib/session'
import { parseShiftKey, shiftHours } from '@/lib/shift'

export const dynamic = 'force-dynamic'

const num = (value: number, digits = 2) => value.toFixed(digits).replace('.', ',')
const cell = (value: string) => `"${value.replace(/"/g, '""')}"`

export async function GET(request: Request) {
  const session = await getSession()
  if (!session?.user) return new Response('Требуется вход', { status: 401 })
  if (!canEdit(normalizeRole(session.user.role))) return new Response('Недостаточно прав', { status: 403 })

  const url = new URL(request.url)
  const key = parseShiftKey(url.searchParams.get('date') ?? undefined, url.searchParams.get('shift') ?? undefined)
  if (!key) return new Response('Неверная смена', { status: 400 })

  const rows = await getShiftBalanceReport(key)
  const header = [
    'Штабель',
    'Au, г/т',
    'На начало, т',
    'Поступление, т',
    'Дробление приход, т',
    'Дробление расход, т',
    'Подача, т',
    'На конец, т',
    'Металл на конец, г',
  ]
  const lines = rows
    .filter((r) => r.isActive || r.opening !== 0 || r.closing !== 0)
    .map((r) =>
      [
        cell(r.name),
        num(r.auGrade, 3),
        num(r.opening),
        num(r.received),
        num(r.crushedIn),
        num(r.crushedOut),
        num(r.fed),
        num(r.closing),
        num(r.closing * r.auGrade, 1),
      ].join(';'),
    )
  const total = rows.reduce(
    (acc, r) => ({
      opening: acc.opening + r.opening,
      received: acc.received + r.received,
      crushedIn: acc.crushedIn + r.crushedIn,
      crushedOut: acc.crushedOut + r.crushedOut,
      fed: acc.fed + r.fed,
      closing: acc.closing + r.closing,
      metal: acc.metal + r.closing * r.auGrade,
    }),
    { opening: 0, received: 0, crushedIn: 0, crushedOut: 0, fed: 0, closing: 0, metal: 0 },
  )
  const totalLine = [
    cell('Итого'),
    num(total.closing > 0 ? total.metal / total.closing : 0, 3),
    num(total.opening),
    num(total.received),
    num(total.crushedIn),
    num(total.crushedOut),
    num(total.fed),
    num(total.closing),
    num(total.metal, 1),
  ].join(';')

  const title = cell(`Остатки на конец смены ${key.shift} (${shiftHours(key.shift)}) ${key.date}, время Хабаровска`)
  // BOM + ';' so Excel with Russian locale opens the file correctly.
  const csv = '\uFEFF' + [title, '', header.map(cell).join(';'), ...lines, totalLine].join('\r\n')

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="ostatki_${key.date}_smena${key.shift}.csv"`,
      'Cache-Control': 'no-store',
    },
  })
}
