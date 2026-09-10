# Supabase 集成使用指南

## 🔒 安全说明

⚠️ **认证现状：Clerk 认证已从本项目移除**，`/api/tools` 当前不做用户身份校验，
所有请求都会以未登录状态处理。

**Key 使用方式：** 所有数据库访问都发生在服务器端（API routes），因此统一使用
`SUPABASE_SECRET_KEY`（server-only，不加 `NEXT_PUBLIC_` 前缀），该 key 会**绕过 RLS**。
这意味着 RLS 策略是否开放已不再是实际的访问控制手段——真正的访问控制完全依赖
API 路由代码本身（如 `/api/link-events` 系列接口通过 `x-admin-password` header
校验 `ADMIN_PASSWORD`）。如需恢复按用户隔离数据的能力，需要重新接入一套身份认证
方案，并在对应 API 路由里做用户身份校验（而不是依赖 RLS，因为 secret key 不受
RLS 限制）。

## 一、在 Supabase 创建数据库表

1. **登录 Supabase Dashboard**
   - 访问 [https://supabase.com/dashboard](https://supabase.com/dashboard)
   - 选择您的项目

2. **执行 SQL**
   - 点击左侧菜单 "SQL Editor"
   - 点击 "New Query"
   - 每张表对应一个独立的 SQL 文件（见下表），按需复制对应文件内容执行；
     新建项目建议按顺序全部执行一遍
   - 粘贴到编辑器中
   - 点击 "Run" 执行

   | 文件 | 对应表 |
   |---|---|
   | `supabase-user-profiles.sql` | `user_profiles` |
   | `supabase-conversation-history.sql` | `conversation_history` |
   | `supabase-user-trial-interests.sql` | `user_trial_interests` |
   | `supabase-user-qa-log.sql` | `user_qa_log` |
   | `supabase-dev-test-runs.sql` | `dev_test_runs` |
   | `supabase-trialchat-link-events.sql` | `trialchat_link_events` |

   > 历史上这些表的 CREATE / ALTER 语句分散在多个迁移文件中，现已按表合并，
   > 旧文件已移动到 `docs/archive/` 保留存档，无需再单独执行。

3. **验证表创建**
   - 点击左侧 "Table Editor"
   - 应该看到以下表：
     - `user_profiles`
     - `conversation_history`
     - `user_trial_interests`
     - `user_qa_log`

## 二、可用的 Tools

### 1. `get_user_profile` - 获取用户画像

**参数：**
```json
{
  "clerk_user_id": "user_xxx"
}
```

**返回示例：**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "clerk_user_id": "user_xxx",
    "full_name": "John Doe",
    "age": 68,
    "has_adrd": false,
    "is_caregiver": true,
    "location": {
      "city": "San Francisco",
      "state": "CA"
    }
  }
}
```

### 2. `save_user_profile` - 保存/更新用户画像

**参数：**
```json
{
  "clerk_user_id": "user_xxx",
  "full_name": "John Doe",
  "age": 68,
  "email": "john@example.com",
  "has_adrd": false,
  "is_caregiver": true,
  "relationship_to_patient": "spouse",
  "location": {
    "city": "San Francisco",
    "state": "CA",
    "country": "USA"
  },
  "mobility_status": "mobile",
  "travel_radius_miles": 50
}
```

**支持的字段：**
- `full_name`, `email`, `age`, `gender`
- `has_adrd`, `diagnosis_type`, `diagnosed_date`
- `current_medications` (JSON 对象)
- `is_caregiver`, `relationship_to_patient`
- `preferred_language`, `location` (JSON 对象)
- `mobility_status` ("mobile" | "limited" | "homebound")
- `travel_radius_miles`

### 3. `get_trial_interests` - 获取感兴趣的试验

**参数：**
```json
{
  "clerk_user_id": "user_xxx",
  "trial_status": "interested"  // 可选：interested, applied, enrolled, declined
}
```

**返回示例：**
```json
{
  "success": true,
  "data": [
    {
      "trial_id": "NCT12345678",
      "trial_name": "Memory Study",
      "trial_status": "interested",
      "match_score": 0.85,
      "interested_at": "2026-01-14T10:00:00Z"
    }
  ],
  "count": 1
}
```

### 5. `save_trial_interest` - 保存试验兴趣

**参数：**
```json
{
  "clerk_user_id": "user_xxx",
  "trial_id": "NCT12345678",
  "trial_name": "Alzheimer's Memory Study",
  "trial_status": "interested",
  "match_score": 0.85,
  "user_notes": "Looks promising, close to home"
}
```

## 三、在 Agent Builder 中配置 Tools

在 OpenAI Agent Builder 中，添加这些 tools：

### Tool 1: get_user_profile
```json
{
  "name": "get_user_profile",
  "description": "Get user profile information from database including health status, caregiver status, preferences, and location. If clerk_user_id is not provided, automatically uses the current logged-in user.",
  "parameters": {
    "type": "object",
    "properties": {
      "clerk_user_id": {
        "type": "string",
        "description": "The Clerk user ID (optional, defaults to current user)"
      }
    }
  }
}
```

### Tool 2: save_user_profile
```json
{
  "name": "save_user_profile",
  "description": "Save or update user profile information to database. Can update any combination of fields. If clerk_user_id is not provided, automatically uses the current logged-in user.",
  "parameters": {
    "type": "object",
    "properties": {
      "clerk_user_id": {
        "type": "string",
        "description": "The Clerk user ID (optional, defaults to current user)"
      },
      "full_name": {
        "type": "string",
        "description": "User's full name"
      },
      "email": {
        "type": "string",
        "description": "User's email address"
      },
      "age": {
        "type": "number",
        "description": "User's age in years"
      },
      "gender": {
        "type": "string",
        "description": "User's gender"
      },
      "has_adrd": {
        "type": "boolean",
        "description": "Whether user has Alzheimer's disease or related dementias"
      },
      "diagnosis_type": {
        "type": "string",
        "description": "Type of ADRD diagnosis if applicable (e.g., 'alzheimers', 'vascular_dementia')"
      },
      "diagnosed_date": {
        "type": "string",
        "description": "Date of diagnosis in ISO format (YYYY-MM-DD)"
      },
      "current_medications": {
        "type": "object",
        "description": "JSON object containing current medications"
      },
      "is_caregiver": {
        "type": "boolean",
        "description": "Whether user is a caregiver"
      },
      "relationship_to_patient": {
        "type": "string",
        "description": "Relationship to patient if user is a caregiver (e.g., 'spouse', 'child', 'professional')"
      },
      "preferred_language": {
        "type": "string",
        "description": "User's preferred language (e.g., 'en', 'es', 'zh')"
      },
      "location": {
        "type": "object",
        "description": "User's location information",
        "properties": {
          "city": {
            "type": "string",
            "description": "City name"
          },
          "state": {
            "type": "string",
            "description": "State or province code (e.g., 'CA', 'NY')"
          },
          "country": {
            "type": "string",
            "description": "Country code (e.g., 'USA', 'CAN')"
          },
          "zip_code": {
            "type": "string",
            "description": "ZIP or postal code"
          }
        }
      },
      "mobility_status": {
        "type": "string",
        "enum": ["mobile", "limited", "homebound"],
        "description": "User's mobility status affecting trial participation"
      },
      "travel_radius_miles": {
        "type": "number",
        "description": "Maximum distance user can travel for trials (in miles)"
      }
    }
  }
}
```

### Tool 3: get_trial_interests
```json
{
  "name": "get_trial_interests",
  "description": "Get user's interested clinical trials with optional filtering by status. If clerk_user_id is not provided, automatically uses the current logged-in user.",
  "parameters": {
    "type": "object",
    "properties": {
      "clerk_user_id": {
        "type": "string",
        "description": "The Clerk user ID (optional, defaults to current user)"
      },
      "trial_status": {
        "type": "string",
        "enum": ["interested", "applied", "enrolled", "declined"],
        "description": "Filter trials by status (optional, returns all if not specified)"
      }
    }
  }
}
```

### Tool 4: save_trial_interest
```json
{
  "name": "save_trial_interest",
  "description": "Save or update user's interest in a clinical trial. Creates new record or updates existing one based on trial_id. If clerk_user_id is not provided, automatically uses the current logged-in user.",
  "parameters": {
    "type": "object",
    "properties": {
      "clerk_user_id": {
        "type": "string",
        "description": "The Clerk user ID (optional, defaults to current user)"
      },
      "trial_id": {
        "type": "string",
        "description": "Unique trial identifier (e.g., NCT number)"
      },
      "trial_name": {
        "type": "string",
        "description": "Display name of the clinical trial"
      },
      "trial_status": {
        "type": "string",
        "enum": ["interested", "applied", "enrolled", "declined"],
        "description": "User's interest/participation status for this trial"
      },
      "match_score": {
        "type": "number",
        "minimum": 0,
        "maximum": 1,
        "description": "AI-calculated match score between 0 and 1"
      },
      "user_notes": {
        "type": "string",
        "description": "User's personal notes about this trial"
      }
    },
    "required": ["trial_id"]
  }
}
```

## 四、使用示例

### 在对话开始时获取用户信息
ChatKit 可以自动调用 `get_user_profile` 获取用户画像，了解：
- 用户是患者还是照护者
- 健康状况和诊断
- 地理位置和出行能力
- 语言偏好

**无需传递 clerk_user_id**，系统会自动使用当前登录用户：
```
助手：调用 get_user_profile({})
```

### 在对话中更新用户信息
当用户提供新信息时，调用 `save_user_profile` 保存：
```
用户："我今年 68 岁，住在加州旧金山"
助手：调用 save_user_profile({
  age: 68,
  location: {city: "San Francisco", state: "CA"}
})
```

### 记录试验兴趣
当用户对某个试验感兴趣时：
```
用户："这个试验看起来不错，我想了解更多"
助手：调用 save_trial_interest({
  trial_id: "NCT12345678",
  trial_name: "Memory Enhancement Study",
  trial_status: "interested",
  match_score: 0.9
})
```

### 查询用户之前保存的试验
```
用户："我之前看过哪些试验？"
助手：调用 get_trial_interests({})
```

## 五、配置要点

### 🔑 关键特性
1. **自动用户识别**：所有 tools 的 `clerk_user_id` 参数都是**可选的**，不传时自动使用当前登录用户
2. **安全保护**：用户只能访问和修改自己的数据，尝试访问他人数据会返回 403 错误
3. **增量更新**：`save_user_profile` 支持只更新部分字段，不需要传递完整数据
4. **智能 Upsert**：保存操作会自动判断是插入新记录还是更新现有记录

### 📝 在 Agent Builder 中配置步骤
1. 打开 [Agent Builder](https://platform.openai.com/agent-builder)
2. 选择你的 workflow
3. 点击 "Add Tool" → "Client Tool"
4. 复制上述 JSON 配置（每个 tool 一个）
5. 保存并测试

## 六、本地测试

**重要：** 所有 API 现在都需要 Clerk 认证。您需要：

1. **先登录应用**：访问 `http://localhost:3000` 并登录
2. **获取 session token**：从浏览器控制台或 Network 请求中获取
3. **使用 token 测试**：

