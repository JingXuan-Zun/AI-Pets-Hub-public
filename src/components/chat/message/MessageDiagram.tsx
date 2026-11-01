import { Download } from 'lucide-react';
import { buildDiagramDocument, readDiagramAspect } from './messageDiagrams';

/** A character's diagram, drawn in a sandboxed frame that can neither run scripts nor load anything. */
export function MessageDiagram({ svg, index }: { svg: string; index: number }) {
  const save = () => {
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `示意图-${new Date().toISOString().slice(0, 10)}-${index + 1}.svg`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  };
  return (
    <figure className="mt-2 overflow-hidden rounded-lg border border-border bg-white">
      <iframe
        title={`示意图 ${index + 1}`}
        sandbox=""
        srcDoc={buildDiagramDocument(svg)}
        className="block w-full border-0"
        style={{ aspectRatio: String(readDiagramAspect(svg)), maxHeight: 420 }}
      />
      <figcaption className="flex items-center justify-between border-t border-border px-2 py-1 text-2xs text-muted-foreground">
        <span>示意图</span>
        <button type="button" onClick={save} className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-muted hover:text-foreground">
          <Download className="h-3 w-3" />保存图片
        </button>
      </figcaption>
    </figure>
  );
}
