-- Preserve the authenticated issuer's identity when a one-time link is redeemed.
ALTER TABLE ops_login_tickets ADD COLUMN email TEXT;
