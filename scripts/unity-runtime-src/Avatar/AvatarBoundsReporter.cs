using AiZc2.Runtime;
using UnityEngine;

namespace AiZc2.Avatar
{
    [System.Serializable]
    public class AvatarVisualBoundsData
    {
        public float left;
        public float right;
        public float top;
        public float bottom;
    }

    public class AvatarBoundsReporter : MonoBehaviour
    {
        private const float MinimumExtent = 1f;
        private const float MaximumExtent = 8192f;
        private const float MeaningfulPixelDelta = 2f;

        [SerializeField] private Camera targetCamera;

        private bool hasLastVisualBoundsData;
        private AvatarVisualBoundsData lastVisualBoundsData;

        public bool TryCaptureWorldBounds(GameObject avatarRoot, out Bounds bounds)
        {
            bounds = default;
            if (avatarRoot == null)
            {
                return false;
            }

            Renderer[] renderers = avatarRoot.GetComponentsInChildren<Renderer>(true);
            if (renderers.Length == 0)
            {
                return false;
            }

            bounds = renderers[0].bounds;
            for (int i = 1; i < renderers.Length; i++)
            {
                bounds.Encapsulate(renderers[i].bounds);
            }

            return true;
        }

        public bool HasMeaningfulChange(AvatarVisualBoundsData data)
        {
            if (data == null)
            {
                return false;
            }

            if (!hasLastVisualBoundsData)
            {
                hasLastVisualBoundsData = true;
                lastVisualBoundsData = data;
                return true;
            }

            bool changed =
                Mathf.Abs(lastVisualBoundsData.left - data.left) > MeaningfulPixelDelta ||
                Mathf.Abs(lastVisualBoundsData.right - data.right) > MeaningfulPixelDelta ||
                Mathf.Abs(lastVisualBoundsData.top - data.top) > MeaningfulPixelDelta ||
                Mathf.Abs(lastVisualBoundsData.bottom - data.bottom) > MeaningfulPixelDelta;

            if (changed)
            {
                lastVisualBoundsData = data;
            }

            return changed;
        }

        public AvatarVisualBoundsData CreateBoundsData(Bounds bounds, AvatarRuntimeState runtimeState)
        {
            AvatarVisualBoundsData screenBounds;
            if (TryCreateScreenBoundsData(bounds, runtimeState, out screenBounds))
            {
                return screenBounds;
            }

            return CreateWorldFallbackBoundsData(bounds);
        }

        private bool TryCreateScreenBoundsData(
            Bounds bounds,
            AvatarRuntimeState runtimeState,
            out AvatarVisualBoundsData data)
        {
            data = null;
            Camera camera = ResolveTargetCamera();
            if (camera == null)
            {
                return false;
            }

            float unityScreenWidth = Mathf.Max(1f, Screen.width);
            float unityScreenHeight = Mathf.Max(1f, Screen.height);
            float cssScreenWidth = runtimeState != null && runtimeState.screenWidth > 0f
                ? runtimeState.screenWidth
                : unityScreenWidth;
            float cssScreenHeight = runtimeState != null && runtimeState.screenHeight > 0f
                ? runtimeState.screenHeight
                : unityScreenHeight;
            float cssScaleX = cssScreenWidth / unityScreenWidth;
            float cssScaleY = cssScreenHeight / unityScreenHeight;

            float minX = float.PositiveInfinity;
            float maxX = float.NegativeInfinity;
            float minY = float.PositiveInfinity;
            float maxY = float.NegativeInfinity;
            bool hasProjectedPoint = false;

            Vector3 center = bounds.center;
            Vector3 extents = bounds.extents;
            for (int x = -1; x <= 1; x += 2)
            {
                for (int y = -1; y <= 1; y += 2)
                {
                    for (int z = -1; z <= 1; z += 2)
                    {
                        Vector3 worldPoint = center + Vector3.Scale(extents, new Vector3(x, y, z));
                        Vector3 screenPoint = camera.WorldToScreenPoint(worldPoint);
                        if (screenPoint.z <= camera.nearClipPlane)
                        {
                            continue;
                        }

                        float cssX = screenPoint.x * cssScaleX;
                        float cssY = (unityScreenHeight - screenPoint.y) * cssScaleY;
                        if (!IsFinite(cssX) || !IsFinite(cssY))
                        {
                            continue;
                        }

                        minX = Mathf.Min(minX, cssX);
                        maxX = Mathf.Max(maxX, cssX);
                        minY = Mathf.Min(minY, cssY);
                        maxY = Mathf.Max(maxY, cssY);
                        hasProjectedPoint = true;
                    }
                }
            }

            if (!hasProjectedPoint || minX >= maxX || minY >= maxY)
            {
                return false;
            }

            float centerX = cssScreenWidth * 0.5f;
            float centerY = cssScreenHeight * 0.5f;
            if (runtimeState != null && runtimeState.viewportWidth > 0f && runtimeState.viewportHeight > 0f)
            {
                centerX = runtimeState.viewportX + runtimeState.viewportWidth * 0.5f;
                centerY = runtimeState.viewportY + runtimeState.viewportHeight * 0.5f;
            }

            data = new AvatarVisualBoundsData
            {
                left = SanitizeExtent(centerX - minX),
                right = SanitizeExtent(maxX - centerX),
                top = SanitizeExtent(centerY - minY),
                bottom = SanitizeExtent(maxY - centerY),
            };
            return true;
        }

        private AvatarVisualBoundsData CreateWorldFallbackBoundsData(Bounds bounds)
        {
            float pixelsPerWorldUnit = 96f;

            return new AvatarVisualBoundsData
            {
                left = SanitizeExtent(bounds.extents.x * pixelsPerWorldUnit),
                right = SanitizeExtent(bounds.extents.x * pixelsPerWorldUnit),
                top = SanitizeExtent(bounds.extents.y * pixelsPerWorldUnit),
                bottom = SanitizeExtent(bounds.extents.y * pixelsPerWorldUnit),
            };
        }

        private Camera ResolveTargetCamera()
        {
            return targetCamera != null ? targetCamera : Camera.main;
        }

        private static float SanitizeExtent(float value)
        {
            if (!IsFinite(value))
            {
                return MinimumExtent;
            }

            return Mathf.Clamp(Mathf.Round(value), MinimumExtent, MaximumExtent);
        }

        private static bool IsFinite(float value)
        {
            return !float.IsNaN(value) && !float.IsInfinity(value);
        }
    }
}
