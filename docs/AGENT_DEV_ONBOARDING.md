# Agent 本地开发 & Prompt/Node 修改指南

仓库：https://github.com/S-3-Research/trialchat
分支：`acadia-main-agent-promptfix`

```bash
git clone https://github.com/S-3-Research/trialchat.git
cd trialchat
git fetch origin
git checkout acadia-main-agent-promptfix
```

环境变量：

```bash
cp apps/agent/.env.example apps/agent/.env.local
cp apps/web/.env.example apps/web/.env.local
```

填 `OPENAI_API_KEY`（找我要），其他按需，`DATABASE_URL` 不用填。

启动（Docker Desktop 先打开）：

```bash
docker compose up
```

访问：
- 前端 `http://localhost:3000`
- Agent `http://localhost:2024`，LangGraph Studio 链接在启动日志里
  （形如 `https://smith.langchain.com/studio/?baseUrl=http://localhost:2024`）

代码改了自动热更新，不用重启。停止：`Ctrl + C`。

---

## 改哪里

```
intention → {knowledge | api_agent | other_questions} → suggestions_agent → END
```

改 prompt 文案看 `configs/*.config.ts`：

- 意图分类 `apps/agent/src/configs/intention.config.ts`
- 知识库问答 `apps/agent/src/configs/knowledge.config.ts`
- 临床试验检索 `apps/agent/src/configs/api-agent.config.ts`
- 其他/闲聊 `apps/agent/src/configs/other-questions.config.ts`
- 猜你想问建议 `apps/agent/src/configs/suggestions.config.ts`

改逻辑（工具调用/返回结构）才碰对应 `apps/agent/src/nodes/*.ts`，改之前说一声。

工具定义 `apps/agent/src/tools/`，node 组装逻辑
`apps/agent/src/factories/create-agent-node.ts`，state 定义 `apps/agent/src/state.ts`。

---

## 提交

```bash
git add -A
git commit -m "prompt: 描述这次改了什么"
git push
```

push 完 @我一声就行。

---

常见问题：`.env.local` 不会提交；容器起不来就 `docker compose down` 再 `up`。



