using AiZc2.Avatar;
using AiZc2.Bridge;
using UnityEngine;

namespace AiZc2.Runtime
{
    public class AvatarRuntimeSession : MonoBehaviour
    {
        private const float PerfStatsReportIntervalSeconds = 1f;
        private const float MaxViewportDistanceScale = 4.5f;

        [SerializeField] private AvatarLoader avatarLoader;
        [SerializeField] private AvatarAnimationController animationController;
        [SerializeField] private AvatarLookAtController lookAtController;
        [SerializeField] private AvatarBoundsReporter boundsReporter;

        private AvatarBridgeTransport bridgeTransport;
        private readonly AvatarRuntimeState currentState = new AvatarRuntimeState();
        private readonly AvatarExpressionController expressionController = new AvatarExpressionController();
        private readonly AvatarSpringBoneStabilizer springBoneStabilizer = new AvatarSpringBoneStabilizer();
        private string lastReportedExpressionKey;
        private string lastReportedMotionKey;
        private float perfStatsElapsedSeconds;
        private int perfStatsFrameCount;

        public void Initialize(AvatarBridgeTransport transport)
        {
            bridgeTransport = transport;
        }

        private void Update()
        {
            if (lookAtController != null)
            {
                lookAtController.Tick(Time.deltaTime);
            }

            ReportPerfStats();

            if (bridgeTransport == null || avatarLoader == null || boundsReporter == null)
            {
                return;
            }

            if (avatarLoader.CurrentAvatarRoot == null)
            {
                return;
            }

            Bounds bounds;
            if (!boundsReporter.TryCaptureWorldBounds(avatarLoader.CurrentAvatarRoot, out bounds))
            {
                return;
            }

            AvatarVisualBoundsData data = boundsReporter.CreateBoundsData(bounds, currentState);
            if (!boundsReporter.HasMeaningfulChange(data))
            {
                return;
            }

            bridgeTransport.SendEvent(new AvatarBridgeEventEnvelope
            {
                type = "visual-bounds",
                petId = currentState.petId,
                source = "measured",
                left = data.left,
                right = data.right,
                top = data.top,
                bottom = data.bottom,
            });
        }

        public async void HandleCommand(AvatarBridgeCommandEnvelope command)
        {
            if (command == null)
            {
                return;
            }

            currentState.petId = string.IsNullOrWhiteSpace(command.petId) ? "main" : command.petId;

            try
            {
                switch (command.type)
                {
                    case "loadAvatar":
                    {
                        animationController?.Unbind();
                        expressionController.Unbind();
                        springBoneStabilizer.Unbind();
                        currentState.avatarUrl = command.modelUrl ?? "";
                        await avatarLoader.LoadAsync(currentState.avatarUrl);
                        springBoneStabilizer.Bind(avatarLoader.CurrentAvatarRoot, avatarLoader.CurrentAnimator);
                        if (animationController != null)
                        {
                            animationController.Bind(avatarLoader.CurrentAvatarRoot, avatarLoader.CurrentAnimator);
                            if (!string.IsNullOrWhiteSpace(currentState.currentMotionKey))
                            {
                                animationController.PlayMotion(currentState.currentMotionKey);
                            }
                        }

                        expressionController.Bind(avatarLoader.CurrentAvatarRoot, currentState.avatarUrl);
                        ApplyCurrentExpressionState();
                        ApplyCurrentLayoutToAvatar();
                        ApplyCurrentInteractionStateToAvatar();

                        ResetReportedSemanticState();
                        bridgeTransport?.SendEvent(new AvatarBridgeEventEnvelope
                        {
                            type = "ready",
                            petId = currentState.petId,
                        });
                        break;
                    }
                    case "setSemanticState":
                    {
                        currentState.currentMotionKey = string.IsNullOrWhiteSpace(command.motionKey)
                            ? "idle"
                            : command.motionKey;
                        currentState.currentExpressionKey = command.expressionKey ?? "";
                        currentState.currentViseme = command.viseme ?? "";
                        currentState.lookAtTarget = new Vector2(command.lookAtX, command.lookAtY);
                        currentState.dragActive = command.dragActive;
                        currentState.dragDeltaX = command.dragDeltaX;
                        currentState.dragDeltaY = command.dragDeltaY;
                        currentState.hoverRegion = command.hoverRegion ?? "";

                        animationController?.PlayMotion(currentState.currentMotionKey);
                        ApplyCurrentExpressionState();
                        lookAtController?.SetLookAtTarget(currentState.lookAtTarget);
                        ApplyCurrentInteractionStateToAvatar();
                        ReportSemanticStateChanges();
                        break;
                    }
                    case "setLayout":
                    {
                        currentState.scale = command.scale > 0f ? command.scale : 1f;
                        currentState.presentationMode = string.IsNullOrWhiteSpace(command.presentationMode)
                            ? "default"
                            : command.presentationMode;
                        currentState.screenHeight = command.screenHeight;
                        currentState.screenWidth = command.screenWidth;
                        currentState.viewportHeight = command.viewportHeight;
                        currentState.viewportWidth = command.viewportWidth;
                        currentState.viewportX = command.viewportX;
                        currentState.viewportY = command.viewportY;

                        ApplyCurrentLayoutToAvatar();
                        break;
                    }
                    case "setVisibility":
                    {
                        currentState.visible = command.visible;
                        if (avatarLoader != null && avatarLoader.CurrentAvatarRoot != null)
                        {
                            avatarLoader.CurrentAvatarRoot.SetActive(currentState.visible);
                        }
                        break;
                    }
                }
            }
            catch (System.Exception ex)
            {
                bridgeTransport?.SendEvent(new AvatarBridgeEventEnvelope
                {
                    type = "error",
                    petId = currentState.petId,
                    errorMessage = ex.Message,
                });
            }
        }

