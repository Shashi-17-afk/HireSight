CREATE TABLE IF NOT EXISTS payments (
  id                    TEXT PRIMARY KEY,
  user_id               TEXT REFERENCES users(id),
  razorpay_order_id     TEXT NOT NULL UNIQUE,
  razorpay_payment_id   TEXT,
  plan                  TEXT NOT NULL DEFAULT 'growth',
  amount                INTEGER NOT NULL,        -- amount in paise
  currency              TEXT NOT NULL DEFAULT 'INR',
  status                TEXT NOT NULL DEFAULT 'created',
  -- 0 = not verified, 1 = signature verified
  signature_verified    INTEGER NOT NULL DEFAULT 0,
  created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_payments_user  ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_order ON payments(razorpay_order_id);
