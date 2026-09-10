# 将 Intake Context 传递给 ChatKit 的最佳方案

## 问题
经过测试，OpenAI ChatKit Sessions API **不支持以下参数**：
- `additional_instructions`
- `instructions`
- `metadata`
- `chatkit_configuration.additional_instructions`

## 解决方案：首条隐藏消息法

### 方案概述
在用户开始对话之前，自动发送一条包含 intake context 的系统指令消息，让 AI 在整个对话中遵循。

### 实现步骤

#### 1. 创建 Context Provider
```typescript
// contexts/IntakeFormContext.tsx
import { createContext, useContext, useState, useEffect } from 'react';

export interface IntakeData {
  role: 'user' | 'caregiver' | null;
  responseStyle: 'concise' | 'balanced' | 'verbose' | null;
  intent: 'trial_matching' | 'learn_about_trials' | null;
  completed: boolean;
}

const IntakeFormContext = createContext<{
  intakeData: IntakeData | null;
  setIntakeData: (data: IntakeData) => void;
} | null>(null);

export function IntakeFormProvider({ children }: { children: React.ReactNode }) {
  const [intakeData, setIntakeData] = useState<IntakeData | null>(null);

  // 从 localStorage 加载
  useEffect(() => {
    const stored = localStorage.getItem('intake_data');
    if (stored) {
      setIntakeData(JSON.parse(stored));
    }
  }, []);

  return (
    <IntakeFormContext.Provider value={{ intakeData, setIntakeData }}>
      {children}
    </IntakeFormContext.Provider>
  );
}

export const useIntakeForm = () => {
  const context = useContext(IntakeFormContext);
  if (!context) throw new Error('useIntakeForm must be used within IntakeFormProvider');
  return context;
};
```

#### 2. 修改 ChatKitPanel 发送初始 Context

```typescript
// components/ChatKitPanel.tsx

export function ChatKitPanel({
  theme,
  intakeData, // 新增 prop
  // ... 其他 props
}: ChatKitPanelProps & { intakeData?: IntakeData | null }) {
  const [contextSent, setContextSent] = useState(false);

  // 监听 ChatKit 初始化完成
  useEffect(() => {
    if (!chatkit || !intakeData || contextSent) return;

    // 等待 session 创建完成后发送 context
    const sendIntakeContext = async () => {
      try {
        // 构建 context 消息
        const contextMessage = buildContextMessage(intakeData);

        // 发送为用户消息（但带特殊标记）
        await chatkit.sendUserMessage({
          text: contextMessage,
        });

        setContextSent(true);
        console.log('[ChatKit] Intake context sent successfully');
      } catch (error) {
        console.error('[ChatKit] Failed to send intake context:', error);
      }
    };

    // 延迟发送，确保 session 已准备好
    const timer = setTimeout(sendIntakeContext, 500);
    return () => clearTimeout(timer);
  }, [chatkit, intakeData, contextSent]);

  // ... 其他代码
}

// 构建 context 消息的辅助函数
function buildContextMessage(intake: IntakeData): string {
  const roleDesc = intake.role === 'caregiver'
    ? 'I am a caregiver seeking information for a loved one'
    : 'I am seeking information for myself';

  const styleDesc = {
    concise: 'I prefer brief, concise responses with bullet points',
    balanced: 'I prefer balanced responses with moderate detail',
    verbose: 'I prefer detailed, comprehensive responses with thorough explanations'
  }[intake.responseStyle || 'balanced'];

  const intentDesc = intake.intent === 'trial_matching'
    ? 'My primary goal is to find suitable clinical trials'
    : 'I want to learn more about clinical trials before making decisions';

  return `[Initial Context]: ${roleDesc}. ${styleDesc}. ${intentDesc}. Please keep this context in mind for our conversation.`;
}
```

#### 3. 备选方案：Workflow 层面处理

如果不想在对话历史中显示 context 消息，可以在 **OpenAI Workflow** 中配置：

**在 Workflow 中添加变量检测逻辑：**

