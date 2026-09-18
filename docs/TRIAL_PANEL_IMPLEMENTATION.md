# Trial Panel 持久化、thread 隔离与交互实现

更新日期：2026-09-18。

本文描述本次提交相对 `fb6f16a` 的全部功能变更，包括 thread 切换、checkpoint 保存、选中 trial 的模型上下文、侧栏徽标、筛选和响应式布局。验证范围与已知边界见文末。

## 1. 目标与行为

- Trial Panel 的筛选、结果、分页和选择状态归属于各自的 thread。
- Panel 操作直接保存到 LangGraph checkpoint，不必等待下一条聊天消息。
- 快速点击多个历史会话时，交由 assistant-ui 的切换 generation 机制处理，不再通过应用层锁忽略后续点击。
- New Chat、删除当前会话后发生的切换、程序化切换，都通过 runtime 的实际选中 id 同步 Panel。
- 切换时保留 Panel 的展开状态；加载目标 thread 时显示 skeleton。
- 选中 trial 的问答上下文覆盖 trial matching、knowledge 和 other questions 三个回答分支。
- checkpoint 始终保存完整结果；只在组装模型输入时省略与已选 trial 重复的完整结果列表。

## 2. 文件职责

| 文件 | 职责 |
| --- | --- |
| `apps/web/components/AssistantPanel.tsx` | runtime 配置、当前 thread 快照、checkpoint adapter、`TrialThreadSync`、面板布局 |
| `apps/web/contexts/TrialSearchContext.tsx` | 搜索状态、请求取消、thread 归属、切换 flush、自动保存 |
| `apps/web/lib/latestThreadSaveQueue.ts` | 每 thread 独立串行保存、合并待保存版本、409 重试 |
| `apps/web/components/assistant-ui/TrialSearchChatBridge.tsx` | tool result 接收、下轮 run 输入、侧栏数量更新 |
| `apps/web/lib/types/trialSearch.ts` | UI 状态、持久化形状、序列化和恢复 |
| `apps/web/lib/threadListAdapter.ts` | 会话列表、元数据及 trial count 持久化 |
| `apps/web/components/assistant-ui/ThreadListSidebar.tsx` | 原生切换、删除和数量徽标 |
| `apps/web/components/assistant-ui/TrialPanel.tsx` | 卡片、加载骨架、筛选入口、分页入口 |
| `apps/web/components/assistant-ui/TrialSearchModal.tsx` | 年龄模式、条件和排序的统一提交 |
| `apps/web/hooks/useLayoutTier.ts` | 三档响应式布局 |
| `apps/web/app/globals.css` | 双滑块年龄范围样式 |
| `apps/web/app/trial-chat/(main)/chat-v2/page.tsx` | 页面顶部间距调整 |
| `apps/agent/src/configs/{api-agent,knowledge,other-questions}.config.ts` | trial 上下文开关和已选 trial 提示词 |
| `apps/agent/src/factories/create-agent-node.ts` | 构建模型专用上下文，不修改 checkpoint 中的完整结果 |
| `apps/agent/src/types/active-trial-search.ts` | 与 Web payload 对齐的字段声明 |
| `apps/web/tests/thread-search.test.tsx` | thread 隔离、恢复、筛选和保存顺序回归测试 |
| `apps/web/vitest.config.ts`、`apps/web/package.json`、`package-lock.json` | Vitest、React renderer 测试配置及依赖 |

## 3. thread 身份与恢复

使用两个不同的标识：

- `threadListItem.id`：assistant-ui 分配的稳定 slot id，作为搜索状态的 owner key。
- `threadListItem.remoteId`：LangGraph thread id，用于 `getState` / `updateState`。

新会话在首次发消息前可能没有 remote id。后续分配 remote id 时只更新保存 adapter，不重置已经编辑的搜索。

`AssistantPanel` 将 `{ key, remoteId, trialState }` 放在同一个 React state 中更新，避免身份和数据分别落到不同 render。`TrialThreadSync` 观察实际 runtime id；每次真实切换都请求目标 checkpoint。请求使用递增序号和 cleanup 标记，旧请求的迟到响应不会覆盖新的选择。

`TrialSearchProvider` 不随 thread 切换 remount，因此展开状态可以保留。切换提交后，其 layout effect：

1. 使用旧 thread 的 adapter 保存旧状态快照。
2. 中止旧 Panel API 请求，并递增 request id，使忽略 abort 的迟到响应也无法更新状态。
3. 更新 owner key、搜索状态和保存签名基线，清空当前 thread 的临时搜索历史。

