// The owner's review page (/review). The admin token is typed here and kept only in this tab's
// sessionStorage; every value from an upload is inserted as text, never as HTML.
export const REVIEW_PAGE_HTML = `<!doctype html>
<html lang="zh"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>插件审核</title>
<style>
body{font-family:system-ui,sans-serif;margin:0;background:#fbf5fa;color:#3a2a45}
main{max-width:860px;margin:0 auto;padding:16px}
h1{font-size:20px}
.card{background:#fff;border:1px solid #eeddea;border-radius:12px;padding:14px;margin:12px 0}
.meta{color:#7a6585;font-size:13px}
.warn{color:#b45309;font-size:13px;font-weight:600}
code,pre{background:#f6eef4;border-radius:6px;padding:2px 6px;font-size:12px;white-space:pre-wrap;word-break:break-all}
button{border:0;border-radius:8px;padding:6px 14px;font-weight:600;cursor:pointer;margin-right:6px}
.ok{background:#d4518e;color:#fff}.no{background:#eee;color:#555}.ghost{background:#fff;border:1px solid #ddd}
input{padding:6px 10px;border:1px solid #ddd;border-radius:8px;width:280px}
</style></head><body><main>
<h1>插件审核</h1>
<p class="meta">输入审核密码（Worker 的 ADMIN_TOKEN）。只保存在这个标签页里，关掉就忘。</p>
<form id="login"><input id="token" type="password" placeholder="审核密码" autocomplete="off"> <button class="ok">进入</button></form>
<p id="status" class="meta"></p>
<div id="list"></div>
</main>
<script>
const $ = (id) => document.getElementById(id);
let token = sessionStorage.getItem('plugin-review-token') || '';
const api = (path, method = 'GET') => fetch(path, { method, headers: { Authorization: 'Bearer ' + token } });
function el(tag, text, cls) { const node = document.createElement(tag); if (text !== undefined) node.textContent = text; if (cls) node.className = cls; return node; }
async function load() {
  if (!token) return;
  $('status').textContent = '读取中…';
  const res = await api('/review/pending');
  if (res.status === 401) { $('status').textContent = '密码不对。'; sessionStorage.removeItem('plugin-review-token'); return; }
  const data = await res.json();
  $('status').textContent = data.items.length ? '待审核 ' + data.items.length + ' 个' : '没有待审核的插件。';
  $('list').replaceChildren(...data.items.map((item) => {
    const m = item.manifest; const card = el('div', undefined, 'card');
    card.append(el('h3', m.name + '  ' + m.id + ' v' + m.version + '（' + (m.kind === 'mcp' ? 'MCP 工具' : '技能') + '）'));
    if (item.replaces) card.append(el('div', '会替换已发布的 v' + item.replaces + '：确认是同一个作者的更新。', 'warn'));
    card.append(el('p', m.description));
    card.append(el('div', '作者：' + (m.author || '未填') + '　大小：' + Math.round(item.size / 1024) + ' KB　上传：' + item.uploadedAt, 'meta'));
    card.append(el('div', '权限：' + m.permissions.join('、'), 'meta'));
    if (m.mcp) card.append(el('pre', '启动方式：' + (m.mcp.url || [m.mcp.command, ...m.mcp.args].join(' '))));
    if (m.requires.length) card.append(el('div', '需要：' + m.requires.map((r) => r.name).join('、'), 'meta'));
    const actions = el('div'); actions.style.marginTop = '10px';
    const zip = el('button', '下载检查', 'ghost');
    zip.onclick = async () => { const r = await api('/review/' + item.uploadId + '/zip'); const blob = await r.blob(); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = m.id + '-' + m.version + '.zip'; a.click(); };
    const ok = el('button', '通过', 'ok');
    ok.onclick = async () => { if (confirm('发布 ' + m.name + ' v' + m.version + '？所有用户都能下载。')) { await api('/review/' + item.uploadId + '/approve', 'POST'); load(); } };
    const no = el('button', '拒绝', 'no');
    no.onclick = async () => { if (confirm('拒绝并删除这次上传？')) { await api('/review/' + item.uploadId + '/reject', 'POST'); load(); } };
    actions.append(zip, ok, no); card.append(actions); return card;
  }));
}
$('login').onsubmit = (event) => { event.preventDefault(); token = $('token').value.trim(); sessionStorage.setItem('plugin-review-token', token); load(); };
load();
</script></body></html>`;
