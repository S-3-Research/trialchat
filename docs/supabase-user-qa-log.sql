-- =====================================================
-- Table: user_qa_log
-- 用户问答记录表：记录用户的常见问题，用于改进系统
-- 来源：supabase-schema.sql
-- =====================================================

CREATE TABLE IF NOT EXISTS user_qa_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_user_id TEXT NOT NULL,

  question TEXT NOT NULL,
  answer TEXT,
  category TEXT,  -- eligibility, process, safety, etc.
  helpful BOOLEAN,  -- 用户反馈

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_qa_log_clerk_id ON user_qa_log(clerk_user_id);

-- RLS
ALTER TABLE user_qa_log ENABLE ROW LEVEL SECURITY;

-- 注意：所有策略都设为 true —— 认证已从本项目移除（原 Clerk 认证已下线），
-- 目前仅依赖 Supabase RLS 作为唯一保护层，尚未做细粒度的用户级别隔离。
DROP POLICY IF EXISTS "Users can manage own Q&A" ON user_qa_log;
CREATE POLICY "Users can manage own Q&A" ON user_qa_log
  FOR ALL USING (true);
