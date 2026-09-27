using System.Threading.Tasks;
using System;
using System.IO;
using UniVRM10;
using UnityEngine;

namespace AiZc2.Avatar
{
    public class AvatarLoader : MonoBehaviour
    {
        private static readonly Vector3 RecommendedPreviewLocalPosition = new Vector3(0f, -1.47f, 0f);
        private static readonly Vector3 RecommendedPreviewLocalEulerAngles = new Vector3(0f, 180f, 0f);
        private static readonly Vector3 RecommendedPreviewLocalScale = new Vector3(2.2f, 2.2f, 2.2f);
        private const float DefaultPreviewFocusHeightRatio = 0.58f;
        private const float DefaultPreviewCameraDistancePadding = 1.18f;
        private const float DefaultPreviewCameraMinDistance = 4.8f;
        private const float DefaultPreviewCameraMaxDistance = 9.5f;
        private const float DefaultPreviewDepthMargin = 0.35f;
        private const float InteractionHoverScaleBoost = 0.025f;
        private const float InteractionDragScaleBoost = 0f;
        private const float DragYawDegreesPerPixel = 0f;
        private const float DragPitchDegreesPerPixel = 0f;
        private const float DragRollDegreesPerPixel = 0f;
        private const float MaxScreenAnchorDistanceScale = 4.5f;
        private static readonly HumanBodyBones[] GroundingBones =
        {
            HumanBodyBones.LeftToes,
            HumanBodyBones.RightToes,
            HumanBodyBones.LeftFoot,
            HumanBodyBones.RightFoot,
        };

        [SerializeField] private GameObject debugAvatarPrefab;
        [SerializeField] private Camera previewCamera;
        [SerializeField] private Vector3 defaultLocalPosition = new Vector3(0f, -1.47f, 0f);
        [SerializeField] private Vector3 defaultLocalEulerAngles = new Vector3(0f, 180f, 0f);
        [SerializeField] private Vector3 defaultLocalScale = new Vector3(2.2f, 2.2f, 2.2f);
        [SerializeField] private bool autoUpgradeLegacyPreviewTransform = true;
        [SerializeField] private bool autoSnapFeetToGround = true;
        [SerializeField] private bool autoFacePreviewCamera = true;
        [SerializeField] private bool autoFramePreviewCamera = true;
        [SerializeField] private float groundOffset = -0.01f;
        [SerializeField] private float footBottomBias = 0.02f;
        [SerializeField] private float previewFocusHeightRatio = DefaultPreviewFocusHeightRatio;
        [SerializeField] private float previewCameraDistancePadding = DefaultPreviewCameraDistancePadding;
        [SerializeField] private float previewCameraMinDistance = DefaultPreviewCameraMinDistance;
        [SerializeField] private float previewCameraMaxDistance = DefaultPreviewCameraMaxDistance;
        [SerializeField] private float previewDepthMargin = DefaultPreviewDepthMargin;

        public GameObject CurrentAvatarRoot { get; private set; }
        public GameObject CurrentAvatarModelRoot { get; private set; }
        public Animator CurrentAnimator { get; private set; }
        public Vector3 CurrentBaseLocalScale { get; private set; } = Vector3.one;

        private Quaternion currentBaseLocalRotation = Quaternion.identity;
        private float currentPresentationScale = 1f;
        private float currentInteractionScale = 1f;
        private Quaternion currentInteractionRotation = Quaternion.identity;
        private bool hasScreenAnchor;
        private float screenAnchorX = 0.5f;
        private float screenAnchorY = 0.5f;
        private float screenAnchorDistanceScale = 1f;
        private bool hasScreenAnchorBaseCamera;
        private Vector3 screenAnchorBaseCameraPosition;
        private Quaternion screenAnchorBaseCameraRotation = Quaternion.identity;
        private bool screenAnchorBaseCameraOrthographic;
        private float screenAnchorBaseCameraOrthographicSize = 5f;