切换 reset 完成前，Context 对外暴露旧 owner key 和 hydration 标记。Bridge 的三个 effect（徽标、run 输入、tool result 接收）都检查 owner 是否与 runtime 一致，以及是否仍在 hydration。归属 ref 和 adapter ref 在 commit 后更新，不在 render 阶段执行 flush 或修改归属。

若读取目标 checkpoint 失败，记录错误，并以该目标 thread 的空状态结束切换，避免继续显示其他会话的数据。此时不会自动保存 idle 状态。

## 4. checkpoint 数据结构

`activeTrialSearch` 的持久化字段：

| 字段 | 用途 |
| --- | --- |
| `criteria`、`sort` | 当前搜索条件与排序 |
| `results` | 完整的当前结果列表，包括已追加页面 |
| `pagination` | page、pageSize、total、totalPages、hasNextPage |
| `selectedTrialIds` | 用户选中的 trial ids |
| `status`、`updatedAt` | 搜索状态与已有更新时间 |
| `lastAppliedToolCallId` | 已纳入该快照的最新聊天搜索结果标记 |

不持久化 UI 随机 `id`、临时 `askedTrialIds` 和错误文案。序列化不会凭空生成新的 `updatedAt`，因此未发生数据变化时签名保持稳定。

恢复时兼容旧 `selectedTrials` 数组，提取其 ids。历史 checkpoint 的 `searching` / `loading-more` 会根据是否有结果转换成 `success` 或 `idle`，避免恢复一个没有请求驱动的永久 spinner。旧数据已经丢失的完整 `results` 不会被自动重建。

这些是 graph state JSON 字段，没有新增关系表或数据库迁移。

## 5. 保存顺序与重试

普通 settled 搜索（`success` / `error`）自动保存；卡片选择使用 150ms debounce，其余搜索更新使用 0ms 定时调度。切换时 flush 可以保存非 idle 的在途搜索快照，恢复函数会处理其临时状态。

`LatestThreadSaveQueue` 按 owner key 分组：

- 同一 thread 同时最多一个 adapter save 正在执行。
- 相同签名的在途保存共享 Promise。
- 新快照替代尚未执行的旧快照，以及旧快照的后续重试。
- 已发出的写请求会等待结束，再写最新快照，避免旧请求最后落地覆盖新请求。
- 不同 thread 的保存互不阻塞。
- 遇到错误文本包含 `409` 或 `thread is busy`，按 1s、2s、4s 最多重试三次。
- 永久失败或重试耗尽时记录错误并更新 `persistenceStatus`；后台 thread 的完成状态不会改变当前 thread 的保存提示。

只有最新任务成功时才更新保存签名基线。只要有在途保存，即使用户撤销选择回到最初签名，也会提交最终快照，确保服务器最终状态与撤销后的 UI 一致。

队列作用域是当前 Provider 实例，不是数据库锁，也不提供跨标签页或跨客户端的版本冲突解决。

## 6. Chat 与模型上下文

Bridge 只接收完成的、成功的 `trial_search` tool result。内存去重 key 包含 thread id 和 tool call id；恢复快照带有 `lastAppliedToolCallId` 时，跳过该标记及之前的历史结果，保留后续 Panel 编辑，同时允许新的 tool result 更新搜索。

发给下一轮 run 的输入包含完整持久化 payload，以及根据 `selectedTrialIds` 从当前结果查出的 `selectedTrials`。staging 签名包含 thread key，防止两个 thread 的相同内容被错误地当成一次更新。

Agent 在本地组装 system context：有 `selectedTrials` 时省略模型输入中的 `results`，并明确将未指名的后续问题限定到已选 trial。原 graph state 不变，也不向历史 `messages` 追加此上下文。knowledge 和 other questions 分支同样启用此上下文，避免分类路由后丢失所选 trial。

本次 api-agent 默认模型从 `gpt-5-mini` 改为 `gpt-5.6-terra`，保留 `AGENT_MODEL` 覆盖入口。该默认值来自本批配置调整；本次检查没有调用真实模型验证部署端可用性。临时的 intent 和完整 trial payload 调试日志已移除。

## 7. 侧栏、筛选与布局

### 侧栏数量

`list()` / `fetch()` 优先读取 `metadata.custom.trialCount`，没有该值时从 checkpoint 的 `pagination.total` 或 `results.length` 取得数量。Bridge 在已对齐的 settled 搜索更新后推送 `updateCustom`；adapter 读取并合并已有 `metadata.custom`。数量为 0 时不显示徽标。

