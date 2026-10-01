> Historical reference for the retired ChatKit implementation. Current intake and preferences use AssistantPanel, browser storage, and the LangGraph userContext input; see README.md.

# Intake Form — Greeting & Starter Prompt 映射文档

> 源文件速查
> - 表单 UI: `components/IntakeFormModal.tsx`
> - 类型定义: `lib/types/intake.ts`
> - Greeting / Prompt 配置: `lib/config.ts`
> - Session 注入: `app/api/create-session/route.ts`

---

## 1. 数据模型

```typescript
// lib/types/intake.ts

export type UserIntent       = 'trial_matching' | 'learn_about_trials' | 'learn_about_alzheimer';
export type UserRole         = 'user' | 'caregiver' | 'clinician';
export type ResponseStyle    = 'concise' | 'balanced' | 'verbose';

export interface IntakeData {
  intent:         UserIntent | null;
  role:           UserRole | null;
  response_style: ResponseStyle | null;
  completed_at?:  string;           // ISO 8601
}

export const INTAKE_STORAGE_KEY = 'intake_data';
```

---

## 2. 表单步骤

表单为 3 步向导，每步均可跳过。

### Step 1 — Goal（Intent）

| 选项标签 | 值 | 默认 |
|---|---|---|
| Learn About Alzheimer's Disease | `learn_about_alzheimer` | ✅ |
| Find Suitable Clinical Trials | `trial_matching` | |
| Learn About Clinical Trials | `learn_about_trials` | |

- 选择后自动进入 Step 2。
- 点击 **Skip for now** → 以当前默认值（`learn_about_alzheimer`）完成整个表单并关闭。

### Step 2 — Role

| 选项标签 | 值 | 默认 |
|---|---|---|
| Myself | `user` | ✅ |
| Someone else | `caregiver` | |
| As a clinician | `clinician` | |

- 选择后自动进入 Step 3。
- 点击 **Skip for now** → 保留当前 role，跳至 Step 3。
- 点击 **← Back** → 返回 Step 1。

> **⚡ 独立入口（ClinicianModal）：** 点击首页 **"Use as a clinician"** 按钮会直接打开 `ClinicianModal`，设置 `role = 'clinician'`，跳过 3-step 向导。
> - 选择 "Learn about ADRD trials" → `intent = 'learn_about_trials'`，直接进入 chat
> - 选择 "Pre-screen a client" → `intent = 'trial_matching'`，填写轻量表单后自动发送首条消息

### Step 3 — Communication Style（Response Style）

| 选项标签 | 值 | 默认 |
|---|---|---|
| Brief & Direct | `concise` | |
| Balanced | `balanced` | ✅ |
| Detailed & Comprehensive | `verbose` | |

- 选择后立即完成表单并写入 `localStorage`。
- 点击 **Skip for now** → 以当前 `balanced` 默认值完成。
- 点击 **← Back** → 返回 Step 2。

### 跳过行为总结

| 跳过时机 | 最终 `IntakeData` |
|---|---|
| Step 1 跳过全部 | `{ intent: 'learn_about_alzheimer', role: 'user', response_style: 'balanced' }` |
| Step 2 跳过 | intent 为 Step 1 选择值，role 为 `'user'`（默认） |
| Step 3 跳过 | intent + role 为已选值，response_style 为 `'balanced'`（默认） |

---

## 3. Greeting 映射

函数：`getGreetingForUser(intakeData: IntakeData | null): string`（`lib/config.ts`）

### 3.1 完整映射表（intent + role 均已知）

| intent | role | Greeting 文本 |
|---|---|---|
| `trial_matching` | `user` | Welcome to TrialChat! I'm here to help you find clinical trials that match your needs. Let's get started! |
| `trial_matching` | `caregiver` | Welcome to TrialChat! I'm here to help you find suitable clinical trials for someone you know. How can I assist? |
| `learn_about_trials` | `user` | Welcome to TrialChat! I'm here to answer your questions about Alzheimer's disease and clinical trials. What would you like to learn? |
| `learn_about_trials` | `caregiver` | Welcome to TrialChat! I'm here to help you learn about Alzheimer's disease clinical trials. What can I explain? |
| `learn_about_alzheimer` | `user` | Welcome to TrialChat! I'm here to help you learn about Alzheimer's disease. What would you like to know? |
| `learn_about_alzheimer` | `caregiver` | Welcome to TrialChat! I'm here to help you learn about Alzheimer's disease for someone you care for. What can I explain? |

