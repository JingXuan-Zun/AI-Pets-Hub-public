using UnityEngine;

namespace AiZc2.Avatar
{
    internal static class AvatarPreviewFraming
    {
        private const float FacingFlipDotThreshold = -0.2f;
        private static readonly HumanBodyBones[] FacingBones =
        {
            HumanBodyBones.Head,
            HumanBodyBones.UpperChest,
            HumanBodyBones.Chest,
        };

        public static void AlignAvatarFacingCamera(GameObject avatarRoot, Animator animator, Camera previewCamera)
        {
            if (avatarRoot == null || previewCamera == null || !TryGetFacingReference(animator, out Transform facingReference))
            {
                return;
            }

            Vector3 facingForward = Vector3.ProjectOnPlane(facingReference.forward, Vector3.up);
            Vector3 toCamera = Vector3.ProjectOnPlane(previewCamera.transform.position - facingReference.position, Vector3.up);
            if (facingForward.sqrMagnitude < 0.0001f || toCamera.sqrMagnitude < 0.0001f)
            {
                return;
            }

            if (Vector3.Dot(facingForward.normalized, toCamera.normalized) >= FacingFlipDotThreshold)
            {
                return;
            }

            avatarRoot.transform.Rotate(0f, 180f, 0f, Space.Self);
            animator?.Update(0f);
        }

        public static void RefreshPreviewCameraFraming(
            GameObject avatarRoot,
            Animator animator,
            Camera previewCamera,
            float focusHeightRatio,
            float distancePadding,
            float minDistance,
            float maxDistance,
            float depthMargin)
        {
            if (avatarRoot == null || previewCamera == null || !TryGetRendererBounds(avatarRoot, out Bounds bounds))
            {
                return;
            }

            float avatarHeight = Mathf.Max(bounds.size.y, 0.5f);
            float focusY = ResolvePreviewFocusY(bounds, avatarHeight, animator, focusHeightRatio);
            float halfVerticalSpan = Mathf.Max(focusY - bounds.min.y, bounds.max.y - focusY);
            float halfFovRadians = Mathf.Max(previewCamera.fieldOfView, 1f) * Mathf.Deg2Rad * 0.5f;
            float minOrthographicSize = Mathf.Max(0.25f, Mathf.Max(0.5f, minDistance) * Mathf.Tan(halfFovRadians));
            float maxOrthographicSize = Mathf.Max(
                minOrthographicSize,
                Mathf.Max(minDistance, maxDistance) * Mathf.Tan(halfFovRadians)
            );
            float depthAllowance = Mathf.Max(bounds.extents.z, 0.2f) + depthMargin;
            float targetOrthographicSize = (
                halfVerticalSpan + depthAllowance * 0.08f
            ) * Mathf.Max(distancePadding, 1f);
            float clampedOrthographicSize = Mathf.Clamp(
                targetOrthographicSize,
                minOrthographicSize,
                maxOrthographicSize
            );

            previewCamera.orthographic = true;
            previewCamera.orthographicSize = clampedOrthographicSize;
            previewCamera.transform.position = new Vector3(bounds.center.x, focusY, bounds.center.z - Mathf.Max(minDistance, maxDistance));
            previewCamera.transform.rotation = Quaternion.identity;
            previewCamera.nearClipPlane = 0.01f;
            previewCamera.farClipPlane = Mathf.Max(previewCamera.farClipPlane, Mathf.Max(minDistance, maxDistance) + bounds.size.z + 10f);
        }

        public static bool TryGetRendererBounds(GameObject avatarRoot, out Bounds bounds)
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

        private static float ResolvePreviewFocusY(
            Bounds bounds,
            float avatarHeight,
            Animator animator,
            float focusHeightRatio)
        {
            float defaultFocusY = bounds.min.y + (avatarHeight * focusHeightRatio);
            if (!TryGetHumanoidHeadY(animator, out float headY))
            {
                return defaultFocusY;
            }

            float blendedFocusY = Mathf.Lerp(defaultFocusY, headY - (avatarHeight * 0.12f), 0.68f);
            return Mathf.Clamp(
                blendedFocusY,
                bounds.min.y + (avatarHeight * 0.46f),
                bounds.min.y + (avatarHeight * 0.72f)
            );
        }

        private static bool TryGetHumanoidHeadY(Animator animator, out float headY)
        {
            headY = 0f;
            if (animator == null || !animator.isHuman || animator.avatar == null || !animator.avatar.isValid)
            {
                return false;
            }

            Transform head = animator.GetBoneTransform(HumanBodyBones.Head);
            if (head == null)
            {
                head = animator.GetBoneTransform(HumanBodyBones.Neck);
            }

            if (head == null)
            {
                return false;
            }

            headY = head.position.y;
            return true;
        }

        private static bool TryGetFacingReference(Animator animator, out Transform facingReference)
        {
            facingReference = null;
            if (animator == null || !animator.isHuman || animator.avatar == null || !animator.avatar.isValid)
            {
                return false;
            }

            foreach (HumanBodyBones bone in FacingBones)
            {
                Transform boneTransform = animator.GetBoneTransform(bone);
                if (boneTransform == null)
                {
                    continue;
                }

                facingReference = boneTransform;
                return true;
            }

            return false;
        }
    }
}
