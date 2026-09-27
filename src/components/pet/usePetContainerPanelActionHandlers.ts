import { useCallback, type MutableRefObject } from 'react';
import { type ChatMessage, type PetConfig, type PetConfigUpdateHandler } from '../../types';
import {
  type ChatMemorySaveTarget,
  saveChatMessageToMemory,
} from '../chat/chatMemorySaveUtils';

interface UsePetContainerPanelActionHandlersOptions {
  addLog: (msg: string) => void;
  configRef: MutableRefObject<PetConfig>;
  onUpdateConfig: PetConfigUpdateHandler;
  openChatPanel: () => void;
  panelPetId: string;
  setInputValue: (value: string) => void;
}

function getMemorySaveLog(target: ChatMemorySaveTarget) {
  if (target === 'roleMemory') return '已存入角色记忆库。';
  if (target === 'groupMemory') return '已存入所选范围的群体记忆。';
  if (target === 'groupMemoryCandidate') return '已存入长期记忆候选箱，等待人工审核。';
  return '已存入聊天记忆库。';
}

export function usePetContainerPanelActionHandlers({
  addLog,
  configRef,
  onUpdateConfig,
  openChatPanel,
  panelPetId,
  setInputValue,
}: UsePetContainerPanelActionHandlersOptions) {
  const handleOpenNormalAgent = useCallback(() => {
    openChatPanel();
    setInputValue('/agent ');
  }, [openChatPanel, setInputValue]);

  const handleRequestAgentAppLaunch = useCallback(() => {
    openChatPanel();
    setInputValue('/agent \u6253\u5f00 ');
  }, [openChatPanel, setInputValue]);

  const handleSaveMessageToMemory = useCallback((
    message: ChatMessage,
    target: ChatMemorySaveTarget,
    groupId?: string,
  ) => {
    onUpdateConfig(saveChatMessageToMemory(
      configRef.current, panelPetId, message, target, groupId,
    ));
    addLog(getMemorySaveLog(target));
  }, [
    addLog,
    configRef,
    onUpdateConfig,
    panelPetId,
  ]);

  return {
    handleOpenNormalAgent,
    handleRequestAgentAppLaunch,
    handleSaveMessageToMemory,
  };
}
