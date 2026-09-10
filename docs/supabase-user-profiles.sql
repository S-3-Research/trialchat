-- =====================================================
-- Table: user_profiles
-- 用户画像表：基本信息、健康状况、intake 偏好等
-- 合并自：supabase-schema.sql (原表定义) + supabase-intake-migration.sql (intake 字段 + 触发器)
-- =====================================================

CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_user_id TEXT UNIQUE NOT NULL,  -- 用户唯一 ID（历史字段名沿用 Clerk 时期，认证已下线）

  -- 基本信息
  full_name TEXT,
  email TEXT,
  age INTEGER,
  gender TEXT,

  -- 健康状况
  has_adrd BOOLEAN DEFAULT false,
  diagnosis_type TEXT,  -- 如：Alzheimer's, Dementia, MCI
  diagnosed_date DATE,
  current_medications JSONB,  -- 存储当前用药列表

  -- 照护者信息
  is_caregiver BOOLEAN DEFAULT false,
  relationship_to_patient TEXT,

  -- Intake form data (from guest user onboarding)
  intake_role TEXT,  -- 'user' or 'caregiver'
  intake_response_style TEXT,  -- 'concise', 'balanced', or 'verbose'
  intake_intent TEXT,  -- 'trial_matching' or 'learn_about_trials'
  intake_completed_at TIMESTAMPTZ,

  -- 偏好和限制
  preferred_language TEXT DEFAULT 'en',
  location JSONB,  -- {city, state, country, coordinates}
  mobility_status TEXT,  -- mobile, limited, homebound
  travel_radius_miles INTEGER,

  -- 元数据
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_active_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON COLUMN user_profiles.intake_role IS 'User role from intake form: user or caregiver';
COMMENT ON COLUMN user_profiles.intake_response_style IS 'Response style preference: concise, balanced, or verbose';
COMMENT ON COLUMN user_profiles.intake_intent IS 'User intent: trial_matching or learn_about_trials';
COMMENT ON COLUMN user_profiles.intake_completed_at IS 'Timestamp when intake form was completed';

-- 索引
CREATE INDEX IF NOT EXISTS idx_user_profiles_clerk_id ON user_profiles(clerk_user_id);

-- RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- 注意：所有策略都设为 true —— 认证已从本项目移除（原 Clerk 认证已下线），
-- 目前仅依赖 Supabase RLS 作为唯一保护层，尚未做细粒度的用户级别隔离。
DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
CREATE POLICY "Users can view own profile" ON user_profiles
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can insert own profile" ON user_profiles;
CREATE POLICY "Users can insert own profile" ON user_profiles
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
CREATE POLICY "Users can update own profile" ON user_profiles
  FOR UPDATE USING (true);

-- 触发器：自动更新 updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON user_profiles;
CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 触发器：同步 intake_role 到 is_caregiver
CREATE OR REPLACE FUNCTION sync_intake_role_to_is_caregiver()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.intake_role IS NOT NULL THEN
    NEW.is_caregiver = (NEW.intake_role = 'caregiver');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sync_intake_role ON user_profiles;
CREATE TRIGGER sync_intake_role
  BEFORE INSERT OR UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION sync_intake_role_to_is_caregiver();
