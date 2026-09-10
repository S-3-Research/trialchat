-- =====================================================
-- Table: user_trial_interests
-- 用户兴趣的试验表：记录用户感兴趣或已申请的临床试验
-- 来源：supabase-schema.sql
-- =====================================================

CREATE TABLE IF NOT EXISTS user_trial_interests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_user_id TEXT NOT NULL,

  -- 试验信息
  trial_id TEXT NOT NULL,  -- ClinicalTrials.gov NCT ID
  trial_name TEXT,
  trial_status TEXT,  -- interested, applied, enrolled, declined

  -- 用户笔记
  user_notes TEXT,
  match_score FLOAT,  -- 匹配度评分

  -- 时间戳
  interested_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_trial_interests_clerk_id ON user_trial_interests(clerk_user_id);
CREATE INDEX IF NOT EXISTS idx_trial_interests_trial ON user_trial_interests(trial_id);

-- RLS
ALTER TABLE user_trial_interests ENABLE ROW LEVEL SECURITY;

-- 注意：所有策略都设为 true —— 认证已从本项目移除（原 Clerk 认证已下线），
-- 目前仅依赖 Supabase RLS 作为唯一保护层，尚未做细粒度的用户级别隔离。
DROP POLICY IF EXISTS "Users can manage own trial interests" ON user_trial_interests;
CREATE POLICY "Users can manage own trial interests" ON user_trial_interests
  FOR ALL USING (true);

-- 触发器：自动更新 updated_at（依赖 update_updated_at_column()，定义于 supabase-user-profiles.sql）
DROP TRIGGER IF EXISTS update_trial_interests_updated_at ON user_trial_interests;
CREATE TRIGGER update_trial_interests_updated_at
  BEFORE UPDATE ON user_trial_interests
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
