<div align="center">
  <img src="build/icon.png" alt="AI Pets Hub 项目图标" width="148" />
  <h1>AI Pets Hub</h1>
  <p><strong>让 AI 角色住进桌面，让 Agent 能力连接真实环境。</strong></p>
  <p>Windows 桌面 AI 角色与 Agent 平台</p>
  <p>
    <strong>简体中文</strong> · <a href="./README.md">English</a>
  </p>
  <p>
    <img src="https://img.shields.io/badge/Platform-Windows-0078D4?logo=windows&logoColor=white" alt="Platform: Windows" />
    <img src="https://img.shields.io/badge/Electron-37-47848F?logo=electron&logoColor=white" alt="Electron 37" />
    <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black" alt="React 19" />
    <a href="./LICENSE"><img src="https://img.shields.io/badge/Source%20License-Apache--2.0-blue" alt="Source license: Apache-2.0" /></a>
  </p>
  <p><a href="https://github.com/JingXuan-Zun/AI-Pets-Hub-public/releases/latest">⬇️ 下载 Windows 预览版</a></p>
</div>

<p align="center">
  <a href="#功能速览">✨ 功能速览</a> ·
  <a href="#快速开始">🚀 快速开始</a> ·
  <a href="#项目状态">📊 项目状态</a>
</p>

## ✨ 功能速览

- 🐾 **桌面 AI 角色** — 在 Windows 桌面运行 2D、Live2D 或 3D 角色；运行时包含表情、动作、注视和交互支持。角色模型与素材需自行准备并确认授权。
- 💬 **AI 角色聊天** — 配置模型服务后，可在桌面应用中与角色对话，并管理角色和聊天相关设置。
- 🧠 **角色记忆与人格** — 角色 / 群体记忆、Neural Persona 图谱、关系和社交上下文，为持续互动提供不同类型的上下文基础；接入程度仍在推进。
- 👥 **多角色与群体互动** — 群体主题、共享记忆、角色关系和社交时间线等模块，支持探索多角色共处的互动方式。
- 🛠️ **Agent 工具执行** — Agent Runtime 负责规划和调用已注册工具，并提供权限检查、结果评估与恢复相关流程；端到端执行仍在验证。
- 🖥️ **Windows 桌面操作** — 通过屏幕 / 窗口观察、鼠标键盘输入、应用启动和本地文件工具与桌面交互；效果取决于系统环境和集成状态。
- 🔌 **MCP 与 Skill 扩展** — 连接外部 MCP 工具服务、管理 Skill 包；策略、信任和沙箱基础设施正在完善。
- 🔊 **语音与角色表现** — 提供本地语音运行时、TTS / Browser TTS 及表情表现相关模块；具体语音服务需要自行配置。
- 🧩 **运行时集成** — 包含 Unity Bridge、DeepSeek Harness Bridge 和 ComfyUI Workflow 设置入口，供扩展不同运行环境与工作流。

