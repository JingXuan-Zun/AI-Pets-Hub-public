using System.Collections.Generic;
using System.Linq;

namespace AiZc2.Avatar
{
    internal class AvatarBlendShapeExpressionMatch
    {
        public readonly int count;
        public readonly string sample;

        public AvatarBlendShapeExpressionMatch(IEnumerable<string> keys)
        {
            var uniqueKeys = keys
                .Where((key) => !string.IsNullOrWhiteSpace(key))
                .Distinct()
                .ToArray();
            count = uniqueKeys.Length;
            sample = string.Join(",", uniqueKeys.Take(8));
        }
    }
}
