import type { ExpressionLibraryMode } from '../../expression/expressionLibraryTypes';
import { Button } from '../../../components/ui/button';

interface ExpressionLibraryModePanelProps {
  loadedMode: ExpressionLibraryMode;
  loading: boolean;
  rootPath: string;
  selectedMode: ExpressionLibraryMode | null;
  onImportExternal: () => void;
  onImportManaged: () => void;
  onRescan: () => void;
  onSelectExternal: () => void;
  onSelectManaged: () => void;
}

export function ExpressionLibraryModePanel(props: ExpressionLibraryModePanelProps) {
  const selectedRootAvailable = props.selectedMode !== null && props.selectedMode === props.loadedMode;
  const pathText = !props.selectedMode
    ? '请先选择应用托管库或外部目录库'
    : selectedRootAvailable
      ? props.rootPath
      : '尚未导入外部目录；请点击“自定义分类导入”选择文件夹';
  return (
    <div className="mt-3 grid grid-cols-2 items-stretch gap-2">
      <div className={`flex h-full min-w-0 flex-col rounded-md border p-3 transition hover:border-primary/60 ${props.selectedMode === 'managed' ? 'border-primary bg-primary/5 shadow-sm ring-1 ring-primary/20' : 'border-border'}`}>
        <div className="flex min-h-12 items-start justify-between gap-2">
          <div><div className="text-xs font-semibold">应用托管库</div><div className="text-[11px] text-muted-foreground">复制导入，可整理和修改</div></div>
          <Button disabled={props.loading || props.selectedMode === 'managed'} size="sm" variant={props.selectedMode === 'managed' ? 'default' : 'outline'} onClick={props.onSelectManaged}>{props.selectedMode === 'managed' ? '使用中' : '使用'}</Button>
        </div>
        <Button className="mt-auto w-full" disabled={props.loading} size="sm" variant="outline" onClick={props.onImportManaged}>自定义分类导入</Button>
      </div>
      <div className={`flex h-full min-w-0 flex-col rounded-md border p-3 transition hover:border-primary/60 ${props.selectedMode === 'external' ? 'border-primary bg-primary/5 shadow-sm ring-1 ring-primary/20' : 'border-border'}`}>
        <div className="flex min-h-12 items-start justify-between gap-2">
          <div><div className="text-xs font-semibold">外部目录库</div><div className="text-[11px] text-muted-foreground">直接引用，只读不修改</div></div>
          <Button disabled={props.loading || props.selectedMode === 'external'} size="sm" variant={props.selectedMode === 'external' ? 'default' : 'outline'} onClick={props.onSelectExternal}>{props.selectedMode === 'external' ? '使用中' : '使用'}</Button>
        </div>
        <Button className="mt-auto w-full" disabled={props.loading} size="sm" variant="outline" onClick={props.onImportExternal}>自定义分类导入</Button>
      </div>
      <div className="col-span-2 flex items-center justify-between gap-2 rounded-md bg-secondary/35 px-3 py-2 text-[11px] text-muted-foreground">
        <div className="min-w-0"><div className="font-medium text-foreground">当前图库路径</div><div className="truncate" title={pathText}>{pathText}</div></div>
        <Button disabled={props.loading || !selectedRootAvailable} size="sm" variant="ghost" onClick={props.onRescan}>重新扫描</Button>
      </div>
    </div>
  );
}