> **当前阶段：** 早期开源，部分能力仍在集成；各子系统状态见[项目状态](#项目状态)。

> [!IMPORTANT]
> Apache-2.0 适用于项目源码；应用图标中的角色插画不包含在该许可范围内。公开仓库不提供可自由再分发的角色模型、动画或语音素材库。请先阅读[素材授权说明](./ASSET_LICENSES.md)和[公开仓库边界](./PUBLIC_EXPORT.md)。

<details>
<summary>📚 目录</summary>

- [项目目标](#项目目标)
- [功能速览](#功能速览)
- [核心系统](#核心系统)
  - [Agent Runtime](#agent-runtime)
  - [Windows Computer Use](#windows-computer-use)
  - [角色、记忆与群体互动](#角色记忆与群体互动)
  - [桌宠与角色表现](#桌宠与角色表现)
  - [MCP、Skill 与外部集成](#mcpskill-与外部集成)
- [架构与技术栈](#架构与技术栈)
- [快速开始](#快速开始)
- [项目状态](#项目状态)
- [许可证与素材](#许可证与素材)
- [贡献与反馈](#贡献与反馈)

</details>

## 🧭 项目目标

大多数 AI 陪伴应用把交互收敛在一段聊天里。AI Pets Hub 探索另一种桌面形态：角色可以拥有持续的上下文和视觉表现；Agent 可以在权限与运行时边界内调用工具；多个角色可以共享群体活动和关系状态。

```text
角色与对话 ── 记忆 / 人格 / 关系
     │                 │
     └──── Agent Runtime ──── 工具 / MCP / Computer Use
                    │
           桌面、语音与角色表现
```

项目将这些能力作为可组合的系统来建设。目标是逐步形成一个可以扩展的 AI Runtime World，而不是把所有能力塞进单一聊天流程。这个方向仍在实现中，具体可用性以当前代码和项目状态为准。

## 🧩 核心系统

### 🤖 Agent Runtime

项目包含自研的 TypeScript Agent Runtime。源码中可以看到从会话入口、上下文与规划，到工具执行、结果评估及后续处理的多个阶段：

```text
请求 / 会话
    ↓
上下文与规划
    ↓
权限与执行前检查
    ↓
工具注册与执行
    ↓
观察、证据与结果评估
    ↓
验证、恢复或重新规划
```

设计上会区分“工具调用返回成功”和“用户要求的目标状态已达成”。例如，启动程序的命令成功返回，并不能单独证明正确的窗口已打开。因此代码中还包含窗口 / 视觉目标验证、Action Evidence、结果评估以及恢复和重新规划相关模块。

Runtime 还包含工具 schema、权限路由、执行生命周期控制等组件。相关模块正在演进；不同 Agent 入口是否走完整链路，需结合具体功能判断。源码入口示例：`src/agent/agentOrchestrator.ts`、`src/agent/agentPlanner.ts`、`src/agent/agentToolRegistry.ts`、`src/agent/agentRuntimeExecutor.ts`。

#### Agent 执行链中的关注点

- **工具注册与输入约束：** 工具通过统一注册表提供描述和输入 schema，供运行时选择与派发。
- **权限与策略：** 执行前检查由权限路由和策略组件参与，避免把模型输出直接当作可信的系统命令。
- **桌面观察：** 屏幕和窗口相关工具提供执行前后的环境信息；目标解析与视觉验证用于确认交互对象和结果。
- **证据与评估：** 结果评估模块结合工具结果及观察信息判断是否达到预期，而不只看进程返回码。
- **失败处理：** Runtime 中有取消、超时、恢复、跟进和重新规划相关路径，具体行为取决于入口和执行器。

常见入口和实现分布在 `src/agent/` 与 `src/agent/runtime/`。仓库里的架构模块仍处于重构与集成阶段，因此这份流程图表示设计和代码组成，不代表每条用户请求都会经过完全相同的步骤。

### 🖥️ Windows Computer Use

桌面操作能力围绕观察、定位、执行和确认组织。仓库包含屏幕捕获、区域与窗口处理、桌面输入、应用启动、本地文件操作和视觉目标验证等代码路径。

```text
观察桌面 → 确定目标 → 检查权限 → 执行动作
    ↑                                  ↓
    └──── 验证结果 ← 收集证据 ← 再次观察
                         └→ 恢复 / 重新规划
```

这些能力让 Agent 有机会与本地桌面环境交互，也意味着运行时需要处理权限、取消、失败和不确定结果。实际行为依赖 Windows 会话、目标应用及当前集成状态；不要把它理解为对任意桌面任务的保证。

### 🧠 角色、记忆与群体互动

项目的记忆相关代码不只包括聊天历史，也包含角色记忆、群体记忆、知识 / 检索接口，以及神经人格图谱、关系状态和社交时间线等子系统。设计方向是让较长期的上下文能够影响后续互动，并为角色之间的群体状态提供独立结构。

群体相关模块包括群体主题、群体记忆、关系策略、社交事件和趋势等。它们仍在持续接合：某一项基础设施存在，不代表它已经贯穿所有对话、自动学习或角色行为流程。

#### Neural Persona 包含什么

`src/character-graph/neural-persona/` 下的代码覆盖人格节点及层级、节点生成、图谱布局与浏览、关系分析、语义检索和标签等功能，也包含反馈账本、学习提案、应用 / 撤销和持久化路径。代码还为 Provider 数据策略及回复质量 A/B 流程提供模块。

设计目标是将角色长期信息组织成可以浏览和维护的结构。它目前仍在接入认知与对话流程；不要把图谱模块存在等同于自动记忆已完整启用。

#### 群体互动包含什么

群体相关模块除了群聊入口，还涉及群体主题、共享记忆、社交群组、有向角色关系、关系行为策略、社交时间线与趋势。群体记忆侧还包含冲突检测、证据范围、审核和 readiness 相关逻辑。长期方向是让这些状态参与后续互动；当前仍在验证各模块之间的连接和一致性。

### 🎭 桌宠与角色表现

- **2D / Live2D：** 包含模型加载、Cubism Core 接入、表情发现与绑定、指针注视和交互控制等运行时模块。
- **3D / VRM：** 使用 Three.js / React Three Fiber，包含 VRM 加载、场景挂载、表情与注视控制、动作和反应相关模块。
- **Unity Bridge：** 仓库中有 Unity Runtime / Bridge 相关服务与协议代码，可作为另一种运行时连接路径。

上述模块是运行时能力，不意味着仓库附带了可自由再分发的模型、动作、贴图或语音素材。请先核对素材来源与许可。

运行时内部也有不同职责：Live2D 侧包含 Runtime Profile、Cubism Core Loader、表情发现 / 绑定、表现优先级、指针注视与交互控制；3D / VRM 侧包含资产加载、场景挂载、表情和 Look-at 控制、拖动状态、外部动作片段与反应运行时。Unity Bridge 则提供服务和协议层的连接代码。

### ✨ Expression 与 Life Companion

**Expression Library** 管理表情类别、资源导入与变更、审核队列、设置、语义信息和系统资源目录；回复表达式 Runtime 用于把 AI 回复与角色表现连接起来。表现资源的来源及授权仍需逐项确认。

**Life Companion** 是角色持续状态和主动互动方向的基础设施，源码中可见 Affection、Hunger、Mood、启动问候、主动 / 随机互动、桌面活动感知、安静时段、调度器与成长控制等模块。它们的具体触发受设置、时间窗口和冷却条件约束，仍在逐步接入角色行为。

### 🔌 MCP、Skill 与外部集成

**MCP：** 仓库包含服务配置、Stdio 客户端、会话池、工具调用、健康诊断、参数校验、策略和取消等相关模块。Agent 侧也有外部 MCP 桥接与策略相关代码。

此外还包含 Server 兼容性、环境预检、调用历史、soak / readiness 检查，以及风险摘要和执行回执等实现。第三方 Server 的行为与兼容性由其自身决定，运行时仍需处理连接错误和工具参数校验。

**Skill / 扩展：** 源码包含 Skill Registry、包导入与安装、生命周期、运行策略、信任证据、签名校验、更新 / 回滚以及沙箱相关基础设施。外部扩展生态和 Marketplace 发布流程仍在开发验证中。

Skill 的设计目标是通过 Manifest 和包元数据描述扩展，再由宿主执行范围、信任信息、权限授权及沙箱边界控制运行。仓库中的签名、更新、回滚和 Marketplace readiness 组件说明正在建设完整生命周期；它们不代表已建立成熟的第三方发布市场。

**其他集成：** 仓库还包含本地语音运行时、DeepSeek Harness Bridge，以及 ComfyUI Workflow 设置入口等代码。它们可能需要用户自行安装外部软件或配置服务凭据；设置入口不代表完整工作流已稳定可用。

### 🔊 语音与其他集成

语音代码包含本地语音运行时、语音库、TTS / Browser TTS、语音工具、音频缓存与后台 Worker 等部分。可用服务取决于本地环境和配置，仓库不会替用户提供云服务凭据或所有后端依赖。

DeepSeek Harness 相关实现包含 Runtime Service、进程运行器、Capability Bridge / Plugin、Profile 与 Runtime Adapter。ComfyUI 目前主要体现为 Workflow 设置入口和集成方向。这些能力可能需要额外运行环境或凭据，成熟度也各不相同。

### 🗂️ 项目目录导航

```text
electron/                 Electron 主进程服务与桌面集成
src/agent/                Agent 会话、规划、工具、执行与验证
src/pet-runtime/          2D / Live2D / 3D 角色运行时
src/social-group/         群体交互基础类型与投影
src/social-timeline/      社交事件时间线
src/social-trend/         关系趋势与证据相关逻辑
src/character-graph/      角色图谱与 Neural Persona
src/voice/                Renderer 侧语音与播放逻辑
docs/                     中英文项目介绍与维护说明
scripts/                  冒烟检查、构建和维护脚本
```

目录只是入口索引，不保证每个目录都代表已集成的产品功能。更详细的模块列表见[项目介绍](./docs/project-overview.zh-CN.md)。

## 🏗️ 架构与技术栈

项目由 Electron 桌面宿主和 React / TypeScript Renderer 组成。主进程承担窗口与 IPC、桌面捕获、文件访问、应用启动及部分运行时服务；Renderer 包含聊天、角色界面、记忆与人格界面、扩展控制和角色表现层。Agent、记忆、关系、表达和 Runtime World 等逻辑分布在相应模块中。

```text
Electron 主进程                 React / TypeScript Renderer
窗口与 IPC                      聊天、角色与设置界面
文件 / 桌面输入 / 屏幕捕获       Live2D / 3D 角色表现
语音 / MCP / Skill 服务           记忆、人格、群体与 Agent UI
          └────────── IPC / Runtime Bridge ──────────┘
                               │
                      Core Runtime Modules
             Agent · Memory · Cognition · Social · Pet
```

主要依赖与技术：

- Electron 37、Electron Builder
- React 19、TypeScript 5.8、Vite 6
- Three.js、React Three Fiber、`@pixiv/three-vrm`
- PixiJS 6、`pixi-live2d-display`
- 自研 TypeScript Agent 与 MCP Runtime 组件

准确依赖范围请以 [`package.json`](./package.json) 和 [`package-lock.json`](./package-lock.json) 为准。更完整的结构说明见[中文项目介绍](./docs/project-overview.zh-CN.md)。

## 🚀 快速开始

### 环境要求

- Windows 桌面环境
- Node.js、npm 与 Git
- 模型对话功能需要用户自行准备并配置兼容的模型服务凭据

仓库没有在 README 中承诺一个已验证的最低 Node.js 版本；请按当前依赖及安装报错选择兼容版本。桌面捕获、输入和部分集成依赖 Windows 环境。

### 克隆、安装和启动

```powershell
git clone https://github.com/JingXuan-Zun/AI-Pets-Hub-public.git
cd AI-Pets-Hub
npm ci
npm run desktop
```

`npm run desktop` 会先构建 Renderer，再启动 Electron。仅开发 Renderer 界面时，可运行：

```powershell
npm run dev
```

### 常用命令

```powershell
npm run lint            # TypeScript 类型检查
npm run build           # 构建 Renderer
npm run smoke:agent:p0  # Agent 核心冒烟检查
npm run dist:win        # Windows 分发构建流程
```

项目还提供按 Agent、Neural Persona、MCP、Skill 和桌面运行时划分的检查 / smoke 脚本，名称及参数以 [`package.json`](./package.json) 为准。启动后需要在应用内配置模型服务；不要把真实密钥写入仓库或提交到 Git。

## 🚧 项目状态

下表区分“代码基础已存在”和“端到端流程正在集成”。这里不使用一个笼统的“完成”标签，是因为同一子系统的模块成熟度可能不同。

| 子系统 | 当前实现范围 | 状态说明 |
| --- | --- | --- |
| Electron 桌面宿主 | 窗口、IPC、桌面捕获、输入、应用启动 | 已形成桌面基础；具体工具受 Windows 环境影响 |
| Chat 与角色界面 | 聊天、角色设置、模型配置相关界面 | 基础链路存在，依赖用户配置模型服务 |
| Agent Runtime | 会话、规划、工具注册、权限路由、执行与结果评估 | 核心模块存在，生产执行路径持续重构 / 验证 |
| Computer Use | 屏幕与窗口观察、目标处理、输入和验证 | 端到端可靠性仍在验证 |
| Memory / Knowledge | 角色与群体记忆、知识和检索相关接口 | 子系统接入程度不一 |
| Neural Persona | 人格节点、图谱、关系、反馈与持久化 | 数据与图谱基础存在，认知 / 对话接合持续开发 |
| Multi-Agent / Social | 群体主题、群体记忆、关系、时间线和趋势 | 多角色行为的一致性仍在验证 |
| 2D / Live2D | Cubism 加载、表情绑定、指针注视和交互 | 运行时基础存在；素材不随 README 中的代码说明授权 |
| 3D / VRM | Three.js 场景、VRM 加载、表情、注视和动作模块 | 运行时基础存在，依赖用户提供兼容资产 |
| Unity Bridge | Unity Runtime / Bridge 服务与协议 | 连接路径代码存在，具体集成需对应 Unity 端 |
| Life Companion | 情绪 / 好感、主动互动、安静时段与桌面感知 | 部分行为受设置和调度控制，仍在接合 |
| MCP | 配置、Stdio、会话池、诊断、策略与参数校验 | 宿主基础设施存在，第三方兼容性有差异 |
| Skill / Sandbox | 包导入、信任、签名、策略和沙箱组件 | 生态和分发流程仍在验证 |
| Voice | 本地语音、TTS / Browser TTS、播放与缓存 | 依赖外部服务或本地后端配置 |
| DeepSeek Harness | Runtime Service、Runner、Capability Bridge | 集成方向已在代码中，仍需要外部运行环境 |
| ComfyUI | Workflow 设置入口 | 入口存在不代表生成链路已完整稳定 |

这是基于仓库源码结构整理的项目状态，不是发布质量或安全性的认证。功能可能变化，部分路径尚不完整。

### 当前开发重点

- 稳定 Agent 会话、执行、观察、验证与恢复之间的端到端链路。
- 逐步连接 Neural Persona、长期上下文、角色关系与实际对话行为。
- 验证群体记忆、关系状态和多角色交互在统一运行时中的表现。
- 完善 Skill / 扩展的信任、沙箱、分发和维护流程。
- 改进公开开发者文档与跨模块集成检查。

不要仅凭源码里出现某个模块，就推断该能力已经在所有应用入口中启用或稳定。

## 📄 许可证与素材

- 项目源码采用 [Apache License 2.0](./LICENSE)。
- 应用图标中的角色插画由创作者保留权利，**不包含在 Apache-2.0 授权范围内**；请阅读 [ASSET_LICENSES.md](./ASSET_LICENSES.md)。
- 第三方依赖、用户提供的角色模型 / 动画 / 音频及其他素材仍受各自许可约束。
- 公开导出内容的范围与检查提示见 [PUBLIC_EXPORT.md](./PUBLIC_EXPORT.md)。

请在复制、修改或重新分发源码、构建产物和素材前，分别确认适用的许可范围。

## 🤝 贡献与反馈

贡献或发布前，请先按[隐私检查流程](./docs/PUBLIC_PRIVACY_WORKFLOW.md)处理本机数据和提交邮箱。

欢迎通过 Issue 反馈问题或提交 Pull Request。较大的架构改动可以先开 Issue 讨论。报告问题时请尽量附上：

- Windows 版本及项目 commit / release 版本
- 复现步骤、预期结果和实际结果
- 相关日志或截图（先删除 API Key、Token、Cookie、个人路径和用户数据）
- 如涉及 Agent，附任务描述、工具调用过程和可分享的验证结果

安全问题请使用仓库启用时提供的 GitHub 私密漏洞报告；在维护者响应前，不要在公开 Issue 发布可利用细节。

---

完整的子系统清单、开发与检查脚本以及项目路线方向见[中文项目介绍](./docs/project-overview.zh-CN.md)。
