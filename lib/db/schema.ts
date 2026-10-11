import { boolean, integer, numeric, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core'

export const appSettings = pgTable('app_settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const stockpiles = pgTable('stockpiles', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().unique(),
  initialTonnage: numeric('initial_tonnage', { precision: 14, scale: 3 }).notNull().default('0'),
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
  note: text('note'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})