        public async Task<GameObject> LoadAsync(string modelUrl)
        {
            Unload();

            CurrentAvatarRoot = new GameObject("AvatarRoot");
            CurrentAvatarRoot.transform.SetParent(transform, false);

            if (!await TryLoadVrmModelAsync(modelUrl))
            {
                LoadDebugAvatarPrefab(modelUrl);
            }

            var effectiveLocalPosition = GetEffectiveLocalPosition();
            var effectiveLocalEulerAngles = GetEffectiveLocalEulerAngles();
            CurrentBaseLocalScale = GetEffectiveLocalScale();

            CurrentAvatarRoot.transform.localPosition = effectiveLocalPosition;
            CurrentAvatarRoot.transform.localRotation = Quaternion.Euler(effectiveLocalEulerAngles);
            CurrentAvatarRoot.transform.localScale = CurrentBaseLocalScale;
            currentBaseLocalRotation = CurrentAvatarRoot.transform.localRotation;
            currentPresentationScale = 1f;
            currentInteractionScale = 1f;
            currentInteractionRotation = Quaternion.identity;

            CurrentAnimator = CurrentAvatarRoot.GetComponentInChildren<Animator>();
            if (CurrentAnimator == null)
            {
                CurrentAnimator = CurrentAvatarRoot.GetComponent<Animator>();
            }

            if (CurrentAnimator != null)
            {
                CurrentAnimator.Rebind();
                CurrentAnimator.Update(0f);
            }

            if (autoSnapFeetToGround)
            {
                SnapFeetToGround();
            }

            if (autoFacePreviewCamera)
            {
                AlignAvatarFacingCamera();
            }

            currentBaseLocalRotation = CurrentAvatarRoot.transform.localRotation;
            RefreshPreviewCameraFraming();
            return CurrentAvatarRoot;
        }

        public void ApplyPresentationScale(float scaleMultiplier)
        {
            if (CurrentAvatarRoot == null)
            {
                return;
            }

            float nextPresentationScale = Mathf.Max(scaleMultiplier, 0.01f);
            bool scaleChanged = Mathf.Abs(currentPresentationScale - nextPresentationScale) > 0.0001f;
            currentPresentationScale = nextPresentationScale;
            ApplyAvatarTransform();
            if (scaleChanged && autoSnapFeetToGround)
            {
                SnapFeetToGround();
            }

            if (scaleChanged)
            {
                RefreshSpringBoneAfterScale();
            }
            ApplyScreenAnchorCameraOffset();
        }

        public void ApplyScreenAnchor(bool enabled, float normalizedX, float normalizedY, float distanceScale)
        {
            hasScreenAnchor = enabled;
            screenAnchorX = Mathf.Clamp01(IsFinite(normalizedX) ? normalizedX : 0.5f);
            screenAnchorY = Mathf.Clamp01(IsFinite(normalizedY) ? normalizedY : 0.5f);
            screenAnchorDistanceScale = Mathf.Clamp(IsFinite(distanceScale) ? distanceScale : 1f, 1f, MaxScreenAnchorDistanceScale);
            ApplyScreenAnchorCameraOffset();
        }

        public void ApplyInteractionState(bool dragActive, float dragDeltaX, float dragDeltaY, string hoverRegion)
        {
            float safeDeltaX = IsFinite(dragDeltaX) ? dragDeltaX : 0f;
            float safeDeltaY = IsFinite(dragDeltaY) ? dragDeltaY : 0f;
            bool hasHoverRegion = !string.IsNullOrWhiteSpace(hoverRegion);
            currentInteractionScale = dragActive
                ? 1f + InteractionDragScaleBoost
                : hasHoverRegion
                    ? 1f + InteractionHoverScaleBoost
                    : 1f;
            currentInteractionRotation = dragActive
                ? Quaternion.Euler(
                    Mathf.Clamp(safeDeltaY * DragPitchDegreesPerPixel, -6f, 6f),
                    Mathf.Clamp(safeDeltaX * DragYawDegreesPerPixel, -10f, 10f),
                    Mathf.Clamp(safeDeltaX * DragRollDegreesPerPixel, -7f, 7f))
                : Quaternion.identity;

            ApplyAvatarTransform();
        }

