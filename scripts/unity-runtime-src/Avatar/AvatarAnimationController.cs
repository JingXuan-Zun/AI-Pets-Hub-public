using System;
using System.Collections.Generic;
using System.Reflection;
using UniVRM10;
using UnityEngine;

namespace AiZc2.Avatar
{
    [DefaultExecutionOrder(12050)]
    public class AvatarAnimationController : MonoBehaviour
    {
        private struct TransformSnapshot
        {
            public Vector3 localPosition;
            public Quaternion localRotation;
            public Vector3 localScale;
        }

        [Serializable]
        private class MotionBinding
        {
            public string displayName = "";
            public string motionKey = "idle";
            public GameObject vrmaPrefab;
            public bool playOnBind;
            public WrapMode wrapMode = WrapMode.Loop;
            public bool lockPlanarRootMotion = true;
            public bool lockVerticalRootMotion = true;
            public bool lockHorizontalBodyPosition = false;
            public float horizontalBodyPositionScale = 1f;
        }

        [SerializeField] private MotionBinding[] motionBindings = Array.Empty<MotionBinding>();
        [SerializeField] private bool stopPlaybackWhenMotionMissing = false;

        private GameObject currentAvatarRoot;
        private Vrm10Instance currentVrmInstance;
        private Vrm10Runtime currentRuntime;
        private MotionBinding currentMotionBinding;
        private Animator currentTargetAnimator;
        private UnityEngine.Avatar currentTargetOriginalAvatar;
        private GameObject currentVrmaRoot;
        private Vrm10AnimationInstance currentVrmaInstance;
        private Animation currentAnimation;
        private HumanPoseHandler sourceHumanPoseHandler;
        private HumanPoseHandler targetHumanPoseHandler;
        private HumanPose sourceHumanPose;
        private HumanPose targetHumanPose;
        private Vector3 sourceRestBodyPosition;
        private Quaternion sourceRestBodyRotation = Quaternion.identity;
        private Vector3 targetRestBodyPosition;
        private Quaternion targetRestBodyRotation = Quaternion.identity;
        private float sourceHumanScale = 1f;
        private float targetHumanScale = 1f;
        private bool hasSourceRestBodyPose;
        private bool hasTargetRestBodyPose;
        private bool useHumanPoseTransfer;
        private bool useManualRuntimeProcessing;
        private bool hasCapturedOriginalUpdateType;
        private Vrm10Instance.UpdateTypes originalUpdateType;
        private UnityEngine.Avatar generatedTargetHumanoidAvatar;
        private readonly Dictionary<Transform, TransformSnapshot> currentAvatarInitialTransformStates = new Dictionary<Transform, TransformSnapshot>();

        public string CurrentMotionKey { get; private set; } = "idle";

        public void Bind(GameObject avatarRoot, Animator targetAnimator)
        {
            currentAvatarRoot = avatarRoot;
            currentTargetAnimator = targetAnimator;
            currentTargetOriginalAvatar = targetAnimator != null ? targetAnimator.avatar : null;
            currentVrmInstance = currentAvatarRoot != null
                ? currentAvatarRoot.GetComponentInChildren<Vrm10Instance>()
                : null;

            ClearPlayback();

            if (currentVrmInstance == null)
            {
                Debug.Log("[AvatarAnimationController] Active avatar is not a VRM instance. VRMA playback is disabled for this avatar.");
                return;
            }

            CaptureCurrentAvatarInitialTransformStates();

            foreach (var binding in motionBindings)
            {
                if (binding != null && binding.playOnBind)
                {
                    PlayMotion(binding.motionKey);
                    return;
                }
            }
        }

