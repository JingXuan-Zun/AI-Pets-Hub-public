# 人格分享接口部署

目标：用户在软件点击「＋」，选择 TXT / MD / JSON 后直接公开上传；其他用户刷新列表并下载原文件。无需用户登录 GitHub、填写表单或等待维护者手动合并。

## 当前准备状态

- 目标仓库：`575738264/ai-desktop-pet-personas`，固定分支 `main`。
- 目标 Worker：`ai-desktop-pet-persona-api`。
- 服务地址：`https://ai-desktop-pet-persona-api.q18782297472.workers.dev`。
- 本地实现和模拟服务验证已完成；尚未替换线上 Hello World，也未配置线上数据库或凭据。
- 本地浏览器访问此 workers.dev 地址返回 `ERR_BLOCKED_BY_CLIENT`，不能据此断言你的浏览器或其他地区不可访问。正式接入需要分别验证国内、海外网络。

## 1. 创建 D1 计数库

在 Cloudflare 账户控制台进入「存储和数据库 → D1」，创建数据库，名称建议为 `persona-community-limits`。

打开数据库的 Console / 控制台，执行本目录 `schema.sql` 的全部内容：

```sql
CREATE TABLE IF NOT EXISTS persona_request_limits (
  bucket TEXT NOT NULL,
  window_start INTEGER NOT NULL,
  used INTEGER NOT NULL CHECK (used >= 1),
  PRIMARY KEY (bucket, window_start)
);
CREATE INDEX IF NOT EXISTS persona_limits_expiry ON persona_request_limits(window_start);
```

回到 Worker 的「绑定 → 添加绑定」，选择 D1 数据库：

| 项目 | 值 |
| --- | --- |
| 变量名称 | `RATE_DB` |
| 数据库 | `persona-community-limits` |

此库保存限流计数和使用每日盐值的 IP 哈希，不存储人格文件。原始 IP 不进入库或 GitHub。计数过期后在后续请求中清理。Cloudflare 本身的访问日志由 Cloudflare 的账户设置和政策控制。

## 2. 为仓库创建最小权限令牌

在 GitHub **个人账户** Settings → Developer settings → Personal access tokens → Fine-grained tokens 创建令牌。

- 名称：`persona-community-worker`。
- Repository access：Only select repositories，只选 `ai-desktop-pet-personas`。
- Repository permissions → Contents：Read and write。
- Metadata 的自动只读权限保持默认；无需 Actions、Workflows、Administration 或其他仓库权限。
- 设置到期日并记录续期日期。令牌到期或撤销后接口会停止访问仓库。

令牌只填到下一步 Cloudflare 的 Secret 输入框，不放入代码、聊天、GitHub 文件或客户端环境变量。

## 3. 配置 Worker 变量

进入 Worker → Settings / 设置 → Variables and Secrets / 变量和机密，添加：

| 类型 | 名称 | 内容 |
| --- | --- | --- |
| Secret | `GITHUB_TOKEN` | 上一步创建的仓库令牌 |
| Secret | `RATE_SALT` | 使用密码管理器生成并保存的随机字符串，建议至少 32 个字符 |
| Text | `UPLOADS_ENABLED` | 先填写 `false` |

变量和绑定名称区分大小写。无需给普通用户创建账号或开放仓库协作者权限。

## 4. 替换 Hello World

回到 Worker 页面顶部，点击 Edit code / 编辑代码。

用 `worker.bundle.mjs` 的**全部内容**替换现有 Worker 代码，然后部署。这个文件已经包含依赖；不要只粘贴 `worker.mjs`，后者需要本地模块。

本地重新生成部署文件：

```powershell
node scripts/build-persona-community-worker.mjs
```

生成文件中没有任何真实令牌。普通 `npm run build` 不会部署 Worker。

## 5. 核实读取，再开放上传

访问服务的 `/health`，初始配置齐全时应返回：

```json
{"ok":true,"configured":true,"uploadsEnabled":false}
```