        public void Unload()
        {
            if (CurrentAvatarRoot != null)
            {
                Destroy(CurrentAvatarRoot);
            }

            CurrentAvatarRoot = null;
            CurrentAvatarModelRoot = null;
            CurrentAnimator = null;
            CurrentBaseLocalScale = Vector3.one;
            currentBaseLocalRotation = Quaternion.identity;
            currentPresentationScale = 1f;
            currentInteractionScale = 1f;
            currentInteractionRotation = Quaternion.identity;
            hasScreenAnchor = false;
            screenAnchorX = 0.5f;
            screenAnchorY = 0.5f;
            screenAnchorDistanceScale = 1f;
            hasScreenAnchorBaseCamera = false;
            screenAnchorBaseCameraPosition = Vector3.zero;
            screenAnchorBaseCameraRotation = Quaternion.identity;
            screenAnchorBaseCameraOrthographic = false;
            screenAnchorBaseCameraOrthographicSize = 5f;
        }

        private void ApplyAvatarTransform()
        {
            if (CurrentAvatarRoot == null)
            {
                return;
            }

            float effectiveScale = Mathf.Max(0.01f, currentPresentationScale * currentInteractionScale);
            CurrentAvatarRoot.transform.localRotation = currentBaseLocalRotation * currentInteractionRotation;
            CurrentAvatarRoot.transform.localScale = CurrentBaseLocalScale * effectiveScale;
        }

        private Vector3 GetEffectiveLocalPosition()
        {
            return ShouldUpgradeLegacyPreviewTransform() ? RecommendedPreviewLocalPosition : defaultLocalPosition;
        }

        private Vector3 GetEffectiveLocalEulerAngles()
        {
            return ShouldUpgradeLegacyPreviewTransform() ? RecommendedPreviewLocalEulerAngles : defaultLocalEulerAngles;
        }

        private Vector3 GetEffectiveLocalScale()
        {
            return ShouldUpgradeLegacyPreviewTransform() ? RecommendedPreviewLocalScale : defaultLocalScale;
        }

        private bool ShouldUpgradeLegacyPreviewTransform()
        {
            if (!autoUpgradeLegacyPreviewTransform)
            {
                return false;
            }

            return Approximately(defaultLocalPosition, Vector3.zero) &&
                   Approximately(defaultLocalEulerAngles, RecommendedPreviewLocalEulerAngles) &&
                   Approximately(defaultLocalScale, Vector3.one);
        }

        private static bool Approximately(Vector3 a, Vector3 b)
        {
            return Vector3.SqrMagnitude(a - b) < 0.0001f;
        }

        private static bool IsFinite(float value)
        {
            return !float.IsNaN(value) && !float.IsInfinity(value);
        }

        private async Task<bool> TryLoadVrmModelAsync(string modelUrl)
        {
            if (!TryResolveLocalVrmPath(modelUrl, out string localPath))
            {
                return false;
            }

            try
            {
                var vrmInstance = await Vrm10.LoadPathAsync(localPath, canLoadVrm0X: true);
                if (vrmInstance == null)
                {
                    Debug.LogWarning($"[AvatarLoader] VRM loader returned null for '{localPath}'.");
                    return false;
                }

                CurrentAvatarModelRoot = vrmInstance.gameObject;
                CurrentAvatarModelRoot.name = Path.GetFileNameWithoutExtension(localPath);
                CurrentAvatarModelRoot.transform.SetParent(CurrentAvatarRoot.transform, false);
                CurrentAvatarModelRoot.transform.localPosition = Vector3.zero;
                CurrentAvatarModelRoot.transform.localRotation = Quaternion.identity;
                CurrentAvatarModelRoot.transform.localScale = Vector3.one;
                Debug.Log($"[AvatarLoader] Loaded VRM avatar from '{localPath}'.");
                return true;
            }
            catch (Exception ex)
            {
                Debug.LogWarning($"[AvatarLoader] Failed to load VRM avatar from '{localPath}': {ex.Message}");
                return false;
            }
        }

