# 已删除功能记录

这里记录删掉过的功能：当时是做什么的、怎么设计的、为什么删、代码在哪个提交里还能找回。
以后觉得“以前好像有这个功能”时，先查这里；需要时用文中的提交号把代码找回来参考。

找回代码的方法：`git show <提交号>:<文件路径>` 看单个文件，或 `git checkout <提交号> -- <文件路径>` 拿回来。

---

## 2026-11-06 旧的神经人格图谱浏览器界面，以及其他没人引用的前端文件（共 61 个）

**最后还在的提交：`03223ab`**

删了什么：
- `src/components/settings/` 里旧的神经人格图谱浏览器（47 个文件）：Pixi/SVG 两种画布（`NeuralPersonaGraphCanvas*`、`NeuralPersonaGraphPixiCanvas`、`NeuralPersonaGraphSvgCanvas`、`neuralPersonaGraphPixi*`）、物理模拟的 Web Worker（`neuralPersonaGraphPhysics.worker.ts`、`neuralPersonaGraphWorkerPhysics.ts`、`neuralPersonaGraphPhysicsWorkerProtocol.ts`）、力与碰撞滑杆、节点/连线样式、激活高亮、聚焦淡出、帧率、诊断开关、节点编辑草稿、框选批量删除面板（`NeuralPersonaNodeBatchDeletePanel.tsx`），以及“智能解析”把人设拆成节点的面板和 hook（`NeuralPersonaNodeGeneration*`、`useNeuralPersonaNodeGeneration*`）、`NeuralPersonaChatRuntimePanel.tsx`。
- MCP 打包版生产证据那一套（`settingsMcpPackaged*.ts`、`settingsMcpPolicyEvidence.ts`、`settingsMcpLifecycleHardeningEvidence.ts`，9 个文件），连同只用来跑它们的命令行脚本 `scripts/agent-mcp-packaged-{harness-comparison,production-evidence,production-report-builder,production-run-collector,production-run-plan,read-only-coverage}.ts`（不在 package.json 里，文档里也没提）。
- 其他零散的：`src/agent/agentChatContext.ts`、`src/agent/agentProductionSessionContract.ts`、`src/agent/chatContext/workingMemory.ts`、`src/agent/runtime/deepseekHarness{AdapterContract,RendererTransport}.ts`、`src/components/chat/agentRuntimeUiStatusProjection.ts`、`src/components/pet/animationTool{AudioPlaybackDisplay,AudioPlaybackProgress,PerformanceDisplay}.ts`、`src/components/pet/live2dRenderedVisualBounds.ts`、`src/components/settings/DesktopPetSlotSelector.tsx`。
- 只测这些文件的 14 个 smoke 和手动调试页 `scripts/harness/neural-persona-graph.{html,tsx}`。

为什么删：`36e766e`（2026-10-03，Obsidian 风格的记忆工作区 + 轻量图谱）替换了旧图谱界面，但旧文件没删；“智能解析”拆人设后来也确认是错误方向（人格锚点保持一份完整人设）。用 TypeScript 从 `src/main.tsx` 扫了一遍导入关系（静态 import、动态 `import()`、re-export、`import.meta.glob`、`new Worker(new URL(...))` 都算），再查了 `electron/` 和 package.json 里所有脚本，这 61 个文件都没有任何地方在用。

保留并继续用的：`src/services/` 下的 `neuralPersonaConfiguredModelAbExecutor.ts`、`neuralPersonaConfiguredNodeGenerationProvider.ts`、`neuralPersonaGeneratedNodeRelationshipAnalysis.ts`、`neuralPersonaNodeGenerationBatchRecovery.ts`。应用里虽然没用到，但 package.json 的回复质量 A/B 跑分脚本和几个 smoke 还在用。`src/character-graph/neural-persona/` 里的图谱数据、布局、物理计算没动。同时测了旧界面和现用代码的 smoke（图谱浏览器、批量删除、节点生成、桌宠槽位、动画音频、MCP 进度总览等）只删了测旧文件的那部分，其余照旧在测。`scripts/projectModuleSource.mjs` 里 `agentChatContext.ts` 那一条也去掉了。

