-- E-Mail-Adresse des Inhabers pro Betrieb.
-- Pflicht beim Self-Signup (Gateway erzwingt), optional bei Super-Admin-Anlage.
-- Wird für Welcome-E-Mail und Anti-Abuse-Check verwendet.
ALTER TABLE public.orgs ADD COLUMN IF NOT EXISTS email text;
