# Intake Form 逻辑文档

## 概述

Intake Form 是一个 3 步问卷，用于收集用户的基本信息和偏好设置，以便为 ChatKit 提供个性化的对话体验。系统支持三种用户场景：未登录（Guest）、已登录、以及中途登录。

> ⚠️ **现状说明**：Clerk 认证已从本项目移除，登录入口当前处于禁用状态
> （`isSignedIn` 恒为 `false`）。因此下文"已登录用户"、"中途登录"相关场景
> 目前是未激活的死代码路径，仅作为将来重新接入认证系统时的参考保留。
> 实际生产环境中所有用户都会走 Guest 流程。

---

## 数据存储策略

### Guest 用户
- **存储位置**: `localStorage`
- **存储键**: `intake_data`
- **数据结构**:
```typescript
{
  role: 'user' | 'caregiver',
  response_style: 'concise' | 'balanced' | 'verbose',
  intent: 'trial_matching' | 'learn_about_trials',
  completed_at: '2026-02-03T12:00:00.000Z'
}
```

### 已登录用户
- **存储位置**: Supabase `user_profiles` 表
- **字段**:
  - `intake_role` (TEXT)
  - `intake_response_style` (TEXT)
  - `intake_intent` (TEXT)
  - `intake_completed_at` (TIMESTAMPTZ)
  - `is_caregiver` (BOOLEAN) - 自动从 `intake_role` 同步

---

## 场景 1: Guest 用户（未登录）

### 流程图

```
┌─────────────────┐
│  访问 /chat     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 检查 localStorage│
│ 有 intake_data? │
└────────┬────────┘
         │
    ┌────┴────┐
    │   有    │   无
    ▼         ▼
┌─────┐   ┌──────────────┐
│跳过 │   │显示 Intake   │
│表单 │   │Form Modal    │
└─────┘   └──────┬───────┘
              │
              ▼
       ┌──────────────┐
       │ 用户填写表单 │
       │ (3个步骤)    │
       └──────┬───────┘
              │
              ▼
       ┌──────────────┐
       │ 保存到       │
       │ localStorage │
       └──────┬───────┘
              │
              ▼
       ┌──────────────┐
       │ ChatKit 加载 │
       └──────┬───────┘
              │
              ▼
       ┌──────────────┐
       │ 读取 intake  │
       │ 数据并自动   │
       │ 发送上下文   │
       └──────────────┘
```

### 代码位置

1. **检查逻辑**: `/app/App.tsx` - `checkIntakeStatus()` useEffect
2. **表单组件**: `/components/IntakeFormModal.tsx`
3. **数据保存**: `IntakeFormModal.tsx` - `handleComplete()` 保存到 localStorage
4. **上下文发送**: `/components/ChatKitPanel.tsx` - useEffect 读取 localStorage 并调用 `sendUserMessage()`

### 关键代码片段

```typescript
// App.tsx - Guest 用户检查
const stored = localStorage.getItem(INTAKE_STORAGE_KEY);
if (stored) {
  setIntakeCompleted(true);
  setShowIntakeModal(false);
} else {
  setShowIntakeModal(true);
}
```

---

## 场景 2: 已登录用户

### 流程图

```
┌─────────────────┐
│  访问 /chat     │
│  (已登录)       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 检查 localStorage│
│ 有 intake_data? │
└────────┬────────┘
         │
    ┌────┴────┐
    │   有    │   无
    ▼         ▼
┌─────┐   ┌──────────────┐
│跳过 │   │ 检查 Supabase│
│表单 │   │ 有 intake?   │
└─────┘   └──────┬───────┘
              │
         ┌────┴────┐
         │   有    │   无
         ▼         ▼
      ┌─────┐  ┌──────────────┐
      │跳过 │  │显示 Intake   │
      │表单 │  │Form Modal    │
      └─────┘  └──────┬───────┘
                   │
                   ▼
            ┌──────────────┐
            │ 用户填写表单 │
            │ (3个步骤)    │
            └──────┬───────┘
                   │
                   ▼
            ┌──────────────┐
            │ 保存到       │
            │ localStorage │
            │ 同时调用 API │
            └──────┬───────┘
                   │
              ┌────┴────┐
              │         │
              ▼         ▼
       ┌──────────┐ ┌──────────┐
       │POST /api/│ │ ChatKit  │
       │migrate-  │ │ 加载     │
       │intake    │ └─────┬────┘
       └────┬─────┘       │
            │             ▼
            ▼      ┌──────────────┐
       ┌──────────┐│ 读取 intake  │
       │ 保存到   ││ 数据并自动   │
       │ Supabase ││ 发送上下文   │
       └──────────┘└──────────────┘
```