---

## 2026-11-06 群体记忆 / 关系的“上线前审核”层，以及群聊系统页的四个空开关

**最后还在的提交：`b6b8b15`**

删了什么（用户 11-06 看过评估后同意）：
- `src/group-memory/` 里“自动写入准备度”那一整套：准备度评估、对比、审核回执、审核历史、趋势、趋势审批、人工放行审核、回滚演练清单、影子语料导入和模板、候选影子评估，以及它们的导入导出（21 个文件）。
- `src/social-trend/`（关系证据影子报告、证据窗口、社交趋势）、`src/social-timeline/`（社交事件时间线）、`src/social-group/`（小团体候选），整目录。
- `src/character-relationship/directedRelationshipShadowReport.ts`。
- 设置里对应的约 90 个面板和下载按钮，以及只测这些东西的 29 个 smoke。
- 群聊系统页“社会 Agent 开关”的四个开关（多人并行生成、自动长期记忆、自动关系演化、自动小团体演化）：代码里没有任何地方读它们，开关本身不起作用；配置字段一并去掉。

为什么删：这是为“将来让系统自动写群体记忆、自动改关系”准备的一套分阶段上线审核流程，但底下的数据一直是空的（群体记忆 0 条，关系 0 条，12 条关系候选没人审），这套审核也从没用过。关系现在由角色自己按人设决定（`src/character-cognition/useRelationshipSelfReview.ts`），不需要这层审核。

保留并继续用的：群体记忆的存储、冲突检查、候选、小组、证据范围修正、归档；消息气泡上的“存到群体记忆”按钮；群聊每轮把群体记忆和角色关系读进提示词的那条路；关系的存储、编辑、时间线、候选收件箱。

---

## 2026-11-06 旧的“主动陪伴”随机定时器（固定草稿、英文提示、调试面板）

**最后还在的提交：`c404006`**（`src/hooks/useLifeCompanionScheduler.ts`；`src/life-companion/` 下的 `lifeCompanionRuntimeScheduler.ts`、`lifeCompanionInteractionRunner.ts`、`lifeCompanionTextPromptPublisher.ts`、`lifeCompanionLlmPrompt.ts`、`lifeCompanionLlmPromptController.ts`、`lifeCompanionLlmBackoff.ts`、`lifeCompanionRuntimeStatus.ts`、`lifeCompanionGrowthStatus.ts`；设置页的 `SettingsLifeCompanionFields.tsx`、`SettingsLifeCompanionRuntimeStatusRow.tsx`、`SettingsLifeCompanionRuntimeControls.tsx`、`SettingsLifeCompanionGrowthStatusRow.tsx`）

旧做法：开了“主动”和“随机”两个开关后，按 30–180 分钟的随机间隔触发一次；用饥饿、好感这类数值挑一句固定草稿（“X好像有点饿了，要不要陪我聊聊吃点什么？”），可选再用一段英文任务说明让模型改写一句；失败有退避；设置页里是一排英文调试按钮（Proactive / Random / Text prompt / LLM prompt / 冷却分钟数）和运行状态行。

为什么删：这正是“主动说话像 AI”的原因（2026-10-21 记录）：动机是数值、提示是英文、没有具体缘由。改成认知层第二步：角色心里惦记的事攒够了才开口，用她自己的人设和最近的私聊写这句话，频率按用户定的上限（`src/character-cognition/proactiveSpeechRules.ts`），设置里只剩一个“主动找你聊天”开关和状态说明。安静时段判断（`isLifeCompanionQuietHour`）、手动暂停（`lifeCompanionRuntimeOverride.ts`）保留继续用；旧设置里的随机间隔、冷却等字段读配置时直接丢弃。

---

## 2026-11-06 旧的任务结果展示模块（审批卡、运行轨迹、阶段创建、角色转述）

**最后还在的提交：`99a5fc1`**（文件都在 `src/components/chat/runController/` 下：`conversationApprovalCard.ts`、`sessionMessageProjection.ts`、`sessionVisibleText.ts`、`personaText.ts`、`runTraceCreation.ts`、`workStageCreation.ts`）

