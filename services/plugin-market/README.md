# 插件市场接口部署

插件市场 = 一个 Cloudflare Worker（`ai-desktop-pet-plugin-api`）+ 一个 R2 存储桶（放插件文件）+ 人格分享已有的 D1 计数库（限流）。

- 谁都能浏览、下载、上传；**上传的插件先进“待审核”，你在审核页点“通过”才公开**。
- 客户端默认地址：`https://ai-desktop-pet-plugin-api.qianxuanlian.workers.dev`（`src/plugins/pluginMarketApi.ts`，可用 `VITE_PLUGIN_MARKET_API_URL` 覆盖）。
- 部署文件：`services/plugin-market/worker.bundle.mjs`，用 `node scripts/build-plugin-market-worker.mjs` 重新生成，里面没有任何密钥。

全部在 Cloudflare 网页控制台里操作，大约 15 分钟。

## 1. 开通 R2 并建存储桶

1. 左侧「R2 对象存储」→ 第一次用要先开通（需要绑定支付方式；免费额度：10 GB 存储、每月 100 万次写、1000 万次读，下载不收流量费）。
2. 「创建存储桶」，名称：`ai-desktop-pet-plugins`，位置自动。
3. 不用开“公开访问”：文件只通过 Worker 下载。

## 2. 创建 Worker

1. 「Workers 和 Pages」→「创建」→「创建 Worker」，名称：`ai-desktop-pet-plugin-api`，先部署默认的 Hello World。
2. 打开这个 Worker →「设置」→「绑定」→「添加绑定」：

| 类型 | 变量名称 | 选择 |
|---|---|---|
| R2 存储桶 | `PLUGINS` | `ai-desktop-pet-plugins` |
| D1 数据库 | `RATE_DB` | `persona-community-limits`（人格分享在用的那个，**直接复用，不用新建表**） |

3. 「设置」→「变量和机密」→ 添加：

| 类型 | 名称 | 内容 |
|---|---|---|
| 机密 | `RATE_SALT` | 用密码管理器生成的随机字符串（至少 32 个字符；可以和人格分享的不同） |
| 机密 | `ADMIN_TOKEN` | **审核密码**，至少 16 个字符，自己记好（密码管理器） |
| 文本 | `UPLOADS_ENABLED` | 先填 `false` |

## 3. 换成正式代码

1. Worker 页面右上「编辑代码」。
2. 用 `services/plugin-market/worker.bundle.mjs` 的**全部内容**替换编辑器里的代码 →「部署」。

## 4. 检查

浏览器打开（或告诉我来查）：

- `https://ai-desktop-pet-plugin-api.qianxuanlian.workers.dev/health` 应该是
  `{"configured":true,"ok":true,"reviewEnabled":true,"uploadsEnabled":false}`
- `…/plugins` 应该是 `{"items":[],"updatedAt":null}`
- `…/review` 是审核页：输入审核密码，显示“没有待审核的插件”。

都正常后，把 `UPLOADS_ENABLED` 改成 `true` 并保存，上传就开放了。

## 日常审核

- 打开 `…/review`，输入审核密码。
- 每个待审核插件显示：名字、id、版本、类型、作者、要的权限、MCP 的启动命令；**如果会替换已发布的版本，会有橙色提示**——确认是同一个作者的更新再通过。
- 「下载检查」可以把压缩包下载下来看里面的文件；MCP 插件会在用户电脑上运行程序，**看不懂代码的不要通过**。
- 「通过」→ 进入公开列表；「拒绝」→ 删除这次上传。

## 接口

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/health` | 配置状态 |
| GET | `/plugins` | 已发布插件列表（每个插件的最新版） |
| GET | `/plugins/<id>/download` | 下载最新版 zip（响应头带 `X-Plugin-Sha256`，客户端会核对） |
| POST | `/plugins` | 上传：multipart，字段 `file`（zip，≤10 MB），请求头 `X-Plugin-Upload: 1` → 202 待审核 |
| GET | `/review` | 审核页 |
| GET | `/review/pending` | 待审核列表（`Authorization: Bearer <ADMIN_TOKEN>`） |
| GET | `/review/<uploadId>/zip` | 下载待审核的包 |
| POST | `/review/<uploadId>/approve`、`/reject` | 通过 / 拒绝 |

限流（按 IP 的每日加盐哈希，不存原始 IP）：每个 IP 每天上传 10 次、全站每天 200 次；下载每 IP 每分钟 30 次；列表每 IP 每分钟 60 次。

## 存储布局（R2）

- `catalog/index.json`：公开列表，写入时用 etag 防止同时审核互相覆盖。
- `plugins/<id>/<版本>.zip`：每个通过的版本都保留。
- `pending/<上传id>.zip` / `.json`：待审核。

上传的 zip 会按客户端同样的规则检查（`electron/pluginManifestRules.cjs`、`pluginZipRules.cjs`），只重新打包插件自己的文件夹，所以审核看到的就是用户装到的。

## 国内访问

`*.workers.dev` 在国内可能打不开或不稳。先请没开代理的用户打开 `/health` 测一下；打不开就在 Cloudflare 买一个域名，绑到这个 Worker（「设置」→「域和路由」→「添加自定义域」），再把客户端默认地址改成新域名。
