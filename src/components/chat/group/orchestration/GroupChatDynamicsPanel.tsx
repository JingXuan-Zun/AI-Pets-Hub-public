import { Activity, Link2, MessageCircleQuestion } from 'lucide-react';
import type { PetConfig, ChatMessage } from '../../../../types';
import { buildGroupTopicKey, findGroupTopicSnapshot } from '../../../../group-topic';
import type { ChatTargetOption } from '../../multiPetChat';
import { analyzeGroupConversationProgress } from '../topic/groupConversationProgressPolicy';

interface GroupChatDynamicsPanelProps {
  config: PetConfig;
  isGroupChatRunning: boolean;
  messages: ChatMessage[];
  petOptions: ChatTargetOption[];
}

const TOPIC_LABELS: Record<string, string> = {
  active: '讨论中',
  starting: '刚开始',
  disputed: '存在分歧',
  'waiting-information': '等待信息',
  resolving: '正在收束',
  concluded: '阶段结论',
  decaying: '自然冷却',
  closed: '已结束',
  archived: '已归档',
};

function resolveLatestModelMessage(messages: ChatMessage[]) {
  return [...messages].reverse().find((message) => (
    message.role === 'model' && message.chatMode === 'group'
  ));
}

function resolveTopic(config: PetConfig, petOptions: ChatTargetOption[]) {
  const key = buildGroupTopicKey(petOptions.map((option) => option.id));
  return findGroupTopicSnapshot(config.groupTopicRepository, key);
}

function resolveCandidateLabel(candidate: PetConfig['directedRelationshipRepository']['candidates'][number]) {
  return `${candidate.sourceRoleName} → ${candidate.targetRoleName}`;
}

function GroupMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-sky-600">{label}</span>
      <span className="min-w-0 truncate text-right text-sky-950">{value}</span>
    </div>
  );
}

export function GroupChatDynamicsPanel({
  config,
  isGroupChatRunning,
  messages,
  petOptions,
}: GroupChatDynamicsPanelProps) {
  const topic = resolveTopic(config, petOptions);
  const latestMessage = resolveLatestModelMessage(messages);
  const activeRoleIds = new Set(petOptions.map((option) => option.id));
  const roleNames = new Map(petOptions.map((option) => [option.id, option.name]));
  const pendingCandidates = config.directedRelationshipRepository.candidates
    .filter((candidate) => candidate.status === 'pending'
      && activeRoleIds.has(candidate.sourceRoleId) && activeRoleIds.has(candidate.targetRoleId))
    .slice(-2)
    .reverse();
  const activeRelationships = config.directedRelationshipRepository.records
    .filter((record) => activeRoleIds.has(record.sourceRoleId) && activeRoleIds.has(record.targetRoleId))
    .slice(-2)
    .reverse();
  const currentSpeaker = latestMessage?.petName?.trim() || '等待发言';
  const progress = analyzeGroupConversationProgress(messages);
  const userTopic = topic?.groupUserTopicState;
  const topicStatus = topic?.topicStatus ? TOPIC_LABELS[topic.topicStatus] ?? topic.topicStatus : '尚未建立';
  const action = !isGroupChatRunning
    ? '已暂停'
    : topic?.topicStatus === 'resolving'
      ? '正在总结'
      : topic?.topicStatus === 'waiting-information'
        ? '等待信息'
        : '继续讨论';

  return (
    <section className="space-y-2 rounded-md border border-sky-100 bg-sky-50/50 px-2.5 py-2 text-[10px] leading-relaxed">
      <div className="flex items-center gap-1 font-semibold text-sky-950">
        <Activity className="h-3 w-3" /> 群聊动态
      </div>
      <div className="space-y-1 border-b border-sky-100 pb-2">
        <GroupMetric label="当前话题" value={topic?.currentTopicId ? '当前活动话题' : '新话题'} />
        <GroupMetric label="话题状态" value={topicStatus} />
        <GroupMetric label="当前动作" value={action} />
        <GroupMetric label="最近发言" value={currentSpeaker} />
        <GroupMetric label="用户话题" value={userTopic ? `${userTopic.answeredRoleIds.length}/${userTopic.answeredRoleIds.length + userTopic.remainingRoleIds.length} 已回应` : '无'} />
        <GroupMetric label="停滞计数" value={`${progress.stagnantTurnCount} 轮`} />
        <GroupMetric label="最近贡献" value={latestMessage?.groupContributionSignal ?? '未标记'} />
      </div>
      <div className="space-y-1">
        <div className="flex items-center gap-1 font-semibold text-sky-950">
          <Link2 className="h-3 w-3" /> 关系变化
        </div>
        {pendingCandidates.length ? pendingCandidates.map((candidate) => (
          <div key={candidate.id} className="truncate text-amber-800">
            {resolveCandidateLabel(candidate)} · 待确认
          </div>
        )) : activeRelationships.length ? activeRelationships.map((record) => (
          <div key={record.id} className="truncate text-sky-700">
            {roleNames.get(record.sourceRoleId) ?? '角色'} → {record.targetRoleName ?? roleNames.get(record.targetRoleId) ?? '角色'}
            {' · '}信任 {record.dimensions.trust}
          </div>
        )) : <div className="text-sky-600">暂无关系变化记录</div>}
      </div>
      <div className="flex items-start gap-1 border-t border-sky-100 pt-2 text-sky-600">
        <MessageCircleQuestion className="mt-0.5 h-3 w-3 shrink-0" />
        <span>用户可随时插话；话题停滞时会询问是否继续。</span>
      </div>
    </section>
  );
}