做什么的：旧 Agent 路线和对话循环早期版本用来在聊天里贴一张“需要你同意”的审批卡、生成任务阶段和运行轨迹、把内部结果改写成角色口吻的那一套。

为什么删：`0609b19`（一个任务一张卡）之后，审批和步骤都改由 `conversationTaskCard.ts` 显示，这 6 个文件已经没有任何地方在用，只剩一个测试还在测它们。还在用的部分（执行回执、停止时把未完成步骤标成已停止）保留，测试也改成只测这些。

---

## 2026-10-19 主桌宠的“随机瞟一眼”（固定看右上方）

**最后还在的提交：`04cb10b`**（文件 `src/pet-runtime/core/useMainPetVisionController.ts`）

做什么的：主桌宠站着不动时，每 10 秒有 30% 的概率把视线目标设成固定点 (200, -150)（右上方），3 秒后清掉，想做成“偶尔看看别处”。

为什么删：它不看任何真实的东西，只是固定往右上看，用户看到的是角色“突然往右上方看”。Live2D 之前已经单独屏蔽了它；3D 还在用，所以 3D 也出现同样的问题。删掉后视线只跟着真实的东西走（鼠标追踪开着时跟鼠标、走动时看前进方向、摸头等互动时看互动位置）。`visionTarget` 这条数据线还在（一直为空），以后真要做“看向某处”可以接回去。

---

## 2026-10-19 旧的互动对话舞台（桌宠挪到屏幕中间 + 全屏暗色遮罩）

**最后还在的提交：`c12e39a`**（删除提交见本文件所在提交）

旧做法：打开互动对话时，把桌宠放大并挪到屏幕中间的“舞台”位置，在整个桌面上盖一层径向暗色遮罩（`src/components/pet/PetInteractiveDialogueOverlay.tsx`），聊天窗口另开成一条 960×300 的横条摆在角色下面（`INTERACTIVE_CHAT_PANEL_WINDOW_BOUNDS`）。两个窗口靠计算对齐，换屏幕、缩放、模型大小一变就对不上，一直没做出想要的效果。

为什么删：改成在聊天窗口里直接画角色（`src/components/chat/interactive/InteractiveDialogueView.tsx`），布局完全自己控制。遮罩组件已删；桌宠端算舞台位置的代码（`usePetContainerPanelLayout.ts` 里的 interactiveDialogue* 尺寸和位置）暂时还在但已不再用来挪桌宠，之后清理。

---

## 2026-10-11 技能包系统（.skillpkg 签名包、沙箱、市场）

**最后还在的提交：`8eb1e69`**（删除提交见本文件所在提交）

**它是做什么的**：一套“可执行技能包”的完整基础设施——比你现在用的 SKILL.md 说明书技能更进一步，技能包里可以带真正会运行的代码（WASM），由桌宠在隔离沙箱里执行。

**当时的设计**（按模块）：
- **签名与信任**：技能包要用 Ed25519 签名；设置里可以导入“受信任发布者”的公钥；换密钥要新旧两把钥匙双签迁移；支持吊销、过期、重放检测。
- **安装与生命周期**：从 ZIP 安装签名包、更新、降级拒绝、卸载（留不可变快照，可回滚）、隔离（连续 3 次出错自动隔离）、恢复、快照清理（每个包最多留 5 份、30 天）。
- **沙箱执行**：主进程起独立的监督进程运行 WASM（只允许纯计算的 `wasm-pure-i32-v1` / `wasm-pure-json-v1` 两种格式，不能导入外部函数）；限时、可取消。
- **能力授权**：技能包要用某个能力（如读存储）必须申请，用户授权后记录在案；授权可撤销；每次调用留“回执”（最多 200 条）；读存储限速 20 次/60 秒。
- **健康与诊断**：每个包的健康状态、出错退避（1 秒/2 秒）、诊断报告导出（脱敏）。
- **市场**：发布者目录（根密钥签名）、HTTPS 下发、发布准入报告、生产环境配置检查；`npm run dist:win:production` 会把市场的根密钥和下发配置打进安装包。
- **设置界面**：技能页底部“内置能力与高级设置”里约 40 个面板，展示以上各环节的预览、预检、演练结果。