### 3.2 降级映射（仅有 intent 或仅有 role）

| 条件 | Greeting 文本 |
|---|---|
| `intent = 'trial_matching'`，role 未知 | Welcome to TrialChat! I'm here to help you find clinical trials. Let's get started! |
| `intent = 'learn_about_trials'`，role 未知 | Welcome to TrialChat! I'm here to answer your questions about Alzheimer's disease and clinical trials. What would you like to learn? |
| `intent = 'learn_about_alzheimer'`，role 未知 | Welcome to TrialChat! I'm here to help you learn about Alzheimer's disease. What would you like to know? |
| `role = 'caregiver'`，intent 未知 | Welcome to TrialChat! I'm here to help you find information about Alzheimer's disease clinical trials for someone you know. How can I assist? |
| intent 和 role 均为 null（未填写） | Welcome to TrialChat! I'm here to help you navigate Alzheimer's disease clinical trials. How can I assist you today? |

### 3.3 Clinician 专属 Greeting（`role = 'clinician'`，优先于 3.1 / 3.2）

| intent | Greeting 文本 |
|---|---|
| `trial_matching` | Welcome to TrialChat. I can help you pre-screen a client for potential ADRD clinical trial matches. Please provide non-identifying clinical details. |
| `learn_about_trials` | I can help explain ADRD clinical trials, eligibility criteria, risks and benefits, and referral considerations in clinician-friendly language. |
| `learn_about_alzheimer` | I can help summarize Alzheimer's disease and related dementias for clinical context, including progression, symptoms, and research updates. |
| 未知（默认） | Welcome to TrialChat. I can help clinicians understand ADRD clinical trials, eligibility criteria, and support client pre-screening. How can I assist? |

---

## 4. Starter Prompts 映射

函数：`getStarterPromptsForUser(intakeData: IntakeData | null): StartScreenPrompt[]`（`lib/config.ts`）

每个 prompt 结构：`{ label, prompt, icon }` — `label` 是卡片显示文字，`prompt` 是实际发送给模型的文本。

### 4.1 `trial_matching` + `user`

| # | 标签 / 发送文本 | Icon |
|---|---|---|
| 1 | I'd like to find clinical trials that match my health profile | `search` |
| 2 | What are the eligibility criteria for Alzheimer's disease trials? | `notebook` |
| 3 | Are there trials near my location? | `circle-question` |

### 4.2 `trial_matching` + `caregiver`

| # | 标签 / 发送文本 | Icon |
|---|---|---|
| 1 | Help me find clinical trials suitable for someone I know | `search` |
| 2 | What eligibility criteria should I know about for Alzheimer's disease trials? | `notebook` |
| 3 | Are there trials available near us? | `circle-question` |

### 4.3 `learn_about_trials` + `user`

| # | 标签 / 发送文本 | Icon |
|---|---|---|
| 1 | Can you explain what Alzheimer's disease is and why clinical trials matter? | `circle-question` |
| 2 | What should I expect if I participate in a clinical trial? | `notebook` |
| 3 | What are the potential risks and benefits of joining a trial? | `search` |

### 4.4 `learn_about_trials` + `caregiver`

| # | 标签 / 发送文本 | Icon |
|---|---|---|
| 1 | Can you explain Alzheimer's disease and why clinical trials are important? | `circle-question` |
| 2 | What happens when someone participates in a clinical trial? | `notebook` |
| 3 | How can I help someone I know prepare for or consider joining a trial? | `search` |

### 4.5 `learn_about_alzheimer`（role 不影响 prompts）