        public void PlayMotion(string motionKey)
        {
            CurrentMotionKey = string.IsNullOrWhiteSpace(motionKey) ? "idle" : motionKey;
            if (currentVrmInstance == null)
            {
                Debug.Log($"[AvatarAnimationController] Ignore motion '{CurrentMotionKey}': no active VRM instance.");
                return;
            }

            var binding = FindMotionBinding(CurrentMotionKey);
            if (binding == null || binding.vrmaPrefab == null)
            {
                if (stopPlaybackWhenMotionMissing)
                {
                    ClearPlayback();
                }

                Debug.Log($"[AvatarAnimationController] No VRMA binding found for motion '{CurrentMotionKey}'.");
                return;
            }

            StartPlayback(binding);
        }

        public void Unbind()
        {
            ClearPlayback();
            currentAvatarRoot = null;
            currentVrmInstance = null;
            currentRuntime = null;
            currentMotionBinding = null;
            currentTargetAnimator = null;
            currentTargetOriginalAvatar = null;
            CurrentMotionKey = "idle";
            currentAvatarInitialTransformStates.Clear();
        }

        private void LateUpdate()
        {
            if (!HasLiveAvatarBinding())
            {
                if (currentRuntime != null || currentVrmaRoot != null || useHumanPoseTransfer || useManualRuntimeProcessing)
                {
                    ClearPlayback();
                }

                return;
            }

            try
            {
                if (useManualRuntimeProcessing)
                {
                    if (currentRuntime == null)
                    {
                        return;
                    }

                    ApplyHumanPoseTransfer();
                    currentRuntime.Process();
                    return;
                }

                ApplyHumanPoseTransfer();
            }
            catch (MissingReferenceException ex)
            {
                Debug.LogWarning($"[AvatarAnimationController] Cleared stale playback after avatar object was destroyed: {ex.Message}");
                ClearPlayback();
            }
            catch (NullReferenceException ex)
            {
                Debug.LogWarning($"[AvatarAnimationController] Cleared stale playback after avatar runtime became invalid: {ex.Message}");
                ClearPlayback();
            }
        }

        private bool HasLiveAvatarBinding()
        {
            return currentAvatarRoot != null && currentVrmInstance != null;
        }

        private void ApplyHumanPoseTransfer()
        {
            if (!useHumanPoseTransfer || sourceHumanPoseHandler == null || targetHumanPoseHandler == null)
            {
                return;
            }

            sourceHumanPoseHandler.GetHumanPose(ref sourceHumanPose);
            if (sourceHumanPose.muscles == null || sourceHumanPose.muscles.Length == 0)
            {
                return;
            }

            if (targetHumanPose.muscles == null || targetHumanPose.muscles.Length != sourceHumanPose.muscles.Length)
            {
                targetHumanPose.muscles = (float[])sourceHumanPose.muscles.Clone();
            }
            else
            {
                Array.Copy(sourceHumanPose.muscles, targetHumanPose.muscles, sourceHumanPose.muscles.Length);
            }

            targetHumanPose.bodyPosition = ResolveTargetBodyPosition();
            targetHumanPose.bodyRotation = ResolveTargetBodyRotation();
            targetHumanPoseHandler.SetHumanPose(ref targetHumanPose);
        }

        private MotionBinding FindMotionBinding(string motionKey)
        {
            foreach (var binding in motionBindings)
            {
                if (binding == null || string.IsNullOrWhiteSpace(binding.motionKey))
                {
                    continue;
                }

                if (string.Equals(binding.motionKey, motionKey, StringComparison.OrdinalIgnoreCase))
                {
                    return binding;
                }
            }

            return null;
        }

