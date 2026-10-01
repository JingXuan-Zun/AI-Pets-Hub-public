# Windows 局域网人格分享服务器

此版本先打通人格 TXT / MD / JSON 分享。数据保存在服务器电脑的 SQLite 数据库中，不依赖 GitHub Token、Cloudflare Worker 或 D1。

它不运行桌宠界面，不提供 AI 推理，也尚未实现插件目录和模型/动作/音频大文件服务。不要把它直接当作开放插件市场。

## 一、准备部署包

在研发电脑执行 `node scripts/build-persona-community-selfhost.mjs`，输出在 `release/persona-community-selfhost/`，旁边同时生成 ZIP。只把这个 ZIP 复制到空闲电脑，不要复制整个项目。

把 ZIP 解压到机械硬盘上的专用目录，例如 `D:\PetSharingServer`。安装 [Node.js 24 LTS](https://nodejs.org/en/download)，或把官方 Windows x64 便携发行版的 `node.exe` 放进部署目录的 `runtime` 文件夹。不需要 npm install、不需要 Docker。

## 二、空闲电脑配置 HTTPS

1. 双击 `Setup-LanHttps.cmd`。它检测本机私有 IPv4；有多个网卡时会询问地址。
2. 脚本生成六个月有效的局域网测试证书、服务配置及 `SERVER-ADDRESS.txt`。证书私钥仅留在服务器专用目录。
3. 双击 `Start-Server.cmd`，保持窗口打开；按 Ctrl+C 停止。
4. Windows 防火墙如询问是否允许访问，只允许“专用网络”。若没有询问，可在服务器的管理员 PowerShell 中针对 Node 路径创建 TCP 8787 的专用网络、本地子网规则；先验证两台电脑的网络配置，不要关闭防火墙。

示例规则（将程序路径改为实际 node.exe；只在空闲电脑执行）：

```powershell
New-NetFirewallRule -DisplayName 'Pet Sharing LAN' -Direction Inbound -Action Allow -Protocol TCP -LocalPort 8787 -Profile Private -RemoteAddress LocalSubnet -Program 'D:\PetSharingServer\runtime\node.exe'
```

本服务不会替你改变睡眠、防火墙、开机启动或路由器设置。先手动跑通再安排长期运行。局域网地址变化或证书到期时需要重新配置；保留旧文件和数据库后再生成新证书，并在客户端更新信任。

## 三、开发电脑信任局域网证书

只复制 `lan-server.cer` 和 `Trust-LanCertificate.ps1` 到开发电脑的同一个文件夹。在该文件夹打开 PowerShell：

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Trust-LanCertificate.ps1
```

核对两台电脑显示的证书文件 SHA-256 一致，再输入 `TRUST`。脚本只给当前 Windows 用户添加信任，不关闭证书验证。不要把 PFX、密码文件或服务器数据复制到客户端。

用开发电脑浏览器打开 `SERVER-ADDRESS.txt` 中的地址并加 `/health`。应无证书警告，返回 `{"ok":true,"configured":true,"uploadsEnabled":true}`。

## 四、接入当前桌宠

客户端继续要求 HTTPS。把研发电脑 `.env.local` 中的 `VITE_PERSONA_COMMUNITY_API_URL` 设为 `SERVER-ADDRESS.txt` 的实际地址，例如：

```dotenv
VITE_PERSONA_COMMUNITY_API_URL="https://192.168.1.20:8787"
```

仅替换这一项，保留文件中的其他配置。重启开发服务器；打包版需要重新构建和按项目打包规则更新，正在运行的旧包不会自动改地址。

在设置的人格分享区上传一个可公开的测试 TXT，刷新列表并下载，比对原文件。切勿使用真实私人角色、聊天、记忆或图谱作为测试文件。

## 五、数据、限额和备份

- 单文件最多 2 MiB，UTF-8 TXT / MD / JSON；JSON 校验语法。
- 最多 1000 个条目、原始文件总量 100 MiB。即使有 500 GB 空间也先保留这个小规模验证上限。
- 相同内容和格式重复上传返回原条目；文件与目录元数据在同一 SQLite 事务写入。
- 原有配额：每个地址每分钟 5 次上传、全局每分钟 10 次上传、每天 100 次上传；每个地址/全局每分钟 30 次读取。配额保存到数据库，重启不会重置。
- 使用直接连接的 socket 地址限流，忽略用户可伪造的转发地址。未来接反向代理时需单独设计可信代理，不要直接信任 X-Forwarded-For。
- 上传不会执行；服务器不提供任意文件浏览、删除、Shell 或私人配置读取接口。
- 暂停上传：停止服务，将 `server.config.json` 的 `uploadsEnabled` 改为 `false`，再启动。
- 备份：先按 Ctrl+C 正常停止服务，复制完整 `data` 目录到另一块硬盘。运行时不要只复制 `.sqlite` 而遗漏 WAL。
- 升级只替换代码和启动文件；保留 `data`、`certificates`、`server.config.json` 和证书，不能整目录覆盖。

这是局域网验证版本。公网服务还需要稳定 HTTPS 地址、实际国内网络验证、上传治理和运维；不要直接开放家庭电脑其他端口。普通用户无需安装此服务器。

## 验证边界

本地自动测试覆盖双客户端上传/下载、并发、去重、重启持久化、限额、篡改和脱敏错误。最终仍需在空闲 Windows 电脑上实际验证证书、专用网络防火墙及跨电脑访问。
