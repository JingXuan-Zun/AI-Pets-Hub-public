namespace AiZc2.Avatar
{
    internal class AvatarVrmExpressionApplyResult
    {
        public bool applied;
        public string keyName = "";

        public static AvatarVrmExpressionApplyResult Miss()
        {
            return new AvatarVrmExpressionApplyResult();
        }

        public static AvatarVrmExpressionApplyResult Applied(string keyName)
        {
            return new AvatarVrmExpressionApplyResult
            {
                applied = true,
                keyName = keyName ?? "",
            };
        }
    }
}