```bash
# 方式 1：通过浏览器测试（推荐）
# 在已登录的页面中打开浏览器控制台，运行：
fetch('/api/tools', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    toolName: 'get_user_profile',
    params: { clerk_user_id: 'your_clerk_user_id' }
  })
}).then(r => r.json()).then(console.log)

# 方式 2：使用 curl（需要登录后的 session cookie）
# 这比较复杂，推荐使用方式 1

# 方式 3：临时注释掉 middleware.ts 中的认证（仅开发环境）
# 在 middleware.ts 中临时修改：
# if (isProtectedRoute(req) && !req.url.includes('/api/tools')) await auth.protect()
```

### 测试示例（浏览器控制台）

```javascript
// 保存用户资料
await fetch('/api/tools', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    toolName: 'save_user_profile',
    params: {
      clerk_user_id: 'user_2xxx',  // 您的 Clerk User ID
      full_name: 'Test User',
      age: 70,
      is_caregiver: true
    }
  })
}).then(r => r.json()).then(console.log)

// 获取用户资料
await fetch('/api/tools', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    toolName: 'get_user_profile',
    params: { clerk_user_id: 'user_2xxx' }
  })
}).then(r => r.json()).then(console.log)

// 尝试访问他人数据（应该返回 403 错误）
await fetch('/api/tools', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    toolName: 'get_user_profile',
    params: { clerk_user_id: 'someone_else_id' }  // ❌ 会被拒绝
  })
}).then(r => r.json()).then(console.log)
```

## 六、部署到 Vercel

确保在 Vercel 环境变量中已设置：
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SECRET_KEY` — server-only（不加 `NEXT_PUBLIC_` 前缀），仅在 API routes 中使用，会绕过 RLS，切勿暴露到客户端代码或日志中

这些变量已在您的 `.env.local` 中配置。