        private void StartPlayback(MotionBinding binding)
        {
            if (binding == null || binding.vrmaPrefab == null || currentVrmInstance == null)
            {
                return;
            }

            ClearPlayback();

            var runtime = GetOrCreateRuntime();
            currentRuntime = runtime;
            if (runtime == null)
            {
                Debug.LogWarning("[AvatarAnimationController] Failed to create Vrm10 runtime for VRMA playback.");
                return;
            }

            RestoreCurrentAvatarInitialTransformStates(runtime);
            HideEditorOnlyRuntimeHelpers(currentAvatarRoot);

            currentVrmaRoot = Instantiate(binding.vrmaPrefab);
            currentVrmaRoot.name = $"VrmaRuntime ({binding.vrmaPrefab.name})";
            currentVrmaRoot.transform.SetParent(null, false);
            currentVrmaRoot.transform.position = Vector3.zero;
            currentVrmaRoot.transform.rotation = Quaternion.identity;
            currentVrmaRoot.transform.localScale = Vector3.one;
            StripVrmaHelperSpringBoneDebugComponents(currentVrmaRoot);
            HideEditorOnlyRuntimeHelpers(currentVrmaRoot);

            currentVrmaInstance = currentVrmaRoot.GetComponent<Vrm10AnimationInstance>();
            currentAnimation = currentVrmaRoot.GetComponent<Animation>();

            if (currentVrmaInstance == null || currentAnimation == null)
            {
                Debug.LogWarning($"[AvatarAnimationController] VRMA prefab '{binding.vrmaPrefab.name}' is missing Vrm10AnimationInstance or Animation.");
                ClearPlayback();
                return;
            }

            RebuildVrmaControlRigIfNeeded();
            HideVrmaVisuals();

            currentAnimation.playAutomatically = false;
            currentAnimation.cullingType = AnimationCullingType.AlwaysAnimate;
            currentAnimation.wrapMode = binding.wrapMode;

            foreach (AnimationState state in currentAnimation)
            {
                state.enabled = true;
                state.wrapMode = binding.wrapMode;
                state.speed = 1f;
            }

            currentAnimation.Play();
            currentMotionBinding = binding;
            SetupHumanPoseTransfer();

            if (useHumanPoseTransfer)
            {
                EnableManualRuntimeProcessing(runtime);
            }
            else
            {
                DisableManualRuntimeProcessing();
                runtime.VrmAnimation = currentVrmaInstance;
            }

            var sourceAnimator = currentVrmaRoot.GetComponent<Animator>();
            string playbackMode = useManualRuntimeProcessing
                ? "manualControlRigHumanPose"
                : "legacyRelativeBodyTransfer";
            Debug.Log(
                $"[VRMA-SWITCH] motion={binding.motionKey}, " +
                $"provider={currentVrmaInstance.ControlRig.Item1?.GetType().Name ?? "null"}, " +
                $"sourceHuman={(sourceAnimator != null && sourceAnimator.isHuman)}, " +
                $"sourceAvatarValid={(sourceAnimator != null && sourceAnimator.avatar != null && sourceAnimator.avatar.isValid)}, " +
                $"targetTransfer={useHumanPoseTransfer}, mode={playbackMode}"
            );
        }

        private void ClearPlayback()
        {
            var runtime = GetExistingRuntime();
            if (runtime != null)
            {
                runtime.VrmAnimation = null;
                if (runtime.ControlRig != null)
                {
                    Vrm10Retarget.EnforceTPose((runtime.ControlRig, runtime.ControlRig));
                }

                RestoreCurrentAvatarInitialTransformStates(runtime);
            }

            if (currentAnimation != null)
            {
                currentAnimation.Stop();
            }

            if (currentVrmaRoot != null)
            {
                Destroy(currentVrmaRoot);
            }

            currentVrmaRoot = null;
            currentVrmaInstance = null;
            currentAnimation = null;
            currentRuntime = null;
            currentMotionBinding = null;
            DisableManualRuntimeProcessing();
            ResetHumanPoseTransfer();

            if (generatedTargetHumanoidAvatar != null)
            {
                Destroy(generatedTargetHumanoidAvatar);
                generatedTargetHumanoidAvatar = null;
            }
        }

        private Vrm10Runtime GetExistingRuntime()
        {
            if (currentVrmInstance == null)
            {
                return null;
            }

            var runtimeField = typeof(Vrm10Instance).GetField("m_runtime", BindingFlags.Instance | BindingFlags.NonPublic);
            if (runtimeField == null)
            {
                return null;
            }

            return runtimeField.GetValue(currentVrmInstance) as Vrm10Runtime;
        }

