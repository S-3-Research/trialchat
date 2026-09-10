-- =====================================================
-- Migration: Add Intake Form Fields to user_profiles
-- Run this in your Supabase SQL Editor
-- =====================================================

-- Add intake form columns
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS intake_role TEXT,
ADD COLUMN IF NOT EXISTS intake_response_style TEXT,
ADD COLUMN IF NOT EXISTS intake_intent TEXT,
ADD COLUMN IF NOT EXISTS intake_completed_at TIMESTAMPTZ;

-- Add comments for documentation
COMMENT ON COLUMN user_profiles.intake_role IS 'User role from intake form: user or caregiver';
COMMENT ON COLUMN user_profiles.intake_response_style IS 'Response style preference: concise, balanced, or verbose';
COMMENT ON COLUMN user_profiles.intake_intent IS 'User intent: trial_matching or learn_about_trials';
COMMENT ON COLUMN user_profiles.intake_completed_at IS 'Timestamp when intake form was completed';

-- Create trigger function to sync intake_role to is_caregiver
CREATE OR REPLACE FUNCTION sync_intake_role_to_is_caregiver()
RETURNS TRIGGER AS $$
BEGIN
  -- When intake_role is updated, sync to is_caregiver
  IF NEW.intake_role IS NOT NULL THEN
    NEW.is_caregiver = (NEW.intake_role = 'caregiver');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS sync_intake_role ON user_profiles;

CREATE TRIGGER sync_intake_role
  BEFORE INSERT OR UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION sync_intake_role_to_is_caregiver();

-- Verify the changes
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'user_profiles'
AND column_name LIKE 'intake%'
ORDER BY ordinal_position;