        private void LoadDebugAvatarPrefab(string modelUrl)
        {
            if (debugAvatarPrefab != null)
            {
                CurrentAvatarModelRoot = Instantiate(debugAvatarPrefab, CurrentAvatarRoot.transform);
                CurrentAvatarModelRoot.name = debugAvatarPrefab.name;
                CurrentAvatarModelRoot.transform.localPosition = Vector3.zero;
                CurrentAvatarModelRoot.transform.localRotation = Quaternion.identity;
                CurrentAvatarModelRoot.transform.localScale = Vector3.one;
                Debug.LogWarning($"[AvatarLoader] Falling back to debug avatar prefab for modelUrl '{modelUrl ?? ""}'.");
                return;
            }

            CurrentAvatarModelRoot = null;
            Debug.LogWarning($"[AvatarLoader] No VRM path or debug avatar prefab was available for modelUrl '{modelUrl ?? ""}'.");
        }

        private static bool TryResolveLocalVrmPath(string modelUrl, out string localPath)
        {
            localPath = string.Empty;
            if (string.IsNullOrWhiteSpace(modelUrl))
            {
                return false;
            }

            string candidate = StripQueryAndHash(modelUrl.Trim());
            if (string.IsNullOrWhiteSpace(candidate))
            {
                return false;
            }

            if (TryResolveDesktopPetFileUrl(candidate, out localPath)
                || TryResolveFileUrl(candidate, out localPath)
                || TryResolvePlainLocalPath(candidate, out localPath))
            {
                localPath = Path.GetFullPath(localPath);
                if (!string.Equals(Path.GetExtension(localPath), ".vrm", StringComparison.OrdinalIgnoreCase))
                {
                    Debug.LogWarning($"[AvatarLoader] Unity runtime currently supports VRM only, ignored '{localPath}'.");
                    localPath = string.Empty;
                    return false;
                }

                if (!File.Exists(localPath))
                {
                    Debug.LogWarning($"[AvatarLoader] VRM file was not found at '{localPath}'.");
                    localPath = string.Empty;
                    return false;
                }

                return true;
            }

            return false;
        }

        private static string StripQueryAndHash(string value)
        {
            int hashIndex = value.IndexOf('#');
            if (hashIndex >= 0)
            {
                value = value.Substring(0, hashIndex);
            }

            int queryIndex = value.IndexOf('?');
            if (queryIndex >= 0)
            {
                value = value.Substring(0, queryIndex);
            }

            return value;
        }

        private static bool TryResolveDesktopPetFileUrl(string url, out string localPath)
        {
            localPath = string.Empty;
            if (!Uri.TryCreate(url, UriKind.Absolute, out Uri uri)
                || !string.Equals(uri.Scheme, "desktop-pet-file", StringComparison.OrdinalIgnoreCase))
            {
                return false;
            }

            string decodedPath = Uri.UnescapeDataString(uri.AbsolutePath ?? "");
            if (string.IsNullOrWhiteSpace(decodedPath))
            {
                return false;
            }

            if (decodedPath.StartsWith("/unc/", StringComparison.OrdinalIgnoreCase))
            {
                localPath = "\\\\" + decodedPath.Substring("/unc/".Length).Replace('/', '\\');
                return true;
            }

            localPath = decodedPath.TrimStart('/').Replace('/', '\\');
            return true;
        }

        private static bool TryResolveFileUrl(string url, out string localPath)
        {
            localPath = string.Empty;
            if (!Uri.TryCreate(url, UriKind.Absolute, out Uri uri) || !uri.IsFile)
            {
                return false;
            }

            localPath = uri.LocalPath;
            return !string.IsNullOrWhiteSpace(localPath);
        }

