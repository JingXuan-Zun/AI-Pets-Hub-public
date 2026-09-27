import { type DragEvent } from 'react';
import type { ExpressionCategory, ExpressionLibraryState } from '../../expression/expressionLibraryTypes';
import { expressionCategoryNameError } from '../../expression/expressionCategoryName';

interface ExpressionCategoryPanelProps {
  category: ExpressionCategory;
  description: string;
  loading: boolean;
  managed: boolean;
  name: string;
  state: ExpressionLibraryState;
  onChange: (name: string, description: string) => void;
  onCreate: () => void;
  onDelete: (categoryId: string, categoryName: string) => void;
  onDropImages: (files: File[]) => void;
  onOpenFolder: () => void;
  onSelect: (categoryId: string) => void;
}

function CategoryStrip(props: ExpressionCategoryPanelProps) {
  const categories = props.state.categories.filter((category) => category.id !== 'cat_unclassified');
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {categories.map((category) => (
        <div className="relative h-12 w-[92px] shrink-0" key={category.id}>
          <button className={`h-full w-full rounded-md border px-2.5 py-1.5 text-left text-xs transition ${props.category.id === category.id ? 'border-primary bg-primary text-primary-foreground shadow-sm' : 'border-border bg-background hover:border-primary/50'}`} type="button" onClick={() => props.onSelect(category.id)}>
            <div className="truncate pr-4 font-medium">{category.name}{category.reviewRequired ? ' · 待审' : ''}</div>
            <div className="mt-0.5 opacity-70">{props.state.assets.filter((asset) => asset.categoryId === category.id).length} 张</div>
          </button>
          {props.managed && category.id !== 'cat_unclassified' ? <button aria-label={`删除分类 ${category.name}`} className={`absolute right-1 top-1 flex h-4 w-4 cursor-pointer items-center justify-center rounded text-xs leading-none transition ${props.category.id === category.id ? 'bg-white/15 text-white hover:bg-red-500' : 'bg-red-50 text-red-500 hover:bg-red-100'}`} disabled={props.loading} title="删除分类" type="button" onClick={(event) => { event.stopPropagation(); props.onDelete(category.id, category.name); }}>×</button> : null}
        </div>
      ))}
      {props.managed ? <button className="h-12 w-[92px] shrink-0 rounded-md border border-dashed border-border bg-background px-2.5 text-xs font-medium transition hover:border-primary hover:bg-primary/5 disabled:opacity-50" disabled={props.loading} type="button" onClick={props.onCreate}>＋ 增加</button> : null}
    </div>
  );
}

export function ExpressionCategoryPanel(props: ExpressionCategoryPanelProps) {
  if (props.category.id === 'cat_unclassified') {
    return <section className="rounded-lg border border-border bg-card p-3 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold">分类管理</h3>
      <CategoryStrip {...props} />
      <p className="mt-2 text-xs text-muted-foreground">暂无已选分类。可新增或导入分类；需要重新归类的图片在下方批量处理区。</p>
    </section>;
  }
  const nameError = props.managed ? expressionCategoryNameError(props.name) : null;
  const descriptionEditable = props.category.id !== 'cat_unclassified';
  const nameEditable = props.managed && descriptionEditable;
  const imagesEditable = props.managed && props.category.id !== 'cat_unclassified';
  const drop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (imagesEditable) props.onDropImages([...event.dataTransfer.files]);
  };
  return (
    <section className="rounded-lg border border-border bg-card p-3 shadow-sm">
      <div className="mb-3"><h3 className="text-sm font-semibold">分类管理</h3><p className="text-[11px] text-muted-foreground">选择分类后直接编辑，最后点击窗口右下角“保存”。</p></div>
      <CategoryStrip {...props} />
      {props.category.nameIssue ? <p role="alert" className="mt-2 rounded-md border border-destructive/30 p-2 text-xs text-destructive">历史分类名称需修复：{props.category.nameIssue} {props.managed ? '请输入合法名称并点击窗口右下角“保存”；不会自动删除原目录。' : '请在资源管理器中修复外部目录名称后重新扫描。'}</p> : null}
      <div className="mt-3 rounded-md bg-secondary/20 p-2">
        <div className="grid items-stretch gap-2 md:grid-cols-[minmax(120px,0.7fr)_minmax(0,1.6fr)]">
          <div className="flex min-w-0 flex-col rounded-md border border-slate-300 bg-background p-2 text-xs font-medium shadow-sm">
            <label htmlFor={`expression-category-name-${props.category.id}`}>分类名称</label>
            <textarea
              id={`expression-category-name-${props.category.id}`}
              className="mt-1.5 h-16 w-full resize-none overflow-auto whitespace-nowrap rounded-md border border-slate-300 bg-background px-3 py-2 text-xs font-normal outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 disabled:opacity-60"
              disabled={!nameEditable}
              aria-invalid={Boolean(nameError)}
              aria-describedby={nameError ? `expression-name-error-${props.category.id}` : undefined}
              maxLength={64}
              title="最多输入 64 个字符；内容超出显示区域时可滚动查看"
              value={props.name}
              wrap="off"
              onChange={(event) => props.onChange(event.target.value, props.description)}
            />
            {nameError ? <p id={`expression-name-error-${props.category.id}`} role="alert" className="mt-1 text-xs text-destructive">{nameError}</p> : null}
            <button
              className="mt-2 w-full cursor-pointer rounded-md border-2 border-primary/60 bg-background px-2 py-1.5 text-[11px] font-semibold text-primary shadow-sm transition hover:border-primary hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 disabled:cursor-not-allowed disabled:border-border disabled:text-muted-foreground disabled:opacity-50"
              disabled={props.loading || (!props.managed && !props.category.available)}
              type="button"
              onClick={props.onOpenFolder}
            >打开当前分类文件夹</button>
          </div>
          <label className="flex min-w-0 flex-col rounded-md border border-slate-300 bg-background p-2 text-xs font-medium shadow-sm">
            分类详解
            <textarea
              className="mt-1.5 h-[106px] w-full resize-none overflow-auto rounded-md border border-slate-300 bg-background px-3 py-2 text-xs font-normal leading-5 outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 disabled:opacity-60"
              disabled={!descriptionEditable}
              maxLength={240}
              title="最多输入 240 个字符；内容超出显示区域时可滚动查看"
              value={props.description}
              onChange={(event) => props.onChange(props.name, event.target.value)}
            />
          </label>
        </div>
      </div>
      <div className={`mt-2 rounded-md border border-dashed px-3 py-3 text-center text-[11px] ${imagesEditable ? 'border-primary/40 bg-primary/[0.02] text-muted-foreground' : 'border-border text-muted-foreground/60'}`} onDragOver={(event) => imagesEditable && event.preventDefault()} onDrop={drop}>
        {imagesEditable ? '将 PNG / JPG / WebP / GIF 图片拖到这里，自动加入当前分类' : props.managed ? '“未分类”用于接收待整理图片' : '可编辑分类详解；文件夹名称和图片仍以外部原目录为准'}
      </div>
      <div className="mt-2 text-[10px] text-muted-foreground">分类 ID：{props.category.id} · 语义版本 v{props.category.semanticVersion}</div>
    </section>
  );
}