        private Vrm10Runtime GetOrCreateRuntime()
        {
            return currentVrmInstance != null ? currentVrmInstance.Runtime : null;
        }

        private void RebuildVrmaControlRigIfNeeded()
        {
            if (currentVrmaInstance == null)
            {
                return;
            }

            var humanoid = currentVrmaRoot.GetComponent<UniHumanoid.Humanoid>();
            if (humanoid == null)
            {
                humanoid = currentVrmaRoot.AddComponent<UniHumanoid.Humanoid>();
            }

            if (humanoid.AssignBonesFromAnimator())
            {
                var poseProvider = new VrmaRuntimePoseProvider(currentVrmaRoot.transform, humanoid);
                var tPoseProvider = new InitRotationPoseProvider(currentVrmaRoot.transform, humanoid);
                currentVrmaInstance.ControlRig = (poseProvider, tPoseProvider);
                return;
            }

            var animator = currentVrmaRoot.GetComponent<Animator>();
            if (animator != null && animator.avatar != null && animator.isHuman)
            {
                var animatorProvider = new AnimatorPoseProvider(currentVrmaRoot.transform, animator);
                currentVrmaInstance.ControlRig = (animatorProvider, animatorProvider);
                Debug.LogWarning("[AvatarAnimationController] Fell back to AnimatorPoseProvider because humanoid bone assignment failed.");
                return;
            }

            throw new InvalidOperationException("VRMA helper object could not assign humanoid bones from Animator.");
        }

        private void SetupHumanPoseTransfer()
        {
            ResetHumanPoseTransfer();

            var sourceAnimator = currentVrmaRoot != null ? currentVrmaRoot.GetComponent<Animator>() : null;
            if (sourceAnimator == null || sourceAnimator.avatar == null || !sourceAnimator.avatar.isValid || !sourceAnimator.avatar.isHuman)
            {
                Debug.LogWarning("[AvatarAnimationController] HumanPose transfer disabled: VRMA source animator is not a valid humanoid avatar.");
                return;
            }

            if (generatedTargetHumanoidAvatar != null)
            {
                Destroy(generatedTargetHumanoidAvatar);
                generatedTargetHumanoidAvatar = null;
            }

            var targetAvatar = ResolveTargetAvatarForTransfer();

            if (currentTargetAnimator == null || targetAvatar == null || !targetAvatar.isValid || !targetAvatar.isHuman)
            {
                Debug.LogWarning("[AvatarAnimationController] HumanPose transfer disabled: target animator is not a valid humanoid avatar.");
                return;
            }

            sourceHumanPoseHandler = new HumanPoseHandler(sourceAnimator.avatar, sourceAnimator.transform);
            targetHumanPoseHandler = new HumanPoseHandler(targetAvatar, currentTargetAnimator.transform);

            sourceHumanPoseHandler.GetHumanPose(ref sourceHumanPose);
            sourceRestBodyPosition = sourceHumanPose.bodyPosition;
            sourceRestBodyRotation = sourceHumanPose.bodyRotation;
            sourceHumanScale = ResolveHumanScale(sourceAnimator);
            hasSourceRestBodyPose = true;

            targetHumanPoseHandler.GetHumanPose(ref targetHumanPose);
            targetRestBodyPosition = targetHumanPose.bodyPosition;
            targetRestBodyRotation = targetHumanPose.bodyRotation;
            targetHumanScale = ResolveHumanScale(currentTargetAnimator);
            hasTargetRestBodyPose = true;

            useHumanPoseTransfer = true;
        }

        private UnityEngine.Avatar ResolveTargetAvatarForTransfer()
        {
            if (currentTargetAnimator != null &&
                currentTargetAnimator.avatar != null &&
                currentTargetAnimator.avatar.isValid &&
                currentTargetAnimator.avatar.isHuman)
            {
                return currentTargetAnimator.avatar;
            }

            var targetAvatar = currentTargetOriginalAvatar;
            if ((targetAvatar == null || !targetAvatar.isValid || !targetAvatar.isHuman) &&
                currentVrmInstance != null &&
                currentVrmInstance.Humanoid != null)
            {
                generatedTargetHumanoidAvatar = currentVrmInstance.Humanoid.CreateAvatar();
                if (generatedTargetHumanoidAvatar != null)
                {
                    generatedTargetHumanoidAvatar.name = "Generated Runtime Target Avatar";
                    targetAvatar = generatedTargetHumanoidAvatar;
                }
            }

            return targetAvatar;
        }

