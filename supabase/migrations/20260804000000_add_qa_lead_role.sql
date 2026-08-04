-- Migration: Add QA_LEAD role to profiles table
-- This adds Scrum Master capabilities (create cycles) without full admin rights

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check 
  CHECK (role IN ('ADMIN', 'QA_LEAD', 'QA_TESTER'));
