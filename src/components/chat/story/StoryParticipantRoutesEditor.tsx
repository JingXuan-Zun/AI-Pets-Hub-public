import type { StoryDefinition, StoryParticipantOption, StoryParticipantRoute } from './storyTypes';

function createRoute(participantId: string, index: number): StoryParticipantRoute {
  return {
    entryCondition: index === 0 ? '故事开场即可出现。' : '当剧情自然到达其出场条件时出现。',
    entryMode: index === 0 ? 'opening' : 'condition',
    participantId,
    priority: index,
  };
}

function resolveRoutes(draft: StoryDefinition, selectedIds: string[]) {
  const existingRoutes = draft.participantRoutes ?? [];
  return selectedIds.map((participantId, index) => existingRoutes.find(
    (route) => route.participantId === participantId,
  ) ?? createRoute(participantId, index));
}

function updateRoute(
  routes: StoryParticipantRoute[],
  participantId: string,
  patch: Partial<StoryParticipantRoute>,
) {
  return routes.map((route) => route.participantId === participantId ? { ...route, ...patch } : route);
}

export function StoryParticipantRoutesEditor(props: {
  draft: StoryDefinition;
  onChange: (patch: Partial<StoryDefinition>) => void;
  participants: StoryParticipantOption[];
}) {
  const selected = props.participants.filter((participant) => props.draft.participantIds.includes(participant.id));
  const routes = resolveRoutes(props.draft, selected.map((participant) => participant.id));
  const commit = (participantId: string, patch: Partial<StoryParticipantRoute>) => {
    props.onChange({ participantRoutes: updateRoute(routes, participantId, patch) });
  };
  if (selected.length === 0) return null;
  return (
    <section className="space-y-2 rounded-lg border border-sky-100 bg-white/70 p-3">
      <div className="text-xs font-semibold text-sky-950">角色出场顺序与条件</div>
      <p className="text-[10px] leading-4 text-sky-600">角色会保留在故事总表中，但只有“开场出现”角色先参与对话，其余角色由剧情条件逐步引入。</p>
      {selected.map((participant, index) => {
        const route = routes.find((item) => item.participantId === participant.id) ?? createRoute(participant.id, index);
        return (
          <div key={participant.id} className="grid gap-2 md:grid-cols-[1fr_9rem_1fr] md:items-center">
            <span className="text-[11px] font-medium text-sky-800">{participant.name}</span>
            <select
              value={route.entryMode}
              onChange={(event) => commit(participant.id, { entryMode: event.target.value as StoryParticipantRoute['entryMode'] })}
              className="h-8 rounded-md border border-sky-100 bg-white px-2 text-[11px] text-sky-800"
            >
              <option value="opening">开场出现</option>
              <option value="condition">满足条件后出现</option>
            </select>
            <input
              value={route.entryCondition}
              onChange={(event) => commit(participant.id, { entryCondition: event.target.value })}
              placeholder="例如：用户抵达车站后出现"
              className="h-8 rounded-md border border-sky-100 bg-white px-2 text-[11px] text-sky-800"
            />
          </div>
        );
      })}
    </section>
  );
}
