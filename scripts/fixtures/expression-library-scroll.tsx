// Development-only fixture: renders the production component with in-memory IPC.
// Run Vite, open /scripts/fixtures/expression-library-scroll.html and click 运行回归测试.
import { useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ExpressionLibraryManager } from '../../src/components/settings/ExpressionLibraryManager';
import { expressionLibraryBridge } from '../../src/expression/expressionLibraryBridge';
import type { ExpressionLibraryMode, ExpressionLibraryState } from '../../src/expression/expressionLibraryTypes';
import '../../src/index.css';

let loadedMode: ExpressionLibraryMode = 'managed';
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const state = (): ExpressionLibraryState => ({
  assets: [],
  categories: [{ available: true, description: '开心、愉快', folderRelativePath: '开心', id: `${loadedMode}-happy`, name: '开心', reviewRequired: false, semanticVersion: 1 }],
  library: { mode: loadedMode, rootPath: `fixture/${loadedMode}` },
  updatedAt: '2026-09-04',
  version: 5,
});
expressionLibraryBridge.getState = async () => ({ ok: true, state: state() });
expressionLibraryBridge.selectMode = async (mode) => {
  await delay(120);
  loadedMode = mode;
  return { ok: true, state: state() };
};

function Fixture() {
  const [mode, setMode] = useState<ExpressionLibraryMode | null>(null);
  const [enabled, setEnabled] = useState(true);
  const [report, setReport] = useState('尚未运行');
  const scrollRef = useRef<HTMLDivElement>(null);
  const run = async () => {
    const scroll = scrollRef.current!;
    const results: Array<{ mode: string; before: number; after: number; delta: number; pass: boolean }> = [];
    for (const nextMode of ['managed', 'external', 'managed'] as const) {
      const title = nextMode === 'managed' ? '应用托管库' : '外部目录库';
      const card = [...scroll.querySelectorAll('h3')].find((heading) => heading.textContent === '图片表情包库')!.closest('section')!;
      scroll.scrollTop = scroll.scrollHeight;
      await delay(80);
      const before = card.getBoundingClientRect().top;
      const label = [...card.querySelectorAll('div')].find((element) => element.textContent === title)!;
      const button = label.parentElement!.parentElement!.querySelector('button')!;
      button.focus({ preventScroll: true });
      button.click();
      await delay(350);
      const after = card.getBoundingClientRect().top;
      const delta = Math.abs(after - before);
      results.push({ mode: nextMode, before, after, delta, pass: delta <= 2 });
    }
    setReport(JSON.stringify({ pass: results.every((result) => result.pass), results }, null, 2));
  };
  return <main className="mx-auto max-w-3xl p-4">
    <h1>表情包图库切换滚动回归测试（仅模拟数据）</h1>
    <button className="my-3 rounded border px-3 py-2" onClick={() => void run()}>运行回归测试</button>
    <div ref={scrollRef} className="custom-scrollbar overflow-y-auto overflow-x-hidden rounded-lg border p-4" style={{ height: 480 }}>
      <div style={{ height: 400 }}>上方回复设置占位</div>
      <ExpressionLibraryManager enabled={enabled} selectedMode={mode} onSelectedModeChange={setMode} onEnabledChange={setEnabled} onImageCandidateCountChange={() => {}} />
    </div>
    <pre role="status" className="mt-3 whitespace-pre-wrap">{report}</pre>
  </main>;
}

createRoot(document.getElementById('root')!).render(<Fixture />);