        private void ResetHumanPoseTransfer()
        {
            sourceHumanPoseHandler = null;
            targetHumanPoseHandler = null;
            hasSourceRestBodyPose = false;
            hasTargetRestBodyPose = false;
            useHumanPoseTransfer = false;
            sourceHumanScale = 1f;
            targetHumanScale = 1f;
        }

        private void EnableManualRuntimeProcessing(Vrm10Runtime runtime)
        {
            if (currentVrmInstance == null || runtime == null)
            {
                return;
            }

            if (!hasCapturedOriginalUpdateType)
            {
                originalUpdateType = currentVrmInstance.UpdateType;
                hasCapturedOriginalUpdateType = true;
            }

            currentVrmInstance.UpdateType = Vrm10Instance.UpdateTypes.None;
            runtime.VrmAnimation = null;
            useManualRuntimeProcessing = true;
        }

        private void DisableManualRuntimeProcessing()
        {
            if (currentVrmInstance != null && hasCapturedOriginalUpdateType)
            {
                currentVrmInstance.UpdateType = originalUpdateType;
            }

            hasCapturedOriginalUpdateType = false;
            originalUpdateType = default;
            useManualRuntimeProcessing = false;
        }

        private void CaptureCurrentAvatarInitialTransformStates()
        {
            currentAvatarInitialTransformStates.Clear();
            if (currentVrmInstance == null)
            {
                return;
            }

            var property = currentVrmInstance.GetType().GetProperty("DefaultTransformStates", BindingFlags.Instance | BindingFlags.Public);
            var defaultTransformStates = property?.GetValue(currentVrmInstance) as System.Collections.IEnumerable;
            if (defaultTransformStates == null)
            {
                return;
            }

            foreach (var entry in defaultTransformStates)
            {
                if (entry == null)
                {
                    continue;
                }

                var entryType = entry.GetType();
                var key = entryType.GetProperty("Key")?.GetValue(entry) as Transform;
                var value = entryType.GetProperty("Value")?.GetValue(entry);
                if (key == null || value == null || !TryCreateSnapshot(value, out var snapshot))
                {
                    continue;
                }

                currentAvatarInitialTransformStates[key] = snapshot;
            }
        }

        private void RestoreCurrentAvatarInitialTransformStates(Vrm10Runtime runtime)
        {
            foreach (var pair in currentAvatarInitialTransformStates)
            {
                if (pair.Key == null)
                {
                    continue;
                }

                pair.Key.localPosition = pair.Value.localPosition;
                pair.Key.localRotation = pair.Value.localRotation;
                pair.Key.localScale = pair.Value.localScale;
            }

            runtime?.SpringBone?.RestoreInitialTransform();
        }

        private Vector3 ResolveTargetBodyPosition()
        {
            if (!hasSourceRestBodyPose || !hasTargetRestBodyPose)
            {
                return targetRestBodyPosition;
            }

            return targetRestBodyPosition + (sourceHumanPose.bodyPosition - sourceRestBodyPosition);
        }

        private Quaternion ResolveTargetBodyRotation()
        {
            if (!hasSourceRestBodyPose || !hasTargetRestBodyPose)
            {
                return targetRestBodyRotation;
            }

            Quaternion relativeBodyRotation = Quaternion.Inverse(sourceRestBodyRotation) * sourceHumanPose.bodyRotation;
            return targetRestBodyRotation * relativeBodyRotation;
        }

