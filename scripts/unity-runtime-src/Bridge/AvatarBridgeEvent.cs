using System;

namespace AiZc2.Bridge
{
    [Serializable]
    public class AvatarBridgeEventEnvelope
    {
        public string type = "";
        public string petId = "main";
        public string runtimeKind = "unity";
        public string errorMessage = "";
        public string source = "measured";
        public string motionKey = "";
        public string expressionKey = "";
        public string viseme = "";
        public string expressionSource = "";
        public string appliedExpressionKey = "";
        public bool appliedVrmExpression = false;
        public bool appliedBlendShapeExpression = false;
        public int expressionBlendShapeMatchCount = 0;
        public int visemeBlendShapeMatchCount = 0;
        public int availableVrmExpressionKeyCount = 0;
        public string vrmExpressionKeySample = "";
        public int availableBlendShapeKeyCount = 0;
        public string blendShapeKeySample = "";
        public string appliedBlendShapeKeySample = "";
        public float fps = 0f;
        public float frameIntervalMs = 0f;
        public float left = 0f;
        public float right = 0f;
        public float top = 0f;
        public float bottom = 0f;
    }
}