```javascript
// Workflow pseudo-code
if (message.text.startsWith('[Initial Context]:')) {
  // 提取 context
  const context = parseInitialContext(message.text);
  
  // 更新 session variables
  session.variables = {
    user_role: context.role,
    response_style: context.responseStyle,
    user_intent: context.intent,
  };
  
  // 不将此消息添加到对话历史
  return {
    skipMessageHistory: true,
    response: null, // 不回复
  };
}

// 在后续的 completion 调用中使用这些变量
const systemPrompt = buildSystemPrompt(session.variables);
```

#### 4. 更优雅的方案：Workflow Input Variables

如果 OpenAI Workflow 支持 **Input Variables**（需要在 Platform 确认），可以这样：

**在 create-session 时传递（如果支持）：**
```typescript
const payload = {
  workflow: { 
    id: workflowId,
    // 尝试传递变量
    variables: {
      user_role: intakeData.role,
      response_style: intakeData.responseStyle,
      user_intent: intakeData.intent,
    }
  },
  user: effectiveUserId,
};
```

**在 Workflow 中使用变量：**
```javascript
const systemPrompt = `
You are a helpful AI assistant for clinical trials.

User Context:
- Role: {{workflow.variables.user_role}}
- Preferred Style: {{workflow.variables.response_style}}
- Intent: {{workflow.variables.user_intent}}

Adapt your responses accordingly.
`;
```

### 方案对比

| 方案 | 优点 | 缺点 | 推荐度 |
|------|------|------|--------|
| **首条消息** | ✅ 简单可靠<br>✅ 100% 可控 | ⚠️ 用户可能看到<br>⚠️ 占用对话历史 | ⭐⭐⭐⭐ |
| **Workflow 拦截** | ✅ 用户看不到<br>✅ 不占历史 | ⚠️ 需要 Workflow 配置<br>⚠️ 复杂度高 | ⭐⭐⭐⭐⭐ |
| **Workflow Variables** | ✅ 最优雅<br>✅ 原生支持 | ❌ 需确认是否支持 | ⭐⭐⭐⭐⭐ (如果支持) |

### 推荐实施顺序

1. **立即实施**：首条消息方案（最快）
2. **短期优化**：测试 Workflow Variables 是否支持
3. **长期方案**：Workflow 拦截处理（最优雅）

### 实际代码示例

```typescript
// app/App.tsx 或 ChatKitPanel.tsx

const { intakeData } = useIntakeForm();
const [isContextInitialized, setIsContextInitialized] = useState(false);

useEffect(() => {
  if (!chatkit || !intakeData || isContextInitialized) return;

  const initializeContext = async () => {
    // 等待 ChatKit 完全初始化
    await new Promise(resolve => setTimeout(resolve, 1000));

    const contextMsg = `[SYSTEM CONTEXT - Please acknowledge silently]

User Profile:
- ${intakeData.role === 'caregiver' ? 'Caregiver for loved one' : 'Patient seeking for self'}
- Prefers ${intakeData.responseStyle} responses
- ${intakeData.intent === 'trial_matching' ? 'Wants trial matching' : 'Wants to learn first'}

Remember this context throughout our conversation. Reply with just "Understood" and nothing else.`;

    try {
      await chatkit.sendUserMessage({ text: contextMsg });
      setIsContextInitialized(true);
    } catch (error) {
      console.error('Failed to initialize context:', error);
    }
  };

  initializeContext();
}, [chatkit, intakeData, isContextInitialized]);
```

### 注意事项

1. **用户体验**：首条消息会显示在对话历史中，考虑使用简洁的表述
2. **Timing**：确保在用户发送第一条消息前发送 context
3. **错误处理**：如果发送失败，应有重试机制
4. **Session 持久化**：刷新页面后需要重新检查是否已发送 context

### 下一步

请先测试更新后的参数测试，看看 `workflow.variables` 或 `user` 对象是否支持 metadata。

如果都不支持，我们就采用**首条消息方案**，这是最可靠的。
