-- =====================================================
-- Table: conversation_history
-- 对话历史表：记录重要的对话信息
-- 来源：supabase-schema.sql
-- =====================================================

CREATE TABLE IF NOT EXISTS conversation_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_user_id TEXT NOT NULL,
  session_id TEXT,

  -- 对话内容
  user_message TEXT,
  assistant_response TEXT,
  intent TEXT,  -- 如：trial_search, education, enrollment_help

  -- 提取的关键信息
  extracted_info JSONB,  -- 从对话中提取的结构化信息

  -- 元数据
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_conversation_clerk_id ON conversation_history(clerk_user_id);
CREATE INDEX IF NOT EXISTS idx_conversation_session ON conversation_history(session_id);

-- RLS
ALTER TABLE conversation_history ENABLE ROW LEVEL SECURITY;

-- 注意：所有策略都设为 true —— 认证已从本项目移除（原 Clerk 认证已下线），
-- 目前仅依赖 Supabase RLS 作为唯一保护层，尚未做细粒度的用户级别隔离。
DROP POLICY IF EXISTS "Users can view own conversations" ON conversation_history;
CREATE POLICY "Users can view own conversations" ON conversation_history
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can insert own conversations" ON conversation_history;
CREATE POLICY "Users can insert own conversations" ON conversation_history
  FOR INSERT WITH CHECK (true);