**为什么删**：这套系统做到了“能安全地装和检查”，但**从来没有真正执行过任何技能**——设置里看到的都是预览和演练，对话里的角色也调用不到它。市场一直是关闭状态，根密钥表是空的。你实际在用的是 SKILL.md 说明书技能（现在 7 个视频技能），它们不需要这套东西。

**删了什么**（共 195 个文件，约 2.5 万行）：
- 页面端 106 个：`src/agent/agentSkill*`（Installed、External、Marketplace、Package、Signed、Manifest、Registry、Definitions、AuthoringScaffold、DirectoryOrdering、InstallValidation 等）和 `src/components/settings/SettingsAgentSkill*` 面板及对应的 `useSettingsAgentSkill*`
- 主进程 23 个：`electron/externalSkill*.cjs`（沙箱监督、能力网关、生命周期、归档安装、健康、发布准入、市场目录/身份/下发/生产检查、打包探针）、`electron/skillPackage*.cjs`、`electron/marketplaceCatalog*.json`
- 主进程接口：28 个 IPC 通道和对应的 preload 函数及类型声明
- 打包：`dist:win:production`、`check:marketplace-production-config`、`bootstrap:marketplace:first-publisher` 三个命令，和打包脚本里放市场资源的步骤
- 66 个只测这些代码的测试脚本（`scripts/agent-skill-*`、`scripts/marketplace-*`）

**保留下来的**：SKILL.md / ZIP 技能导入、给角色启用/停用、卸载；对话里的 `skills` 工具（读取说明、按说明产出）。

**以后如果需要**：想让技能“真正跑代码”时，可以回到 `8eb1e69` 参考这套设计，尤其是签名信任、能力授权和沙箱三块。

---

## 2026-10-11 旧的 8 个“内置技能”和内置 MCP 平台服务

**最后还在的提交：`8eb1e69`**

**它是做什么的**：旧 Agent 时代的“技能”：角色动画、桌面观察、游戏陪玩、本地文件、记忆、语音控制、MCP 工具、能力路由。每个只是一张“遇到这类请求优先用哪些工具”的表；“运行”它只会返回推荐的工具名，不会做事（角色动画那个默认也是演练）。另有一个内置的 MCP 服务器“AI Desktop Pet Platform”，把这些技能的列出/运行/清单/脚手架包装成 MCP 工具。

**为什么删**：对话循环已经直接给了角色这些工具（看屏幕、文件、语音、游戏陪玩、MCP、做动作），这些表在技能列表里只会干扰角色挑选。

**保留下来的**：角色动画时间线（设置里的技能时间线编辑器还在用 `runCharacterAnimationSkill`）。

---

## 2026-10-11 旧 Agent 运行时

**最后还在的提交：`058e039`**（删除提交：`67e4d16`、`4129d78`）

**它是做什么的**：对话循环之前的“办事”架构：每条消息先调用一次 AI 判断是聊天还是办事 → 规划器拆步骤 → 生产会话按步骤执行（v2/v3/v4 几代运行时）→ 审批后续跑。

**为什么删**：私聊、群聊、图片消息、Gemini 都已改走对话循环（一个循环、一个决策者），旧路线只是并行留着的兼容开关，删前已把开关去掉。

**删了什么**：192 个源码文件（约 3.6 万行）和 334 个只测旧代码的测试，合计约 9 万行；去掉“旧版办事流程”“桌面操作新版循环”两个设置开关。

**保留下来的**：所有工具的实际实现（看窗口、点击、输入、文件、浏览器、命令、MCP 调用等）、DeepSeek Harness、神经人格图谱、MCP 证据工具。

---

## 2026-10-10 没人引用的文件

**删除提交：`e8fca56`**（找回用 `e8fca56^`）

21 个已经没有任何地方引用的文件（约 940 行），属于早先重构留下的残留。

## 2026-10-31 设置 → 扩展 的导航收拢进插件市场