        public void DisposeSession()
        {
            expressionController.Unbind();
            springBoneStabilizer.Unbind();
            animationController?.Unbind();
            avatarLoader?.Unload();
        }

        private void ResetReportedSemanticState()
        {
            lastReportedExpressionKey = null;
            lastReportedMotionKey = null;
        }

        private void ApplyCurrentLayoutToAvatar()
        {
            if (avatarLoader == null || avatarLoader.CurrentAvatarRoot == null)
            {
                return;
            }

            avatarLoader.ApplyPresentationScale(currentState.scale);
            if (TryResolveViewportAnchor(out float anchorX, out float anchorY, out float viewportDistanceScale))
            {
                avatarLoader.ApplyScreenAnchor(true, anchorX, anchorY, viewportDistanceScale);
                return;
            }

            avatarLoader.ApplyScreenAnchor(false, 0.5f, 0.5f, 1f);
        }

        private void ApplyCurrentInteractionStateToAvatar()
        {
            if (avatarLoader == null || avatarLoader.CurrentAvatarRoot == null)
            {
                return;
            }

            avatarLoader.ApplyInteractionState(
                currentState.dragActive,
                currentState.dragDeltaX,
                currentState.dragDeltaY,
                currentState.hoverRegion);
        }

        private void ApplyCurrentExpressionState()
        {
            var result = expressionController.ApplyState(
                currentState.currentExpressionKey,
                currentState.currentViseme);
            AvatarExpressionDiagnosticReporter.Send(bridgeTransport, currentState.petId, result);
        }

        private bool TryResolveViewportAnchor(out float anchorX, out float anchorY, out float viewportDistanceScale)
        {
            anchorX = 0.5f;
            anchorY = 0.5f;
            viewportDistanceScale = 1f;
            if (currentState.viewportWidth <= 0f || currentState.viewportHeight <= 0f)
            {
                return false;
            }

            float safeScreenWidth = currentState.screenWidth > 0f ? currentState.screenWidth : Screen.width;
            float safeScreenHeight = currentState.screenHeight > 0f ? currentState.screenHeight : Screen.height;
            if (safeScreenWidth <= 0f || safeScreenHeight <= 0f)
            {
                return false;
            }

            anchorX = Mathf.Clamp01((currentState.viewportX + currentState.viewportWidth * 0.5f) / safeScreenWidth);
            anchorY = Mathf.Clamp01((currentState.viewportY + currentState.viewportHeight * 0.5f) / safeScreenHeight);
            float widthDistanceScale = safeScreenWidth / Mathf.Max(1f, currentState.viewportWidth);
            float heightDistanceScale = safeScreenHeight / Mathf.Max(1f, currentState.viewportHeight);
            viewportDistanceScale = Mathf.Clamp(Mathf.Min(widthDistanceScale, heightDistanceScale), 1f, MaxViewportDistanceScale);
            return true;
        }

        private void ReportSemanticStateChanges()
        {
            if (bridgeTransport == null)
            {
                return;
            }

            if (lastReportedMotionKey != currentState.currentMotionKey)
            {
                lastReportedMotionKey = currentState.currentMotionKey;
                bridgeTransport.SendEvent(new AvatarBridgeEventEnvelope
                {
                    type = "motion-state-changed",
                    petId = currentState.petId,
                    motionKey = currentState.currentMotionKey,
                });
            }

            if (lastReportedExpressionKey != currentState.currentExpressionKey)
            {
                lastReportedExpressionKey = currentState.currentExpressionKey;
                bridgeTransport.SendEvent(new AvatarBridgeEventEnvelope
                {
                    type = "expression-state-changed",
                    petId = currentState.petId,
                    expressionKey = currentState.currentExpressionKey,
                });
            }
        }

        private void ReportPerfStats()
        {
            if (bridgeTransport == null)
            {
                return;
            }

            perfStatsFrameCount += 1;
            perfStatsElapsedSeconds += Time.unscaledDeltaTime;
            if (perfStatsElapsedSeconds < PerfStatsReportIntervalSeconds)
            {
                return;
            }

            float safeElapsedSeconds = Mathf.Max(perfStatsElapsedSeconds, 0.0001f);
            float fps = perfStatsFrameCount / safeElapsedSeconds;
            float frameIntervalMs = perfStatsFrameCount > 0
                ? safeElapsedSeconds * 1000f / perfStatsFrameCount
                : 0f;

            bridgeTransport.SendEvent(new AvatarBridgeEventEnvelope
            {
                type = "perf-stats",
                petId = currentState.petId,
                fps = fps,
                frameIntervalMs = frameIntervalMs,
            });

            perfStatsFrameCount = 0;
            perfStatsElapsedSeconds = 0f;
        }
    }
}