### 代码位置

1. **Supabase 检查**: `/app/App.tsx` - `checkIntakeStatus()` 调用 `/api/tools` (get_user_profile)
2. **表单完成**: `/app/App.tsx` - `handleIntakeComplete()` 调用 `/api/migrate-intake`
3. **API Route**: `/app/api/migrate-intake/route.ts` - 保存数据到 Supabase

### 关键代码片段

```typescript
// App.tsx - 已登录用户检查 Supabase
const response = await fetch("/api/tools", {
  method: "POST",
  body: JSON.stringify({
    toolName: "get_user_profile",
    params: {},
  }),
});

const result = await response.json();
if (result.success && result.data?.intake_completed_at) {
  // Sync Supabase data to localStorage for ChatKit session creation
  const intakeData = {
    role: result.data.intake_role,
    response_style: result.data.intake_response_style,
    intent: result.data.intake_intent,
    completed_at: result.data.intake_completed_at,
  };
  localStorage.setItem(INTAKE_STORAGE_KEY, JSON.stringify(intakeData));
  
  setIntakeCompleted(true);
  setShowIntakeModal(false);
  setIsCheckingIntake(false); // 标记检查完成
}
```

```typescript
// App.tsx - 保存到 Supabase
const response = await fetch("/api/migrate-intake", {
  method: "POST",
  body: JSON.stringify({
    role: data.role,
    response_style: data.response_style,
    intent: data.intent,
  }),
});
```

---

## 场景 3: 中途登录（Guest → 已登录）

### 流程图

```
┌─────────────────┐
│  Guest 用户     │
│  填写了 Intake  │
│  (存在 localStorage)│
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  用户点击登录   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Clerk 登录成功 │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ useEffect 检测  │
│ isSignedIn = true│
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 检查 localStorage│
│ 有 intake_data? │
└────────┬────────┘
         │
    ┌────┴────┐
    │   有    │   无
    ▼         ▼
┌──────────┐ ┌─────┐
│ 自动迁移 │ │跳过 │
│ 数据     │ └─────┘
└────┬─────┘
     │
     ▼
┌──────────────┐
│POST /api/    │
│migrate-intake│
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ 保存到       │
│ Supabase     │
│ user_profiles│
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ 迁移成功后   │
│ 清除         │
│ localStorage │
└──────────────┘
```

### 代码位置

1. **自动迁移**: `/app/App.tsx` - 监听 `isSignedIn` 变化的 useEffect
2. **迁移 API**: `/app/api/migrate-intake/route.ts`
3. **数据清理**: 成功后 `localStorage.removeItem(INTAKE_STORAGE_KEY)`
4. **竞态防护**: `checkIntakeStatus` 守卫条件 + 依赖数组监听 `isMigratingIntake`

### 关键代码片段

```typescript
// App.tsx - 自动迁移逻辑
useEffect(() => {
  if (!isLoaded || !isSignedIn || isMigratingIntake) return;

  const migrateIntakeData = async () => {
    const stored = localStorage.getItem(INTAKE_STORAGE_KEY);
    if (!stored) return;

    setIsMigratingIntake(true);
    const data = JSON.parse(stored) as IntakeData;

    const response = await fetch("/api/migrate-intake", {
      method: "POST",
      body: JSON.stringify({
        role: data.role,
        response_style: data.response_style,
        intent: data.intent,
      }),
    });

    const result = await response.json();
    if (result.success) {
      // 迁移成功，清除 localStorage
      localStorage.removeItem(INTAKE_STORAGE_KEY);
    }
    setIsMigratingIntake(false);
  };

  migrateIntakeData();
}, [isLoaded, isSignedIn, isMigratingIntake]);
```

---

## 数据库 Schema

### user_profiles 表新增字段