        private static bool TryResolvePlainLocalPath(string url, out string localPath)
        {
            localPath = string.Empty;
            string normalizedPath = Uri.UnescapeDataString(url).Replace('/', Path.DirectorySeparatorChar);
            if (Path.IsPathRooted(normalizedPath))
            {
                localPath = normalizedPath;
                return true;
            }

            string projectRelativePath = Path.GetFullPath(Path.Combine(Application.dataPath, "..", normalizedPath));
            if (File.Exists(projectRelativePath))
            {
                localPath = projectRelativePath;
                return true;
            }

            string assetsRelativePath = Path.GetFullPath(Path.Combine(Application.dataPath, normalizedPath));
            if (File.Exists(assetsRelativePath))
            {
                localPath = assetsRelativePath;
                return true;
            }

            localPath = normalizedPath;
            return true;
        }

        private void SnapFeetToGround()
        {
            if (CurrentAvatarRoot == null)
            {
                return;
            }

            if (!TryGetGroundingPointY(out float lowestPointY))
            {
                return;
            }

            float deltaY = groundOffset - lowestPointY;
            if (Mathf.Abs(deltaY) < 0.0001f)
            {
                return;
            }

            CurrentAvatarRoot.transform.position += Vector3.up * deltaY;
        }

        private bool TryGetGroundingPointY(out float lowestPointY)
        {
            if (TryGetLowestHumanoidFootY(out float footY))
            {
                float scaleY = Mathf.Abs(CurrentAvatarRoot.transform.lossyScale.y);
                lowestPointY = footY - (footBottomBias * Mathf.Max(scaleY, 0.01f));
                return true;
            }

            return TryGetLowestRendererY(out lowestPointY);
        }

        private bool TryGetLowestHumanoidFootY(out float lowestPointY)
        {
            lowestPointY = 0f;
            if (CurrentAnimator == null || !CurrentAnimator.isHuman || CurrentAnimator.avatar == null || !CurrentAnimator.avatar.isValid)
            {
                return false;
            }

            bool foundBone = false;
            foreach (HumanBodyBones bone in GroundingBones)
            {
                Transform boneTransform = CurrentAnimator.GetBoneTransform(bone);
                if (boneTransform == null)
                {
                    continue;
                }

                if (!foundBone || boneTransform.position.y < lowestPointY)
                {
                    lowestPointY = boneTransform.position.y;
                    foundBone = true;
                }
            }

            return foundBone;
        }

        private bool TryGetLowestRendererY(out float lowestPointY)
        {
            lowestPointY = 0f;
            if (!AvatarPreviewFraming.TryGetRendererBounds(CurrentAvatarRoot, out Bounds bounds))
            {
                return false;
            }

            lowestPointY = bounds.min.y;
            return true;
        }

        private void AlignAvatarFacingCamera()
        {
            if (CurrentAvatarRoot == null)
            {
                return;
            }

            Camera targetCamera = ResolvePreviewCamera();
            if (targetCamera == null)
            {
                return;
            }

            AvatarPreviewFraming.AlignAvatarFacingCamera(CurrentAvatarRoot, CurrentAnimator, targetCamera);
        }

        private void RefreshPreviewCameraFraming()
        {
            if (!autoFramePreviewCamera || CurrentAvatarRoot == null)
            {
                return;
            }

            Camera targetCamera = ResolvePreviewCamera();
            if (targetCamera == null)
            {
                return;
            }

            AvatarPreviewFraming.RefreshPreviewCameraFraming(
                CurrentAvatarRoot,
                CurrentAnimator,
                targetCamera,
                previewFocusHeightRatio,
                previewCameraDistancePadding,
                previewCameraMinDistance,
                previewCameraMaxDistance,
                previewDepthMargin
            );
            CaptureScreenAnchorBaseCamera(targetCamera);
            ApplyScreenAnchorCameraOffset();
        }

