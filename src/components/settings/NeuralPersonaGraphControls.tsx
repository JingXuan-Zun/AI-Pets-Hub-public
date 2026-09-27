import type {
  NeuralPersonaGraphFilters,
  NeuralPersonaGraphViewNode,
} from '../../character-graph/neural-persona';

function toggle<T>(items: T[], value: T) {
  return items.includes(value) ? items.filter((item) => item !== value) : [...items, value];
}

function FilterChipGroup<T extends string>(props: {
  active: T[];
  label: string;
  onToggle: (value: T) => void;
  values: T[];
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="w-10 text-3xs text-muted-foreground">{props.label}</span>
      {props.values.map((value) => (
        <button
          type="button"
          key={value}
          onClick={() => props.onToggle(value)}
          className={`rounded-full border px-2 py-1 text-3xs ${props.active.includes(value) ? 'border-primary bg-primary/15 text-primary' : 'border-border text-muted-foreground'}`}
        >
          {value}
        </button>
      ))}
    </div>
  );
}

export function NeuralPersonaGraphControls(props: {
  filters: NeuralPersonaGraphFilters;
  nodes: NeuralPersonaGraphViewNode[];
  onChange: (filters: NeuralPersonaGraphFilters) => void;
  tagIds: string[];
}) {
  const types = [...new Set(props.nodes.map((node) => node.type))].sort();
  const scopes = [...new Set(props.nodes.map((node) => node.scope))].sort();
  const statuses = [...new Set(props.nodes.map((node) => node.status))].sort();
  return (
    <div className="space-y-3 rounded-sm border border-border bg-secondary/20 p-3">
      <input
        value={props.filters.query}
        onChange={(event) => props.onChange({ ...props.filters, query: event.target.value })}
        placeholder="搜索节点、标签或 ID"
        className="h-9 w-full rounded-sm border border-border bg-background px-3 text-xs outline-none focus:border-primary"
      />
      <FilterChipGroup label="类型" values={types} active={props.filters.types} onToggle={(type) => props.onChange({ ...props.filters, types: toggle(props.filters.types, type) })} />
      <FilterChipGroup label="范围" values={scopes} active={props.filters.scopes} onToggle={(scope) => props.onChange({ ...props.filters, scopes: toggle(props.filters.scopes, scope) })} />
      <FilterChipGroup label="状态" values={statuses} active={props.filters.statuses} onToggle={(status) => props.onChange({ ...props.filters, statuses: toggle(props.filters.statuses, status) })} />
      <div className="flex flex-wrap gap-2">
        {props.tagIds.map((tagId) => (
          <button
            type="button"
            key={tagId}
            onClick={() => props.onChange({ ...props.filters, tagIds: toggle(props.filters.tagIds, tagId) })}
            className={`rounded-full border px-2 py-1 font-mono text-3xs ${props.filters.tagIds.includes(tagId) ? 'border-cyan-600 bg-cyan-500/10 text-cyan-700' : 'border-border text-muted-foreground'}`}
          >
            #{tagId}
          </button>
        ))}
      </div>
    </div>
  );
}
