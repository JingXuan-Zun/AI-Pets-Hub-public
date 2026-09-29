import { useCallback, useState } from 'react';
import type { PetConfig } from '../../types';
import type { ExpressionReplySettings } from '../../expression/expressionSettings';
import type { ExpressionLibraryReadiness } from '../../expression/expressionLibraryReadiness';
import { ExpressionLibraryManager } from './ExpressionLibraryManager';
import { ExpressionReplyWeights } from './ExpressionReplyWeights';

interface SettingsExpressionLibraryTabProps {
  localConfig: PetConfig;
  onApplyConfig: (config: PetConfig) => void;
}

export function SettingsExpressionLibraryTab({ localConfig, onApplyConfig }: SettingsExpressionLibraryTabProps) {
  const [imageCandidateCount, setImageCandidateCount] = useState(0);
  const [readiness, setReadiness] = useState<ExpressionLibraryReadiness | null>(null);
  const [reviewRequest, setReviewRequest] = useState(0);
  const [refreshRequest, setRefreshRequest] = useState(0);
  const updateImageCandidateCount = useCallback((count: number) => setImageCandidateCount(count), []);
  const applyReplySettings = (expressionReply: ExpressionReplySettings) => {
    onApplyConfig({
      ...localConfig,
      settings: { ...localConfig.settings, expressionReply },
    });
  };

  return (
    <div className="space-y-3 pb-3">
      <div className="rounded-lg border border-border bg-secondary/20 px-3 py-2.5">
        <h2 className="text-base font-semibold">表情包</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">设置回复比例，管理图片表情与分类语义。</p>
      </div>
      <ExpressionReplyWeights imageCandidateCount={imageCandidateCount} readiness={readiness} settings={localConfig.settings.expressionReply} onChange={applyReplySettings}
        onReview={() => setReviewRequest((value) => value + 1)} onRefresh={() => setRefreshRequest((value) => value + 1)} />
      <ExpressionLibraryManager
        enabled={localConfig.settings.expressionReply.imageLibraryEnabled}
        selectedMode={localConfig.settings.expressionReply.imageLibraryMode}
        onImageCandidateCountChange={updateImageCandidateCount}
        onReadinessChange={setReadiness}
        reviewRequest={reviewRequest}
        refreshRequest={refreshRequest}
        onSelectedModeChange={(imageLibraryMode) => applyReplySettings({
          ...localConfig.settings.expressionReply,
          imageLibraryMode,
        })}
        onEnabledChange={(imageLibraryEnabled) => applyReplySettings({
          ...localConfig.settings.expressionReply,
          imageLibraryEnabled,
          imageLibraryWeightInitialized: true,
          imageStickerWeight: localConfig.settings.expressionReply.imageStickerWeight,
        })}
      />
    </div>
  );
}