        private Camera ResolvePreviewCamera()
        {
            return previewCamera != null ? previewCamera : Camera.main;
        }

        private void ApplyScreenAnchorCameraOffset()
        {
            if (CurrentAvatarRoot == null)
            {
                return;
            }

            Camera targetCamera = ResolvePreviewCamera();
            if (targetCamera == null || !AvatarPreviewFraming.TryGetRendererBounds(CurrentAvatarRoot, out Bounds bounds))
            {
                return;
            }

            if (!hasScreenAnchorBaseCamera)
            {
                CaptureScreenAnchorBaseCamera(targetCamera);
            }

            targetCamera.transform.position = screenAnchorBaseCameraPosition;
            targetCamera.transform.rotation = screenAnchorBaseCameraRotation;
            targetCamera.orthographic = screenAnchorBaseCameraOrthographic;
            if (targetCamera.orthographic)
            {
                targetCamera.orthographicSize = Mathf.Max(
                    0.01f,
                    screenAnchorBaseCameraOrthographicSize * screenAnchorDistanceScale
                );
            }
            if (!hasScreenAnchor)
            {
                return;
            }

            Vector3 anchoredCameraPosition = screenAnchorBaseCameraPosition;
            float depth = Vector3.Dot(bounds.center - targetCamera.transform.position, targetCamera.transform.forward);
            if (depth <= 0.01f)
            {
                return;
            }

            float screenWidth = Mathf.Max(1f, Screen.width);
            float screenHeight = Mathf.Max(1f, Screen.height);
            if (!targetCamera.orthographic && screenAnchorDistanceScale > 1.001f)
            {
                Vector3 focusWorld = targetCamera.ScreenToWorldPoint(new Vector3(screenWidth * 0.5f, screenHeight * 0.5f, depth));
                anchoredCameraPosition = focusWorld - targetCamera.transform.forward * depth * screenAnchorDistanceScale;
                targetCamera.transform.position = anchoredCameraPosition;
                targetCamera.transform.rotation = screenAnchorBaseCameraRotation;
                depth = Vector3.Dot(bounds.center - targetCamera.transform.position, targetCamera.transform.forward);
                if (depth <= 0.01f)
                {
                    return;
                }
            }

            Vector3 centerWorld = targetCamera.ScreenToWorldPoint(new Vector3(screenWidth * 0.5f, screenHeight * 0.5f, depth));
            Vector3 targetWorld = targetCamera.ScreenToWorldPoint(new Vector3(screenWidth * screenAnchorX, screenHeight * (1f - screenAnchorY), depth));
            Vector3 offset = targetWorld - centerWorld;
            targetCamera.transform.position = anchoredCameraPosition - offset;
            targetCamera.transform.rotation = screenAnchorBaseCameraRotation;
        }

        private void CaptureScreenAnchorBaseCamera(Camera targetCamera)
        {
            if (targetCamera == null)
            {
                return;
            }

            screenAnchorBaseCameraPosition = targetCamera.transform.position;
            screenAnchorBaseCameraRotation = targetCamera.transform.rotation;
            screenAnchorBaseCameraOrthographic = targetCamera.orthographic;
            screenAnchorBaseCameraOrthographicSize = Mathf.Max(0.01f, targetCamera.orthographicSize);
            hasScreenAnchorBaseCamera = true;
        }

        private void RefreshSpringBoneAfterScale()
        {
            var vrmInstance = CurrentAvatarRoot != null
                ? CurrentAvatarRoot.GetComponentInChildren<UniVRM10.Vrm10Instance>()
                : null;
            var runtime = vrmInstance?.Runtime;
            if (runtime?.SpringBone == null)
            {
                return;
            }

            runtime.SpringBone.ReconstructSpringBone();
            runtime.SpringBone.RestoreInitialTransform();
        }
    }
}