| # | 标签 / 发送文本 | Icon |
|---|---|---|
| 1 | What are the latest research breakthroughs in Alzheimer's disease and related dementias (ADRD)? | `circle-question` |
| 2 | What causes ADRD, and can it be prevented or slowed down? | `notebook` |
| 3 | What are the stages of Alzheimer's disease? | `search` |

### 4.6 默认 Prompts（intakeData 为 null 或 intent/role 均未知）

| # | 标签 / 发送文本 | Icon |
|---|---|---|
| 1 | Can you explain what Alzheimer's disease is and why clinical trials are important? | `circle-question` |
| 2 | Find clinical trials that might be right for me? | `search` |
| 3 | What are clinical trials and what should I expect if I participate in one? | `notebook` |

### 4.7 `clinician` + `learn_about_trials`

| # | 标签 / 发送文本 | Icon |
|---|---|---|
| 1 | Explain common ADRD trial eligibility criteria | `notebook` |
| 2 | What should clinicians know about risks and benefits of trials? | `circle-question` |
| 3 | How do I discuss clinical trials with clients? | `search` |

### 4.8 `clinician` + `trial_matching`

| # | 标签 / 发送文本 | Icon |
|---|---|---|
| 1 | Help me pre-screen a client for ADRD trials | `search` |
| 2 | What key eligibility factors matter most for ADRD trials? | `notebook` |
| 3 | Identify potential trials based on a basic client profile | `circle-question` |

### 4.9 `clinician` + `learn_about_alzheimer`

| # | 标签 / 发送文本 | Icon |
|---|---|---|
| 1 | Summarize ADRD for clinical discussion | `circle-question` |
| 2 | What are the stages of Alzheimer's disease? | `notebook` |
| 3 | What recent research updates are relevant for clinicians? | `search` |

### 4.10 Prompt 选择逻辑（优先级顺序）

```
role === 'clinician'（优先）       → intent 对应 clinician 专属 prompts（4.7 / 4.8 / 4.9）
intent === 'trial_matching'        → role === 'caregiver' ? CAREGIVER : USER prompts
intent === 'learn_about_trials'    → role === 'caregiver' ? CAREGIVER : USER prompts
intent === 'learn_about_alzheimer' → ALZHEIMER prompts（与 role 无关）
role === 'caregiver'（intent 未知）→ TRIAL_MATCHING_CAREGIVER prompts
role === 'user'（intent 未知）     → TRIAL_MATCHING_USER prompts
均未知                             → DEFAULT prompts
```

---

## 5. IntakeData 的完整流向

```
IntakeFormModal (UI)
  │  用户选择 → setIntent / setRole / setResponseStyle
  │  complete() → 写入 localStorage['intake_data']
  ▼
App.tsx / ChatKitPanel.tsx
  │  getGreetingForUser(intakeData)     → ChatKit startScreen.greeting
  │  getStarterPromptsForUser(intakeData) → ChatKit startScreen.prompts
  ▼
ChatKitPanel.getClientSecret()
  │  读取 localStorage['intake_data']
  │  POST /api/create-session
  │    body.intake_data = { role, response_style, intent }
  ▼
/api/create-session/route.ts
  │  state_variables.user_role       = intake_data.role
  │  state_variables.response_style  = intake_data.response_style
  │  state_variables.user_intent     = intake_data.intent
  │  → 注入 OpenAI workflow payload
  ▼
OpenAI ChatKit Workflow
  │  通过 state_variables 控制 Agent 回复风格和上下文
```

### Supabase 同步（已登录用户）

```
用户登录
  ▼
App.tsx migrateIntakeData()
  │  读取 localStorage → POST /api/migrate-intake
  │  写入 Supabase user_profiles:
  │    intake_role / intake_response_style / intake_intent / intake_completed_at
  │  成功后清除 localStorage
  ▼
下次访问时
  App.tsx checkIntakeStatus()
  │  localStorage 为空 → GET /api/tools (get_user_profile)
  │  Supabase 有数据 → 同步回 localStorage → 跳过表单
```

---

## 6. Composer Placeholder

所有场景下统一使用：

```
Ask about clinical trials or Alzheimer's disease...
```

（`lib/config.ts` → `PLACEHOLDER_INPUT`）
