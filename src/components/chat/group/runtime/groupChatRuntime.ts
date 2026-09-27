import type { DesktopPetGroupChatContinuationMode } from '../../../../chatState';
import { GroupRuntimeController } from './groupRuntimeController';
import { shouldContinueGroupTopic } from '../topic/topicLifecycle';

export class GroupChatRuntime {
  readonly controller: GroupRuntimeController;

  constructor(options: {
    activeRoleIds: string[];
    groupSessionId: string;
    mode: DesktopPetGroupChatContinuationMode;
  }) {
    this.controller = new GroupRuntimeController(options);
  }

  beginPlanning() {
    this.controller.beginPlanning();
  }

  async runTurn<T>(options: {
    continueOnError?: boolean;
    replyTargetIds?: string[];
    speakerId: string;
    turnId: string;
    execute: () => Promise<T>;
  }) {
    this.controller.beginSpeaking({
      turnId: options.turnId,
      speakerId: options.speakerId,
      replyTargetIds: options.replyTargetIds,
    });
    try {
      const result = await options.execute();
      this.controller.completeSpeaker(options.speakerId);
      return result;
    } catch (error) {
      if (options.continueOnError) {
        this.controller.completeSpeaker(options.speakerId);
        return undefined;
      }
      this.controller.fail();
      throw error;
    }
  }

  waitForNextSpeaker(turnQueue: string[]) {
    this.controller.waitForNextSpeaker(turnQueue);
  }

  complete() {
    const status = this.controller.getSnapshot().status;
    if (status === 'idle' || status === 'completed' || status === 'cancelled') {
      return;
    }
    this.controller.complete();
  }

  cancel() {
    this.controller.cancel();
  }

  canContinue() {
    const snapshot = this.controller.getSnapshot();
    const sessionCanContinue = snapshot.status !== 'completed'
      && snapshot.status !== 'cancelled' && snapshot.status !== 'failed';
    return sessionCanContinue && (!snapshot.topicStatus || shouldContinueGroupTopic(snapshot.topicStatus));
  }
}
