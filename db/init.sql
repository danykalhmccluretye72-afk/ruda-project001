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

-- Дробление: перемещение руды из одного или нескольких штабелей в целевой (учёт ковшами)
CREATE TABLE IF NOT EXISTS crushing_ops (
  id serial PRIMARY KEY,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  shift_date date NOT NULL,
  shift_no smallint NOT NULL,
  target_stockpile_id integer NOT NULL,
  loader_id integer,
  loader text,
  bucket_weight_t numeric(10,3) NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS crushing_lines (
  id serial PRIMARY KEY,
  op_id integer NOT NULL REFERENCES crushing_ops(id) ON DELETE CASCADE,
  source_stockpile_id integer NOT NULL,
  bucket_count integer NOT NULL,
  au_grade numeric(10,3) NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS crushing_ops_target_time_idx ON crushing_ops (target_stockpile_id, occurred_at);
CREATE INDEX IF NOT EXISTS crushing_lines_op_idx ON crushing_lines (op_id);
CREATE INDEX IF NOT EXISTS crushing_lines_source_idx ON crushing_lines (source_stockpile_id);

CREATE INDEX IF NOT EXISTS ore_feeds_stockpile_time_idx ON ore_feeds (stockpile_id, occurred_at);
CREATE INDEX IF NOT EXISTS ore_feeds_shift_idx ON ore_feeds (shift_date, shift_no);
CREATE INDEX IF NOT EXISTS ore_receipts_stockpile_time_idx ON ore_receipts (stockpile_id, occurred_at);

-- Участок Киранкан: собственные штабели, поступление, отгрузка на Перевальное, корректировки остатка
CREATE TABLE IF NOT EXISTS kirankan_stockpiles (
  id serial PRIMARY KEY,
  name text NOT NULL UNIQUE,
  au_grade numeric(10,3) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS kirankan_receipts (
  id serial PRIMARY KEY,
  stockpile_id integer NOT NULL REFERENCES kirankan_stockpiles(id) ON DELETE CASCADE,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  truck_number text,
  ticket_number text,
  net_weight_t numeric(12,3) NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS kirankan_shipments (
  id serial PRIMARY KEY,
  stockpile_id integer NOT NULL REFERENCES kirankan_stockpiles(id) ON DELETE CASCADE,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  truck_number text,
  ticket_number text,
  net_weight_t numeric(12,3) NOT NULL,
  au_grade numeric(10,3) NOT NULL DEFAULT 0,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS kirankan_adjustments (
  id serial PRIMARY KEY,
  stockpile_id integer NOT NULL REFERENCES kirankan_stockpiles(id) ON DELETE CASCADE,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  delta_t numeric(14,3) NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS kirankan_receipts_pile_time_idx ON kirankan_receipts (stockpile_id, occurred_at);
CREATE INDEX IF NOT EXISTS kirankan_shipments_pile_time_idx ON kirankan_shipments (stockpile_id, occurred_at);
CREATE INDEX IF NOT EXISTS kirankan_adjustments_pile_time_idx ON kirankan_adjustments (stockpile_id, occurred_at);

INSERT INTO loaders (name, bucket_weight_t)
SELECT 'Погрузчик №1', 5 WHERE NOT EXISTS (SELECT 1 FROM loaders);
