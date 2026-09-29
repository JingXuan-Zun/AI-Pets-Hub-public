using AiZc2.Avatar;
using AiZc2.Bridge;

namespace AiZc2.Runtime
{
    internal static class AvatarExpressionDiagnosticReporter
    {
        public static void Send(
            AvatarBridgeTransport bridgeTransport,
            string petId,
            AvatarExpressionApplicationResult result)
        {
            if (bridgeTransport == null || result == null || IsEmpty(result))
            {
                return;
            }

            bridgeTransport.SendEvent(new AvatarBridgeEventEnvelope
            {
                type = "expression-application-diagnostic",
                petId = string.IsNullOrWhiteSpace(petId) ? "main" : petId,
                expressionKey = result.expressionKey,
                viseme = result.viseme,
                expressionSource = result.expressionSource,
                appliedExpressionKey = result.appliedExpressionKey,
                appliedVrmExpression = result.appliedVrmExpression,
                appliedBlendShapeExpression = result.appliedBlendShapeExpression,
                expressionBlendShapeMatchCount = result.expressionBlendShapeMatchCount,
                visemeBlendShapeMatchCount = result.visemeBlendShapeMatchCount,
                availableVrmExpressionKeyCount = result.availableVrmExpressionKeyCount,
                vrmExpressionKeySample = result.vrmExpressionKeySample,
                availableBlendShapeKeyCount = result.availableBlendShapeKeyCount,
                blendShapeKeySample = result.blendShapeKeySample,
                appliedBlendShapeKeySample = result.appliedBlendShapeKeySample,
            });
        }

        private static bool IsEmpty(AvatarExpressionApplicationResult result)
        {
            return string.IsNullOrWhiteSpace(result.expressionKey)
                && string.IsNullOrWhiteSpace(result.viseme);
        }
    }
}
