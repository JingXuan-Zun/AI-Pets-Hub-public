using System.Collections.Generic;
using UniVRM10;
using UnityEngine;

namespace AiZc2.Avatar
{
    public class AvatarExpressionController
    {
        private const float VrmExpressionWeight = 1f;
        private const float BlendShapeExpressionWeight = 100f;
        private const float BlendShapeVisemeWeight = 72f;

        private readonly AvatarVrmExpressionAdapter vrmAdapter = new AvatarVrmExpressionAdapter();
        private readonly AvatarBlendShapeExpressionAdapter blendShapeAdapter = new AvatarBlendShapeExpressionAdapter();

        private GameObject currentAvatarRoot;
        private Vrm10Instance currentVrmInstance;

        public void Bind(GameObject avatarRoot, string avatarUrl)
        {
            Unbind();
            currentAvatarRoot = avatarRoot;
            currentVrmInstance = currentAvatarRoot != null
                ? currentAvatarRoot.GetComponentInChildren<Vrm10Instance>()
                : null;
            vrmAdapter.Bind(currentVrmInstance);
            blendShapeAdapter.Bind(currentAvatarRoot);
        }

        public AvatarExpressionApplicationResult ApplyState(string expressionKey, string viseme)
        {
            vrmAdapter.Clear();

            var expressionCandidates = AvatarExpressionCandidates.ResolveExpressionCandidates(expressionKey);
            var result = AvatarExpressionApplicationResult.Create(
                expressionKey,
                viseme,
                vrmAdapter.AvailableKeyCount,
                vrmAdapter.AvailableKeySample,
                blendShapeAdapter.BindingKeyCount,
                blendShapeAdapter.BindingKeySample);
            var vrmResult = vrmAdapter.ApplyCandidates(
                expressionCandidates,
                VrmExpressionWeight);
            result.appliedVrmExpression = vrmResult.applied;
            result.appliedExpressionKey = vrmResult.keyName;
            var pendingBlendShapeWeights = new Dictionary<string, float>();

            if (!vrmResult.applied)
            {
                var expressionMatch = blendShapeAdapter.QueueWeights(
                    pendingBlendShapeWeights,
                    expressionCandidates,
                    BlendShapeExpressionWeight);
                result.expressionBlendShapeMatchCount = expressionMatch.count;
                result.appliedBlendShapeExpression = expressionMatch.count > 0;
                result.appliedBlendShapeKeySample = expressionMatch.sample;
            }

            var visemeMatch = blendShapeAdapter.QueueWeights(
                pendingBlendShapeWeights,
                AvatarExpressionCandidates.ResolveVisemeCandidates(viseme),
                BlendShapeVisemeWeight);
            result.visemeBlendShapeMatchCount = visemeMatch.count;
            blendShapeAdapter.ApplyWeights(pendingBlendShapeWeights);
            result.ResolveExpressionSource();
            return result;
        }

        public void Unbind()
        {
            vrmAdapter.Unbind();
            blendShapeAdapter.Unbind();
            currentAvatarRoot = null;
            currentVrmInstance = null;
        }
    }
}
