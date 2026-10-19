import { AlertTriangle, Loader2 } from 'lucide-react';

// What a pet's spot shows while its model loads, or when it could not load. Both used to
// show the built-in default character (an unrelated girl), which looked like the wrong
// model had been picked; now it is a small spinner, or a short note saying it failed.

export function PetModelStatusPlaceholder({ kind }: { kind: 'loading' | 'failed' }) {
  return (
    <div
      className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2"
      role="status"
      aria-label={kind === 'loading' ? '模型加载中' : '模型加载失败'}
    >
      {kind === 'loading' ? (
        <Loader2 className="h-8 w-8 animate-spin text-pink-400/80 drop-shadow" />
      ) : (
        <>
          <AlertTriangle className="h-8 w-8 text-amber-500/90 drop-shadow" />
          <span className="rounded-full bg-white/85 px-3 py-1 text-xs font-semibold text-slate-600 shadow">
            模型加载失败
          </span>
        </>
      )}
    </div>
  );
}
