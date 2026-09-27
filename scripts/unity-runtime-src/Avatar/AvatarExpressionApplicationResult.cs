namespace AiZc2.Avatar
{
    public class AvatarExpressionApplicationResult
    {
        public string expressionKey = "";
        public string viseme = "";
        public string expressionSource = "none";
        public string appliedExpressionKey = "";
        public bool appliedVrmExpression;
        public bool appliedBlendShapeExpression;
        public int expressionBlendShapeMatchCount;
        public int visemeBlendShapeMatchCount;
        public int availableVrmExpressionKeyCount;
        public string vrmExpressionKeySample = "";
        public int availableBlendShapeKeyCount;
        public string blendShapeKeySample = "";
        public string appliedBlendShapeKeySample = "";

        public static AvatarExpressionApplicationResult Create(
            string expressionKey,
            string viseme,
            int availableVrmExpressionKeyCount,
            string vrmExpressionKeySample,
            int availableBlendShapeKeyCount,
            string blendShapeKeySample)
        {
            return new AvatarExpressionApplicationResult
            {
                expressionKey = expressionKey ?? "",
                viseme = viseme ?? "",
                availableVrmExpressionKeyCount = availableVrmExpressionKeyCount,
                vrmExpressionKeySample = vrmExpressionKeySample ?? "",
                availableBlendShapeKeyCount = availableBlendShapeKeyCount,
                blendShapeKeySample = blendShapeKeySample ?? "",
            };
        }

        public void ResolveExpressionSource()
        {
            if (appliedVrmExpression)
            {
                expressionSource = "vrm-expression";
                return;
            }

            if (appliedBlendShapeExpression)
            {
                expressionSource = "blendshape-fallback";
                return;
            }

            expressionSource = "none";
        }
    }
}