```sql
-- Intake form data
intake_role TEXT,                    -- 'user' or 'caregiver'
intake_response_style TEXT,          -- 'concise', 'balanced', or 'verbose'
intake_intent TEXT,                  -- 'trial_matching' or 'learn_about_trials'
intake_completed_at TIMESTAMPTZ,     -- 完成时间戳
```

### 触发器 - 自动同步字段

```sql
CREATE OR REPLACE FUNCTION sync_intake_role_to_is_caregiver()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.intake_role IS NOT NULL THEN
    NEW.is_caregiver = (NEW.intake_role = 'caregiver');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sync_intake_role
  BEFORE INSERT OR UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION sync_intake_role_to_is_caregiver();
```

---

## ChatKit 上下文发送

### 实现方式
通过 **workflow.state_variables** 在 session 创建时全局注入用户偏好设置。

### 优势
- ✅ **全局生效**: 所有 thread（对话）都能访问这些变量
- ✅ **不占历史**: 不会在对话记录中显示
- ✅ **原生支持**: 使用 ChatKit 官方 API
- ✅ **持久化**: 整个 session 生命周期内有效

### 技术细节

**Session 创建时传递**（`/app/api/create-session/route.ts`）:
```typescript
const payload = {
  workflow: { 
    id: workflowId,
    state_variables: {
      user_role: 'caregiver',           // or 'user'
      response_style: 'concise',        // or 'balanced', 'verbose'
      user_intent: 'trial_matching'     // or 'learn_about_trials'
    }
  },
  user: effectiveUserId,
};
```

**Workflow 中使用**（OpenAI Platform）:
```
System Prompt:
You are a helpful assistant for clinical trials.

User Context:
- Role: {{workflow.state.user_role}}
- Response Style: {{workflow.state.response_style}}
- Intent: {{workflow.state.user_intent}}

Adapt your responses based on these preferences.
```

### 数据流

```
localStorage (intake_data)
         ↓
ChatKitPanel 读取
         ↓
传递给 /api/create-session
         ↓
添加到 workflow.state_variables
         ↓
ChatKit Session 创建
         ↓
Workflow 全局可用（所有 threads）
```

### 代码位置

1. **前端读取**: `/components/ChatKitPanel.tsx` - getClientSecret() 函数
2. **后端处理**: `/app/api/create-session/route.ts` - 构建 state_variables
3. **Workflow 配置**: OpenAI Platform - Workflow System Prompt

---

## 状态管理总结

| 状态 | Guest | 已登录 | 中途登录 |
|------|-------|--------|----------|
| **数据存储** | localStorage | Supabase + localStorage (同步) | localStorage → Supabase → localStorage |
| **检查顺序** | localStorage only | localStorage → Supabase → 同步到 localStorage | localStorage → 迁移 → Supabase → 同步 |
| **表单触发** | 无数据时显示 | localStorage 和 Supabase 都无数据时显示 | 已有数据，跳过表单 |
| **保存逻辑** | IntakeFormModal → localStorage | IntakeFormModal → localStorage + API → Supabase | 登录后自动迁移 |
| **上下文发送** | session 创建时 state_variables | session 创建时 state_variables | session 创建时 state_variables |
| **竞态防护** | 无需 | isCheckingIntake 防止过早渲染 | isMigratingIntake 阻止并发检查 |

---

## 文件清单

### 核心文件
- `/app/App.tsx` - 主逻辑控制器
- `/components/IntakeFormModal.tsx` - 表单组件
- `/components/ChatKitPanel.tsx` - ChatKit 集成 + 上下文发送
- `/lib/types/intake.ts` - 类型定义

### API Routes
- `/app/api/migrate-intake/route.ts` - 迁移数据到 Supabase
- `/app/api/tools/route.ts` - get_user_profile 工具

### 数据库
- `/supabase-schema.sql` - 完整 schema
- `/supabase-intake-migration.sql` - Intake 字段迁移 SQL

---

## 测试场景

### 场景 1: 新 Guest 用户
1. ✅ 访问 `/chat` → 显示 Intake Form
2. ✅ 填写 3 步问卷 → 数据保存到 localStorage
3. ✅ ChatKit 加载 → 自动发送上下文消息
4. ✅ 刷新页面 → 不再显示表单（读取 localStorage）

