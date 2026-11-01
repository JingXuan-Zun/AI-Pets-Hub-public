# 插件格式（plugin.json，第 1 版）

一个插件就是一个文件夹。桌宠在 设置 → 扩展 → 插件市场 里可以：

- **从文件夹安装**：选中插件文件夹；
- **从 GitHub 安装**：贴仓库链接 `https://github.com/作者/仓库`，仓库里有多个插件时贴文件夹链接 `https://github.com/作者/仓库/tree/main/插件文件夹`。

装好的插件放在桌宠数据目录的 `plugins/<id>/` 下。重装同一个 id 会覆盖，上一个版本留在 `plugins/.previous/<id>/`。

## 两种插件

| kind | 是什么 | 文件夹里要有 |
|---|---|---|
| `skill` | 技能：一份写给角色看的说明（怎么教画画、怎么写周报……），不运行代码 | `SKILL.md` |
| `mcp` | 工具服务器：一个 [MCP](https://modelcontextprotocol.io) 程序，任何语言都可以写，角色通过它调用工具 | 启动它需要的文件 |

**只有 `SKILL.md`、没有 `plugin.json` 的文件夹也能直接装**（为 Claude Code 等工具写的技能原样可用）：名字和说明取自 SKILL.md 开头的 `name` / `description`。

## plugin.json

```json
{
  "id": "drawing-teacher",
  "name": "绘画老师",
  "version": "1.0.0",
  "description": "二次元 + 韩系半厚涂的绘画老师：规划、讲解、布置作业、批改。",
  "author": "你的名字",
  "kind": "skill",
  "skill": { "file": "SKILL.md" },
  "permissions": ["read-instructions"],
  "useWhen": "用户想学画画、发来自己的画、问画画问题时。",
  "examples": ["帮我看看这张画", "这周练什么"],
  "troubleshooting": ["批改很笼统：在设置里换一个更好的视觉模型。"]
}
```

MCP 插件把 `skill` 换成 `mcp`：

```json
{
  "id": "weather-tool",
  "name": "天气工具",
  "version": "1.0.0",
  "description": "查询任意城市的天气和预报。",
  "kind": "mcp",
  "mcp": { "command": "node", "args": ["server.js"], "env": {} },
  "permissions": ["network"],
  "requires": [{ "name": "Node.js 20 或更新", "install": "https://nodejs.org" }],
  "setup": ["在插件文件夹里运行一次 npm install。"]
}
```

在线服务用 `"mcp": { "url": "https://…" }`。`command` 在插件文件夹里运行。

## 字段

| 字段 | 必填 | 说明 |
|---|---|---|
| `id` | 是 | 小写字母、数字、`.` `-` `_`，2～63 个字符，全局唯一 |
| `name` | 是 | 显示的名字 |
| `description` | 是 | 一句话说明，用户能看懂 |
| `kind` | 是 | `skill` 或 `mcp` |
| `version` | 否 | 版本号，默认 `0.1.0` |
| `author`、`homepage` | 否 | 作者、主页 |
| `skill.file` | 否 | 技能说明文件，默认 `SKILL.md` |
| `mcp.command` / `mcp.args` / `mcp.env` / `mcp.url` | mcp 二选一 | 启动命令及参数、环境变量；或在线服务地址 |
| `permissions` | 否 | 见下表；不写时技能为 `read-instructions`，MCP 为 `run-program` |
| `requires` | 否 | 需要先装好的东西：`[{ "name": "…", "install": "下载地址或做法" }]` |
| `setup` | 否 | 设置步骤，一条一步 |
| `useWhen` | 否 | 什么时候适合用（角色推荐插件时读这一句） |
| `examples` | 否 | 用户可以怎么说 |
| `troubleshooting` | 否 | 常见问题和解决办法（角色帮用户排错时读） |

权限（安装前会给用户看）：

| 权限 | 意思 |
|---|---|
| `read-instructions` | 只读说明 |
| `run-program` | 在电脑上运行程序 |
| `network` | 联网 |
| `send-messages` | 替用户发消息 |
| `credentials` | 使用账号或密钥 |
| `change-computer` | 改动电脑 |

## 装好以后

- 插件默认只对**安装时选中的角色**开启（技能），或对所有角色开启（MCP）；每个角色可以单独开关。
- 角色能读到 `description`、`useWhen`、`examples`、`setup`、`troubleshooting`，用来向用户介绍插件、带着用户设置、帮用户排错。
- 安装不会运行插件里的任何代码；MCP 插件在角色第一次调用它的工具时才启动。