### 筛选

- 年龄提供互斥的 Exact 与 Range 模式：只提交 `age`，或只提交 `min_age` / `max_age`。
- Range 滑块范围为 0–120，两个端点不能交叉；默认完整区间不发送年龄限制。
- 修改条件和排序通过同一次 `runSearch` 提交，避免第二次排序请求取消第一次条件请求；新搜索也使用表单选中的排序。
- 当前 chat run 进行中时禁用 Edit filters 的打开入口。

### Panel 与响应式

- `<768px`：overlay；`768–1279px`：compact；`>=1280px`：full。
- compact 下侧栏和 Trial Panel 互让，保留刚打开的面板；从 full 缩窄时若两者都已打开，优先保留 Trial Panel，避免两个 effect 同时关闭两边。
- 移动端 Trial Panel 宽度为 `min(92%, 30rem)`，不再使用桌面的 38% 分栏宽度。
- Panel 显示 hydration skeleton，统一横向 padding，卡片小字号改用 rem，问答菜单增加图标；州缩写保持大写，完整名称使用标题格式。
- Load more 位于列表底部，加载时在同位置显示 spinner，完成后显示下一页入口或已展示数量。
- chat-v2 页面顶部 padding 略缩小。

## 8. 已知边界与后续验证

1. 新会话尚无 remote id 时只能保留内存状态；首次消息创建远端 thread 后才可保存。此前离开或刷新页面仍可能丢失 Panel-only 编辑。
2. 读取 checkpoint 没有等待该 thread 的待完成保存。快速离开后返回，若保存仍在重试，可能先恢复到较旧的服务器快照；当前实现没有提供严格的 read-after-write 一致性。
3. Chat tool result 到 Panel state 的转换由当前可见 thread 的 Bridge 驱动。后台 thread 的结果可能要等切回后才反映到 `activeTrialSearch`；本次未新增后端主动投影 tool result 的逻辑。
4. 缺少 `lastAppliedToolCallId` 的旧快照不能可靠区分已处理的历史 tool result；没有历史数据回填或受污染 checkpoint 的自动修复。
5. 侧栏 `metadata.custom` 为读后合并写，没有跨客户端 CAS；缓存的数量也可能先于或落后于 checkpoint。
6. 原 `useIsMobile` 使用 `<=768px`，而布局 tier 和 Tailwind `md` 以 768px 起算桌面；精确 768px 的视觉行为仍应人工检查。
7. 年龄数字输入依赖 input 的范围属性，尚未增加提交时的完整数值校验；重叠滑块端点、键盘和触屏操作应在真实浏览器验证。
8. 没有执行真实 LangGraph/Postgres 并发写入、多标签页、刷新关闭页面或真实模型调用测试。

## 9. 验证记录

执行日期：2026-09-18。

| 检查 | 结果 |
| --- | --- |
| `npm test --workspace apps/web` | 11/11 通过 |
| 所有修改/新增 Web TS/TSX 文件的 ESLint | 通过（修正 TrialPanel JSX 引号后） |
| `npx tsc --noEmit -p apps/agent/tsconfig.json` | 通过 |
| `npx tsc --noEmit --incremental false -p apps/web/tsconfig.json` | 未通过：既有类型兼容问题，见下 |
| `git diff --check` | 通过 |

回归测试覆盖：条件与排序单请求、历史结果不覆盖后续编辑、B 的结果在 A 的 Provider 中被延迟、New Chat 不携带 A 的上下文、选择后完整结果恢复、A→B→C 的迟到 Panel 响应隔离、撤销选择、相同快照去重、永久保存失败后恢复、跨 thread 独立写入、旧 409 快照被新快照替代。

测试使用 mock runtime 和 React renderer，不能替代原生 sidebar 点击与真实后端端到端验证。测试输出包含 Vite CJS API 与 react-test-renderer 弃用提示，未影响断言。

Web 全量类型检查存在三处既有诊断，位于两处未修改文件：

- `apps/web/hooks/useVoiceInput.ts:32–33`：`SpeechRecognition` / `webkitSpeechRecognition` 的 Window 声明修饰符冲突。
- `apps/web/lib/types/prompts.ts:26`：ChatKit 的 `string | UserMessageContent[]` 不能直接赋给仅接收 `string` 的 starter prompt。

本次没有绕过这些类型错误，也没有将生产构建标记为通过。测试依赖通过 workspace package 和 lockfile 固定，后续可用 `npm ci` 和上述命令复查。
