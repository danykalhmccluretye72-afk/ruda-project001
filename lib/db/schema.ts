import { boolean, date, integer, numeric, pgTable, serial, smallint, text, timestamp, unique } from 'drizzle-orm/pg-core'

export const appSettings = pgTable('app_settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const stockpiles = pgTable('stockpiles', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().unique(),
  initialTonnage: numeric('initial_tonnage', { precision: 14, scale: 3 }).notNull().default('0'),
  auGrade: numeric('au_grade', { precision: 10, scale: 3 }).notNull().default('0'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const loaders = pgTable('loaders', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().unique(),
  bucketWeightT: numeric('bucket_weight_t', { precision: 10, scale: 3 }).notNull(),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const oreReceipts = pgTable('ore_receipts', {
  id: serial('id').primaryKey(),
  stockpileId: integer('stockpile_id').notNull(),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
  truckNumber: text('truck_number'),
  ticketNumber: text('ticket_number'),
  netWeightT: numeric('net_weight_t', { precision: 12, scale: 3 }).notNull(),
  note: text('note'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const oreFeeds = pgTable('ore_feeds', {
  id: serial('id').primaryKey(),
  stockpileId: integer('stockpile_id').notNull(),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
  bucketCount: integer('bucket_count').notNull(),
  bucketWeightT: numeric('bucket_weight_t', { precision: 10, scale: 3 }).notNull(),
  loader: text('loader'),
  loaderId: integer('loader_id'),
  auGrade: numeric('au_grade', { precision: 10, scale: 3 }).notNull().default('0'),
  shiftDate: date('shift_date'),
  shiftNo: smallint('shift_no'),
  note: text('note'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const crushingOps = pgTable('crushing_ops', {
  id: serial('id').primaryKey(),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
  shiftDate: date('shift_date').notNull(),
  shiftNo: smallint('shift_no').notNull(),
  targetStockpileId: integer('target_stockpile_id').notNull(),
  loaderId: integer('loader_id'),
  loader: text('loader'),
  bucketWeightT: numeric('bucket_weight_t', { precision: 10, scale: 3 }).notNull(),
  note: text('note'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const crushingLines = pgTable('crushing_lines', {
  id: serial('id').primaryKey(),
  opId: integer('op_id').notNull(),
  sourceStockpileId: integer('source_stockpile_id').notNull(),
  bucketCount: integer('bucket_count').notNull(),
  auGrade: numeric('au_grade', { precision: 10, scale: 3 }).notNull().default('0'),
})

export const kirankanStockpiles = pgTable('kirankan_stockpiles', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().unique(),
  auGrade: numeric('au_grade', { precision: 10, scale: 3 }).notNull().default('0'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const kirankanReceipts = pgTable('kirankan_receipts', {
  id: serial('id').primaryKey(),
  stockpileId: integer('stockpile_id').notNull(),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
  truckNumber: text('truck_number'),
  ticketNumber: text('ticket_number'),
  netWeightT: numeric('net_weight_t', { precision: 12, scale: 3 }).notNull(),
  note: text('note'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const kirankanShipments = pgTable('kirankan_shipments', {
  id: serial('id').primaryKey(),
  stockpileId: integer('stockpile_id').notNull(),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
  truckNumber: text('truck_number'),
  ticketNumber: text('ticket_number'),
  netWeightT: numeric('net_weight_t', { precision: 12, scale: 3 }).notNull(),
  auGrade: numeric('au_grade', { precision: 10, scale: 3 }).notNull().default('0'),
  note: text('note'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const kirankanAdjustments = pgTable('kirankan_adjustments', {
  id: serial('id').primaryKey(),
  stockpileId: integer('stockpile_id').notNull(),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
  deltaT: numeric('delta_t', { precision: 14, scale: 3 }).notNull(),
  note: text('note'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const shiftPlans = pgTable(
  'shift_plans',
  {
    id: serial('id').primaryKey(),
    shiftDate: date('shift_date').notNull(),
    shiftNo: smallint('shift_no').notNull(),
    stockpileId: integer('stockpile_id').notNull(),
    plannedT: numeric('planned_t', { precision: 12, scale: 3 }).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique().on(t.shiftDate, t.shiftNo, t.stockpileId)],
)