### 场景 2: 新登录用户
1. ✅ 登录后访问 `/chat` → 检查 Supabase 无数据 → 显示 Intake Form
2. ✅ 填写问卷 → 同时保存到 localStorage 和 Supabase
3. ✅ ChatKit 加载 → 自动发送上下文消息
4. ✅ 刷新页面 → 不再显示表单（读取 Supabase）

### 场景 3: Guest → 登录
1. ✅ Guest 填写表单 → localStorage 有数据
2. ✅ 点击登录 → Clerk 认证
3. ✅ 登录成功 → 自动检测 localStorage → 调用 migrate API
4. ✅ 数据迁移到 Supabase → 清除 localStorage
5. ✅ 后续访问 → 从 Supabase 读取数据

### 场景 4: 已有数据的用户
1. ✅ Supabase 已有 intake_completed_at → 同步到 localStorage → 跳过表单
2. ✅ ChatKit 从 localStorage 读取并传递 state_variables

---

## 注意事项

### 数据一致性
- ✅ Trigger 自动同步 `intake_role` → `is_caregiver`
- ✅ 迁移成功后清除 localStorage，避免数据冗余
- ✅ 失败回退：Supabase 保存失败时，保留 localStorage 数据
- ✅ Supabase 数据自动同步到 localStorage（确保 ChatKitPanel 能读取）
- ✅ 竞态防护：`isMigratingIntake` 阻止并发操作

### 性能优化
- ✅ `isCheckingIntake` flag 防止 ChatKitPanel 过早渲染
- ✅ localStorage 优先检查，减少 API 调用
- ✅ 所有 thread 自动继承 state_variables
- ✅ 竞态条件修复：迁移完成后再检查（额外延迟 ~200-500ms）移
- ✅ localStorage 优先检查，减少 API 调用
- ✅ 所有 thread 自动继承 state_variables

### 安全性
- ✅ `/api/migrate-intake` 需要认证（Clerk userId）
- ✅ Supabase RLS 策略保护数据
- ✅ 用户只能访问自己的 profile 数据

---

## 未来优化建议

1. **Workflow System Prompt 配置**
   - 在 OpenAI Platform 中配置使用 state_variables
   - 根据 user_role 和 response_style 动态调整回复风格
   - 示例: "When user_role is 'caregiver', be more supportive and explain medical terms clearly"

2. **渐进式表单**
   - 允许用户随时更新偏好
   - 在 settings 页面提供编辑入口
   - 更新后重新创建 session 应用新设置

3. **智能推荐**
   - 根据对话历史动态调整 response_style
   - 机器学习优化个性化体验

4. **数据分析**
   - 统计不同 intent/role 的使用分布
   - 优化问卷设计

5. **离线支持**
   - Service Worker 缓存 intake 数据
   - 网络恢复后自动同步

## Workflow 配置示例

在 OpenAI Platform 的 Workflow System Prompt 中使用：

```
You are TrialChat, an AI assistant helping users find and learn about Alzheimer's clinical trials.

User Context (from intake form):
- Role: {{workflow.state.user_role || "unknown"}}
- Preferred Response Style: {{workflow.state.response_style || "balanced"}}
- Primary Intent: {{workflow.state.user_intent || "general"}}

Response Guidelines:
{% if workflow.state.user_role == "caregiver" %}
- Remember you're speaking to a caregiver, not the patient
- Be empathetic and provide support for caregiving challenges
- Explain medical terms clearly as they'll need to relay info to their loved one
{% else %}
- Address the user directly as they're seeking for themselves
- Empower them with knowledge to make informed decisions
{% endif %}

{% if workflow.state.response_style == "concise" %}
- Keep responses brief and to the point
- Use bullet points and short paragraphs
- Avoid lengthy explanations unless specifically asked
{% elif workflow.state.response_style == "verbose" %}
- Provide comprehensive, detailed explanations
- Include context, examples, and background information
- Anticipate follow-up questions and address them proactively
{% else %}
- Balance brevity with necessary detail
- Explain key concepts but avoid overwhelming the user
{% endif %}

{% if workflow.state.user_intent == "trial_matching" %}
- Prioritize helping them find suitable clinical trials
- Focus on eligibility criteria and practical logistics
- Proactively ask clarifying questions to narrow down matches
{% else %}
- Focus on education about clinical trials in general
- Explain the research process, benefits, and risks
- Only suggest specific trials when they express interest
{% endif %}
```