        private static bool TryGetHorizontalDirection(Vector3 direction, out Vector3 horizontalDirection)
        {
            horizontalDirection = Vector3.ProjectOnPlane(direction, Vector3.up);
            if (horizontalDirection.sqrMagnitude <= 0.000001f)
            {
                horizontalDirection = Vector3.zero;
                return false;
            }

            horizontalDirection.Normalize();
            return true;
        }

        private static float ResolveHumanScale(Animator animator)
        {
            if (animator == null || animator.avatar == null || !animator.avatar.isValid || !animator.avatar.isHuman)
            {
                return 1f;
            }

            return Mathf.Max(0.0001f, animator.humanScale);
        }

        private static bool TryCreateSnapshot(object source, out TransformSnapshot snapshot)
        {
            snapshot = default;
            var sourceType = source.GetType();

            var localPosition = sourceType.GetProperty("LocalPosition")?.GetValue(source);
            var localRotation = sourceType.GetProperty("LocalRotation")?.GetValue(source);
            var localScale = sourceType.GetProperty("LocalScale")?.GetValue(source);

            if (localPosition is not Vector3 position ||
                localRotation is not Quaternion rotation ||
                localScale is not Vector3 scale)
            {
                return false;
            }

            snapshot = new TransformSnapshot
            {
                localPosition = position,
                localRotation = rotation,
                localScale = scale,
            };
            return true;
        }

        private void HideVrmaVisuals()
        {
            if (currentVrmaInstance != null)
            {
                currentVrmaInstance.ShowBoxMan(false);
            }

            if (currentVrmaRoot == null)
            {
                return;
            }

            foreach (var renderer in currentVrmaRoot.GetComponentsInChildren<Renderer>(true))
            {
                renderer.enabled = false;
            }
        }

        private static void StripVrmaHelperSpringBoneDebugComponents(GameObject root)
        {
            if (root == null)
            {
                return;
            }

            DestroyComponents(root.GetComponentsInChildren<VRM10SpringBoneJoint>(true));
            DestroyComponents(root.GetComponentsInChildren<VRM10SpringBoneCollider>(true));
            DestroyComponents(root.GetComponentsInChildren<VRM10SpringBoneColliderGroup>(true));
        }

        private static void HideEditorOnlyRuntimeHelpers(GameObject root)
        {
#if UNITY_EDITOR
            if (root == null)
            {
                return;
            }

            foreach (var transform in root.GetComponentsInChildren<Transform>(true))
            {
                if (transform == null)
                {
                    continue;
                }

                if (!ShouldHideEditorHelperTransform(transform))
                {
                    continue;
                }

                ApplyEditorOnlyHelperHideFlagsRecursively(transform);
            }
#endif
        }

        private static void DestroyComponents<T>(T[] components) where T : Component
        {
            if (components == null || components.Length == 0)
            {
                return;
            }

            foreach (var component in components)
            {
                if (component == null)
                {
                    continue;
                }

                if (Application.isPlaying)
                {
                    UnityEngine.Object.Destroy(component);
                }
                else
                {
                    UnityEngine.Object.DestroyImmediate(component);
                }
            }
        }

        private static bool ShouldHideEditorHelperTransform(Transform transform)
        {
            if (transform == null)
            {
                return false;
            }

            return string.Equals(transform.name, "Runtime Control Rig", StringComparison.Ordinal)
                || transform.name.StartsWith("VrmaRuntime (", StringComparison.Ordinal);
        }

        private static void ApplyEditorOnlyHelperHideFlagsRecursively(Transform root)
        {
            if (root == null)
            {
                return;
            }

            const HideFlags hiddenHelperFlags = HideFlags.HideInHierarchy | HideFlags.NotEditable;
            foreach (var transform in root.GetComponentsInChildren<Transform>(true))
            {
                transform.gameObject.hideFlags = hiddenHelperFlags;

                foreach (var component in transform.GetComponents<Component>())
                {
                    if (component == null)
                    {
                        continue;
                    }

                    component.hideFlags = hiddenHelperFlags;
                }
            }
        }
    }
}