**没有删代码，只是导航里不再显示**（`settingsControlCenterNavigation.ts` 里的 `hidden: true`）。扩展下只剩 插件市场 / 人格分享 / 资源包。

| 原来的导航页 | 现在在哪 |
|---|---|
| QQ 连接 | 插件市场 → QQ 连接（插件页里就是原来的全部设置） |
| 工作流管理（ComfyUI） | 插件市场 → ComfyUI 画图 |
| 开发助手 | 插件市场 → 开发助手（新增为内置插件） |
| Skills | 插件市场（已装技能、安装技能文件都在这里） |
| MCP 管理 | 插件市场 → 各 MCP 插件页 / “添加 MCP 工具” |
| 扩展总览、外部接入、DeepSeek Harness | 都是“规划中”的空页面，去掉 |

所有跳到这些旧页面的链接（体检、角色提示、聊天窗口）会自动打开插件市场，有对应插件时直接打开那个插件的页面（`resolveSettingsPageRoute`）。要恢复某一页：把它的 `hidden: true` 去掉。

---

## 2026-11-03 确认卡上的“这次都允许”

**最后还在的提交：`576edf6`**（`src/components/chat/message/AgentLoopRunPanel.tsx`、`src/components/chat/PetStatusBubbleCard.tsx`、`src/components/chat/runController/approvalDecisionText.ts`、测试 `scripts/approval-allow-task-smoke.ts`）

- **当时是做什么的**：她要你同意某一步时，任务卡和模型头上的气泡里除了“允许 / 今天都允许 / 不要”，还有“这次都允许”：这个任务后面的步骤都不再问，下一个任务重新问。说 / 打 / 在 QQ 回“都好”“别问了”也算。
- **为什么删**：用户觉得和“今天都允许”重复（2026-11-03）。只留“今天都允许”。
- **现在怎么样**：按钮去掉了；“都好”“都允许”“别问了”“不用再问了”“这次都允许”这些说法现在都算“今天都允许”。QQ / 微信的提问只给“好 / 今天都好 / 不要”。发送、删除、付款、关闭程序这类撤不回的照样每次都问；拒绝一次今天的授权就失效，这些都没变。

## 2026-11-05 互动对话的桌面“舞台模式”

**最后还在的提交：`3491229`**（舞台框 `createInteractiveDialogueStageFrame` 最后在 `8c68f25`；涉及 `src/components/pet/` 下的 `usePetContainerPanelLayout.ts`、`petVisualRendererSurface.ts`、`petAvatarRuntimeSurface.ts`、`petLayerOrdering.ts`、`petContainerLayerSurface.ts`、`petContainerRenderProps.ts`、`PetAvatarLayer.tsx`、`PetCompanionLayer.tsx`、`CompanionPetRuntimeLayer.tsx`，以及 `PetContainer.tsx` 和 `src/index.css`）

- **当时是做什么的**：互动对话第一版把角色画在桌面上：开始通话时桌宠从屏幕下方升到一个“舞台”位置并放大（`isInteractiveDialogueMode`、`interactiveDialoguePosition`、`interactiveDialogueShellSize`、舞台框 `interactiveDialogueStageFrame`），这时不能拖动、不能滚轮缩放，层级放到最上面（z 28），3D 模型用特写镜头；配一个从下往上的入场动画 `pet-interactive-dialogue-enter`。
- **为什么删**：10-19 起互动对话把角色画在聊天窗口里，桌面上这个模式被写死成“不进入”，这一整条从布局传到三个桌宠图层的值和分支再也没走到过。
- **现在怎么样**：界面和行为都不变。保留的：通话时桌面上同一个角色隐藏、暂停自动走动（`isInteractiveDialogueActive` / `isInteractiveDialogueHidden`）；网页版聊天面板在互动模式下的位置；状态气泡的位置；3D 渲染器自己的“特写”呈现模式（`presentationMode: 'interactive-dialogue'`，Unity 桥协议里也有，以后在聊天窗口里做口型和表情时可能用到）。测试 `scripts/interactive-dialogue-isolation-smoke.ts` 改成检查现在的设计（它从 10-19 起就在检查旧设计、一直是失败的）。
