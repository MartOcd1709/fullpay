-- FullPay schema. Conventions: money = BIGINT integer paise; rates = INT basis points; business dates = DATE (IST);
-- quantities = qty_milli (quantity x 1000). Idempotent: safe to run more than once.

CREATE TABLE IF NOT EXISTS config (
  id          SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  data        JSONB NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS customers (
  id              BIGSERIAL PRIMARY KEY,
  name            TEXT NOT NULL,
  gstin           TEXT,                           -- NULL = unregistered buyer
  state_code      CHAR(2) NOT NULL,
  address         TEXT,
  email           TEXT,
  phone           TEXT,
  credit_days     INT,                            -- NULL => statutory 15 days (MSMED s.15)
  preferred_lang  TEXT NOT NULL DEFAULT 'en' CHECK (preferred_lang IN ('en','hi')),
  opt_out         BOOLEAN NOT NULL DEFAULT false,
  anonymized_at   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS invoices (
  id                      BIGSERIAL PRIMARY KEY,
  customer_id             BIGINT NOT NULL REFERENCES customers(id),
  fy                      TEXT NOT NULL,          -- '26-27'
  seq                     INT,                    -- allocated at /send; drafts are unnumbered
  number                  TEXT,                   -- 'INV/26-27/0042'
  issue_date              DATE NOT NULL,
  delivery_date           DATE,
  acceptance_date         DATE,                   -- defaults to delivery date (MSMED s.2(b))
  credit_days             INT,                    -- copied from customer at issue; NULL => 15
  due_date                DATE NOT NULL,
  place_of_supply         CHAR(2) NOT NULL,
  reverse_charge          BOOLEAN NOT NULL DEFAULT false,
  ship_to                 TEXT,
  doc_type                TEXT NOT NULL CHECK (doc_type IN ('tax_invoice','bill_of_supply','plain')),
  status                  TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent','part_paid','paid','disputed')),
  rung                    TEXT CHECK (rung IN ('heads_up','due_date','overdue_gentle','overdue_firm','demand_letter','odr_guidance')),
  paused_by               TEXT CHECK (paused_by IN ('dispute','promise','claim')),
  snoozed_until           DATE,
  pay_token               TEXT UNIQUE,
  pay_token_expires_at    TIMESTAMPTZ,
  letter_include_interest BOOLEAN NOT NULL DEFAULT false,
  taxable_paise           BIGINT NOT NULL DEFAULT 0,
  cgst_paise              BIGINT NOT NULL DEFAULT 0,
  sgst_paise              BIGINT NOT NULL DEFAULT 0,
  igst_paise              BIGINT NOT NULL DEFAULT 0,
  round_off_paise         BIGINT NOT NULL DEFAULT 0,
  total_paise             BIGINT NOT NULL DEFAULT 0,
  notes                   TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at                 TIMESTAMPTZ,
  UNIQUE (fy, seq)
);
CREATE INDEX IF NOT EXISTS invoices_customer_idx   ON invoices (customer_id);
CREATE INDEX IF NOT EXISTS invoices_status_due_idx ON invoices (status, due_date);

CREATE TABLE IF NOT EXISTS invoice_items (
  id              BIGSERIAL PRIMARY KEY,
  invoice_id      BIGINT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  position        INT NOT NULL,
  description     TEXT NOT NULL,
  hsn_sac         TEXT,
  qty_milli       BIGINT NOT NULL,
  unit            TEXT NOT NULL DEFAULT 'PCS',    -- UQC code
  rate_paise      BIGINT NOT NULL,
  discount_paise  BIGINT NOT NULL DEFAULT 0,
  gst_bps         INT NOT NULL,
  taxable_paise   BIGINT NOT NULL,
  cgst_paise      BIGINT NOT NULL DEFAULT 0,
  sgst_paise      BIGINT NOT NULL DEFAULT 0,
  igst_paise      BIGINT NOT NULL DEFAULT 0,
  UNIQUE (invoice_id, position)
);

-- Hash-chained, append-only event log. payload is canonical JSON text; entry_hash = sha256(prev_hash || '\n' || payload).
CREATE TABLE IF NOT EXISTS escalation_events (
  id          BIGSERIAL PRIMARY KEY,
  invoice_id  BIGINT REFERENCES invoices(id),
  type        TEXT NOT NULL,
  actor       TEXT NOT NULL,                      -- owner | customer | system | tick
  payload     TEXT NOT NULL,
  run_id      TEXT,
  ts          TIMESTAMPTZ NOT NULL,
  prev_hash   CHAR(64) NOT NULL UNIQUE,
  entry_hash  CHAR(64) NOT NULL UNIQUE
);
CREATE INDEX IF NOT EXISTS events_invoice_idx ON escalation_events (invoice_id, id);

-- Append-only guard (pattern adapted from Solana Developer Platform migration 0047, MIT; see NOTICE).
-- /api/reseed disables these triggers inside its own transaction (ALTER TABLE ... DISABLE TRIGGER USER).
CREATE OR REPLACE FUNCTION reject_event_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'escalation_events is append-only: % is not allowed', TG_OP;
END $$;
DROP TRIGGER IF EXISTS events_no_update_delete ON escalation_events;
CREATE TRIGGER events_no_update_delete BEFORE UPDATE OR DELETE ON escalation_events
  FOR EACH ROW EXECUTE FUNCTION reject_event_mutation();
DROP TRIGGER IF EXISTS events_no_truncate ON escalation_events;
CREATE TRIGGER events_no_truncate BEFORE TRUNCATE ON escalation_events
  FOR EACH STATEMENT EXECUTE FUNCTION reject_event_mutation();

CREATE TABLE IF NOT EXISTS promises (
  id              BIGSERIAL PRIMARY KEY,
  invoice_id      BIGINT NOT NULL REFERENCES invoices(id),
  promised_date   DATE NOT NULL,
  amount_paise    BIGINT,
  status          TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','kept','broken','cancelled')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at     TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS one_open_promise ON promises (invoice_id) WHERE status = 'open';

CREATE TABLE IF NOT EXISTS payments (
  id                BIGSERIAL PRIMARY KEY,
  customer_id       BIGINT REFERENCES customers(id),
  source            TEXT NOT NULL CHECK (source IN ('csv','manual','claim')),
  paid_on           DATE NOT NULL,
  amount_paise      BIGINT NOT NULL,
  reference         TEXT,
  narration         TEXT,
  dedupe_hash       CHAR(64) UNIQUE,              -- sha256(date|amount|reference) => re-import is idempotent
  status            TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','rejected')),
  match_confidence  INT,                          -- 0..100
  match_reason      TEXT,
  flags             TEXT[] NOT NULL DEFAULT '{}', -- part | multi | overpaid | unmatched | tds_1 | tds_2 | tds_10
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  confirmed_at      TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS payment_allocations (
  id            BIGSERIAL PRIMARY KEY,
  payment_id    BIGINT NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  invoice_id    BIGINT NOT NULL REFERENCES invoices(id),
  amount_paise  BIGINT NOT NULL,
  allocated_on  DATE NOT NULL,
  UNIQUE (payment_id, invoice_id)
);

CREATE TABLE IF NOT EXISTS outbox (
  id            BIGSERIAL PRIMARY KEY,
  customer_id   BIGINT NOT NULL REFERENCES customers(id),
  invoice_ids   BIGINT[] NOT NULL,
  rung          TEXT NOT NULL,
  channel       TEXT NOT NULL CHECK (channel IN ('email','whatsapp','sms')),
  recipient     TEXT,
  subject       TEXT,
  body          TEXT NOT NULL,
  lang          TEXT NOT NULL DEFAULT 'en',
  status        TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','awaiting_owner','sent','failed')),
  attempts      INT NOT NULL DEFAULT 0,
  provider_id   TEXT,
  error         TEXT,
  run_id        TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at       TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS outbox_status_idx ON outbox (status);

CREATE TABLE IF NOT EXISTS expenses (
  id            BIGSERIAL PRIMARY KEY,
  category      TEXT NOT NULL,                    -- salaries | rent | supplier | electricity | gst | other
  description   TEXT,
  amount_paise  BIGINT NOT NULL,
  due_on        DATE NOT NULL,
  recurring     TEXT CHECK (recurring IN ('monthly')),
  paid          BOOLEAN NOT NULL DEFAULT false
);

-- ---- Service-layer additions (idempotent) ----

ALTER TABLE promises ADD COLUMN IF NOT EXISTS created_by TEXT NOT NULL DEFAULT 'owner' CHECK (created_by IN ('owner','customer'));

-- Matcher proposals for a pending payment. Only confirm() turns them into payment_allocations.
CREATE TABLE IF NOT EXISTS payment_proposals (
  payment_id    BIGINT NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  invoice_id    BIGINT NOT NULL REFERENCES invoices(id),
  amount_paise  BIGINT NOT NULL CHECK (amount_paise > 0),
  PRIMARY KEY (payment_id, invoice_id)
);

-- Credit notes issued when the owner accepts a dispute. The invoice keeps its printed totals; outstanding drops.
CREATE TABLE IF NOT EXISTS credit_notes (
  id            BIGSERIAL PRIMARY KEY,
  invoice_id    BIGINT NOT NULL REFERENCES invoices(id),
  fy            TEXT NOT NULL,
  seq           INT NOT NULL,
  number        TEXT NOT NULL UNIQUE,             -- 'CN/26-27/0001'
  issue_date    DATE NOT NULL,
  amount_paise  BIGINT NOT NULL CHECK (amount_paise > 0),
  reason        TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (fy, seq)
);

-- Inbox: customer disputes and "already paid" claims. An accepted dispute is a 0% interest span [opened_on, resolved_on).
CREATE TABLE IF NOT EXISTS inbox_items (
  id           BIGSERIAL PRIMARY KEY,
  invoice_id   BIGINT NOT NULL REFERENCES invoices(id),
  kind         TEXT NOT NULL CHECK (kind IN ('dispute','claim')),
  payment_id   BIGINT REFERENCES payments(id),
  reason       TEXT,
  status       TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved')),
  opened_on    DATE NOT NULL,
  resolved_on  DATE,
  resolution   TEXT CHECK (resolution IN ('accept_credit_note','mark_paid','reject','edit')),
  accepted     BOOLEAN NOT NULL DEFAULT false,
  reply        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS one_open_inbox_item ON inbox_items (invoice_id, kind) WHERE status = 'open';

-- outstanding = total - confirmed allocations - credit notes. The one place this rule lives.
CREATE OR REPLACE VIEW invoice_balances AS
SELECT i.id AS invoice_id,
       COALESCE(a.paid, 0)::BIGINT AS paid_paise,
       COALESCE(cn.credited, 0)::BIGINT AS credited_paise,
       (i.total_paise - COALESCE(a.paid, 0) - COALESCE(cn.credited, 0))::BIGINT AS outstanding_paise,
       a.last_paid_on,
       GREATEST(a.last_paid_on, cn.last_credit_on) AS last_settled_on
FROM invoices i
LEFT JOIN (SELECT pa.invoice_id, SUM(pa.amount_paise) AS paid, MAX(pa.allocated_on) AS last_paid_on
           FROM payment_allocations pa JOIN payments p ON p.id = pa.payment_id AND p.status = 'confirmed'
           GROUP BY pa.invoice_id) a ON a.invoice_id = i.id
LEFT JOIN (SELECT invoice_id, SUM(amount_paise) AS credited, MAX(issue_date) AS last_credit_on
           FROM credit_notes GROUP BY invoice_id) cn ON cn.invoice_id = i.id;
