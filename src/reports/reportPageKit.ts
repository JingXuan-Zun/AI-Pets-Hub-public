// Shared pieces of the dark-neon report pictures (2026-11-09): the styles, a glass panel, the
// header and the page wrapper. A page holds no scripts and no outside files; its own CSP allows
// only inline styles and data: images. electron/reportImageRenderer.cjs takes the picture.

import { escapeHtml as esc, icon, pawMark } from './reportGraphics';
import { REPORT_SIZE } from './taskReportTypes';

export const CSS = `
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:"Microsoft YaHei UI","Microsoft YaHei","PingFang SC","Noto Sans SC",sans-serif;color:#e6e9ff;overflow:hidden;
background:radial-gradient(ellipse at 50% 38%,#1b2366 0%,#0d1240 42%,#060a24 100%)}
.stage{position:relative;overflow:hidden}
.grid{position:absolute;inset:0;background-image:linear-gradient(rgba(110,130,255,.07) 1px,transparent 1px),linear-gradient(90deg,rgba(110,130,255,.07) 1px,transparent 1px);background-size:48px 48px}
.stars{position:absolute;inset:0;background-image:radial-gradient(1.5px 1.5px at 12% 18%,#9fb4ff,transparent),radial-gradient(1px 1px at 72% 12%,#fff,transparent),radial-gradient(1.5px 1.5px at 88% 64%,#c7a8ff,transparent),radial-gradient(1px 1px at 34% 82%,#9fdcff,transparent),radial-gradient(1px 1px at 58% 44%,#fff,transparent),radial-gradient(1.5px 1.5px at 22% 58%,#ffb8e0,transparent)}
.panel{position:relative;background:linear-gradient(160deg,rgba(38,48,120,.62),rgba(16,22,70,.7));border:1px solid rgba(130,150,255,.38);border-radius:16px;
box-shadow:0 0 22px rgba(90,110,255,.22),inset 0 0 18px rgba(120,140,255,.08);padding:16px 18px;overflow:hidden}
.panel::before{content:"";position:absolute;left:18px;right:18px;top:0;height:1px;background:linear-gradient(90deg,transparent,rgba(160,180,255,.8),transparent)}
.ph{display:flex;align-items:center;gap:10px;margin-bottom:12px;padding-bottom:10px;border-bottom:1px solid rgba(130,150,255,.18)}
.ph b{font-size:21px;font-weight:700;letter-spacing:1px;color:#f1f3ff;text-shadow:0 0 10px rgba(150,170,255,.55)}
.ph span{margin-left:auto;font-size:15px;color:#9aa6e8}
.row{display:flex;align-items:flex-start;gap:10px;font-size:16px;line-height:1.45;margin:7px 0}
.row>div{flex:1;min-width:0}.row .t{color:#e9ecff}.row .n{color:#9aa6e8;font-size:14px}
.row .t,.row .n{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.more{font-size:14px;color:#8d98d8;margin-top:6px}
.title{font-size:46px;font-weight:800;letter-spacing:2px;background:linear-gradient(90deg,#7ef0ff,#a99bff 55%,#ff9fd8);-webkit-background-clip:text;color:transparent;filter:drop-shadow(0 0 14px rgba(140,150,255,.55))}
.sub{font-size:20px;color:#b9c2ff;margin-top:6px;letter-spacing:1px}
.pill{display:inline-flex;align-items:center;gap:8px;padding:8px 16px;border-radius:999px;border:1px solid rgba(130,150,255,.45);background:rgba(20,28,84,.7);font-size:15px;color:#cfd6ff}
.dot{width:10px;height:10px;border-radius:50%;background:#4fe3a8;box-shadow:0 0 10px #4fe3a8}
.tile{flex:1;min-width:0;border-radius:12px;padding:10px 12px;background:rgba(12,18,60,.55);border:1px solid rgba(130,150,255,.22)}
.tile .k{font-size:14px;color:#9aa6e8}.tile .v{font-size:30px;font-weight:800;margin-top:2px}
.bar{height:10px;border-radius:5px;background:rgba(140,160,255,.15);overflow:hidden;display:flex}
.hero{position:absolute;display:flex;align-items:center;justify-content:center}
.ava{position:relative;border-radius:50%;overflow:hidden;border:3px solid rgba(170,190,255,.9);box-shadow:0 0 28px rgba(140,160,255,.85),0 0 70px rgba(110,120,255,.5);background:radial-gradient(circle,#3a3f9c,#161a55);display:flex;align-items:center;justify-content:center}
.ava img{width:100%;height:100%;object-fit:cover}
.orb{position:absolute;display:flex;flex-direction:column;align-items:center;justify-content:center;border-radius:50%;background:radial-gradient(circle,rgba(30,36,100,.95),rgba(14,18,60,.95));text-align:center}
.orb .l{font-size:16px;color:#eef0ff;font-weight:700}.orb .c{font-size:22px;font-weight:800}
.platform{position:absolute;border-radius:50%;border:2px solid rgba(120,170,255,.55);box-shadow:0 0 24px rgba(110,160,255,.6),inset 0 0 24px rgba(110,160,255,.35)}
.foot{position:absolute;display:flex;align-items:center;gap:10px;font-size:15px;color:#8d98d8}
`;

export function panel(title: string, iconName: string, color: string, body: string, style: string, side = '') {
  return `<div class="panel" style="${style}"><div class="ph">${icon(iconName, color, 24)}<b>${esc(title)}</b>${side ? `<span>${esc(side)}</span>` : ''}</div>${body}</div>`;
}

/** Title, subtitle and a time pill (“完成时间：…”). */
export function headerHtml(meta: { createdAt: number; subtitle?: string; title: string }, pillLabel: string, fallbackSubtitle: string) {
  const time = new Date(meta.createdAt);
  const stamp = `${time.getFullYear()}-${String(time.getMonth() + 1).padStart(2, '0')}-${String(time.getDate()).padStart(2, '0')} ${String(time.getHours()).padStart(2, '0')}:${String(time.getMinutes()).padStart(2, '0')}`;
  return `<div style="position:absolute;left:40px;top:30px;display:flex;align-items:center;gap:18px">${pawMark(64)}<div><div class="title" style="font-size:46px">${esc(meta.title)}</div><div class="sub">${esc(meta.subtitle || fallbackSubtitle)}</div></div></div>
<div class="pill" style="position:absolute;right:40px;top:44px"><span class="dot"></span>${esc(pillLabel)}：${stamp}</div>`;
}

/** The whole page around a body: 1536×1024 unless a page asks for its own height (the mind map grows). */
export function buildReportPage(body: string, height: number = REPORT_SIZE.height) {
  const { width } = REPORT_SIZE;
  return {
    height,
    html: `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'"><style>${CSS}</style></head><body style="width:${width}px;height:${height}px">${body}</body></html>`,
    width,
  };
}
