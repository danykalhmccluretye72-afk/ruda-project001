-- Схема БД учёта рудного склада. Скрипт идемпотентен: можно запускать повторно.

CREATE TABLE IF NOT EXISTS app_settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS stockpiles (
  id serial PRIMARY KEY,
  name text NOT NULL UNIQUE,
  initial_tonnage numeric(14,3) NOT NULL DEFAULT 0,
  au_grade numeric(10,3) NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS loaders (
  id serial PRIMARY KEY,
  name text NOT NULL UNIQUE,
  bucket_weight_t numeric(10,3) NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ore_receipts (
  id serial PRIMARY KEY,
  stockpile_id integer NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  truck_number text,
  ticket_number text,
  net_weight_t numeric(12,3) NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ore_feeds (
  id serial PRIMARY KEY,
  stockpile_id integer NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  bucket_count integer NOT NULL,
  bucket_weight_t numeric(10,3) NOT NULL,
  loader text,
  loader_id integer,
  au_grade numeric(10,3) NOT NULL DEFAULT 0,
  shift_date date,
  shift_no smallint,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS shift_plans (
  id serial PRIMARY KEY,
  shift_date date NOT NULL,
  shift_no smallint NOT NULL,
  stockpile_id integer NOT NULL,
  planned_t numeric(12,3) NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (shift_date, shift_no, stockpile_id)
);

CREATE INDEX IF NOT EXISTS ore_feeds_stockpile_time_idx ON ore_feeds (stockpile_id, occurred_at);
CREATE INDEX IF NOT EXISTS ore_feeds_shift_idx ON ore_feeds (shift_date, shift_no);
CREATE INDEX IF NOT EXISTS ore_receipts_stockpile_time_idx ON ore_receipts (stockpile_id, occurred_at);

INSERT INTO loaders (name, bucket_weight_t)
SELECT 'Погрузчик №1', 5 WHERE NOT EXISTS (SELECT 1 FROM loaders);
