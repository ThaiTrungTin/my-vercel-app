-- Migration: create voice_keys table to store voice chat API keys / tokens
-- Run on Postgres (Supabase SQL editor) before deploying UI changes.
-- Uses gen_random_uuid() from pgcrypto; enable extension if missing.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Table to store voice/chat keys that can be shared/managed via Cài Đặt
CREATE TABLE IF NOT EXISTS public.voice_keys (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    key_text text NOT NULL,
    label text NOT NULL DEFAULT 'Unnamed Key',
    created_by text NULL, -- store creator's gmail or identifier
    created_at timestamptz NOT NULL DEFAULT now(),
    expires_at timestamptz NULL,
    is_active boolean NOT NULL DEFAULT true,
    usage_count integer NOT NULL DEFAULT 0,
    description text NULL,
    is_public boolean NOT NULL DEFAULT false -- if true, available for everyone via settings
);

-- Prevent duplicate exact keys
CREATE UNIQUE INDEX IF NOT EXISTS idx_voice_keys_key_text ON public.voice_keys (key_text);

-- Useful indexes
CREATE INDEX IF NOT EXISTS idx_voice_keys_is_active ON public.voice_keys (is_active);
CREATE INDEX IF NOT EXISTS idx_voice_keys_expires_at ON public.voice_keys (expires_at);

-- Example: grant read access to all authenticated users (optional)
-- Note: adjust policies in Supabase UI for fine-grained access control.