这里的 `configured` 只检查变量/绑定是否存在。**必须继续访问 `/personas`**，确认数据库表、令牌和仓库读取真的正常：

```json
{"items":[]}
```

如果返回错误，检查绑定名称、SQL 是否执行、令牌权限/有效期，先不开放写入。

读操作验证成功后，把 `UPLOADS_ENABLED` 改成 `true` 并部署。接下来用一个明确可公开的测试文本从软件上传，在另一客户端刷新列表并下载，比对原文件与下载文件。

此接口直接将文件和目录作为同一个 Git 提交写入 `main`，不会创建 PR。若 `main` 确实配置了要求 PR 或限制直接写入的规则，GitHub 会拒绝这次发布，代码不会强推或自动关闭保护。到时按实际规则审查接入方式。

## 6. 配置客户端

本地 `.env.local` 中只配置公开服务地址：

```dotenv
VITE_PERSONA_COMMUNITY_API_URL="https://ai-desktop-pet-persona-api.q18782297472.workers.dev"
```

开发服务器需重新加载配置；发布给用户的版本需重新构建和按项目规则打包。客户端不包含 GitHub Token。用户只需安装已配置地址的版本。

## 接口与保存行为

- `GET /health`：配置状态（不输出密钥或内部错误）。
- `GET /personas`：当前公共目录，结构为 `{ "items": [...] }`。
- `POST /personas`：multipart/form-data，仅接受一个 `file` 字段，要求 `X-Persona-Upload: 1`。成功返回 HTTP 201 和已提交的条目。
- `GET /personas/:id/download`：在目录里找到条目后读取并校验文件，返回 attachment。
- JSON 文件只校验 JSON 语法，不要求上传者遵守人格字段模板；TXT/MD/JSON 均为 UTF-8。
- 文件内容逐字节保存；文件名只做路径/控制字符/Windows 文件名清理。不会自动加载或执行上传内容。
- 仅处理用户明确选择的文件，不读取软件配置、聊天记录、记忆或本地图谱。
- 内容哈希和格式决定 ID，同一文件重试不会重复发布。并发上传使用非强制 fast-forward 更新，并最多重试三次。
- 仅新增 `personas/<id>.<扩展名>` 和更新 `catalog/index.json`；`v1`、根 README 及其他文件保留。
- 客户端进入页面/手动刷新时读取，页面可见时每分钟刷新；其他用户不会收到推送通知。

## 初期规模与运营

- 单文件 1 字节至 2 MiB；目录最多 1000 条，当前目录关联文件总量最多 100 MiB。达到容量时拒绝新增，不清空旧内容。
- 上传每 IP 每分钟 5 次，全站每分钟 10 次、每天 100 次。失败的请求也会占用额度。
- 列表和下载共用读取额度：每 IP 每分钟 30 次，全站每分钟 30 次，适用于初期小范围验证。正式扩大用户数前需增加缓存/分页并重新评估 GitHub API 配额，不能只无限调大限流数。
- D1 计数与 Worker 实例无关；共享公网 IP 的用户会共享 IP 限额。全站上限保护免费服务，但匿名恶意请求可能抢占额度，这不等于完整的反滥用系统。
- 本版本没有自动内容审核或举报后台。运营者可将 `UPLOADS_ENABLED=false` 暂停新增；从目录移除条目会停止应用内展示和下载。公开 GitHub 的原文件、提交历史及已有下载副本不会因此自动消失。
- workers.dev 免费域名的国内可达性需要实际测试；如不可用，需要另外配置可访问的域名/部署线路，不能把 GitHub 换成 Workers 就视为国内网络问题已解决。

## 本地验证

```powershell
node scripts/build-persona-community-worker.mjs
node --import=tsx scripts/persona-community-service-smoke.ts
npm.cmd run lint
npm.cmd run build
```

服务 smoke 使用内存 SQLite 和模拟 GitHub，不对公开仓库写入。它不能替代 Cloudflare 真实运行时、GitHub 实际令牌/分支规则、Electron 下载行为或国内外网络验证。
