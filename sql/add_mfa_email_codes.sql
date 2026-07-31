-- Store short-lived MFA email codes sent through SendGrid.

CREATE TABLE IF NOT EXISTS mfa_email_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID NOT NULL,
  email TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE mfa_email_codes ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_mfa_email_codes_user_created
  ON mfa_email_codes(auth_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_mfa_email_codes_expires_at
  ON mfa_email_codes(expires_at);
