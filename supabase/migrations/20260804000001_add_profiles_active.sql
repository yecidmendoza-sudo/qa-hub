-- Migration: Add active (soft-delete) column to profiles
-- Allows deactivating QA accounts without losing historical data

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS active boolean DEFAULT true NOT NULL;

-- Update existing rows to active = true (already default, just ensuring)
UPDATE public.profiles SET active = true WHERE active IS NULL;

-- Add index for faster lookups filtering by active status
CREATE INDEX IF NOT EXISTS profiles_active_idx ON public.profiles(active);
