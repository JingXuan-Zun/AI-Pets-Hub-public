import type { StoryDefinition, StoryParticipantOption } from './storyTypes';

export function StoryParticipantSelector(props: {
  draft: StoryDefinition;
  onChange: (patch: Partial<StoryDefinition>) => void;
  participants: StoryParticipantOption[];
}) {
  const toggleParticipant = (participantId: string, enabled: boolean) => {
    const nextIds = enabled
      ? [...props.draft.participantIds, participantId]
      : props.draft.participantIds.filter((id) => id !== participantId);
    props.onChange({ participantIds: Array.from(new Set(nextIds)) });
  };
  return (
    <section className="space-y-2">
      <div className="text-xs font-semibold text-sky-950">参与角色</div>
      <div className="flex flex-wrap gap-2">
        {props.participants.map((participant) => {
          const selected = props.draft.participantIds.includes(participant.id);
          return (
            <label
              key={participant.id}
              onMouseDown={(event) => event.preventDefault()}
              className={`flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] ${selected ? 'border-sky-800 bg-sky-950 text-white' : 'border-sky-100 bg-white text-sky-800'}`}
            >
              <input
                type="checkbox"
                checked={selected}
                onChange={(event) => toggleParticipant(participant.id, event.target.checked)}
                className="sr-only"
              />
              {participant.name}
            </label>
          );
        })}
      </div>
    </section>
  );
}
