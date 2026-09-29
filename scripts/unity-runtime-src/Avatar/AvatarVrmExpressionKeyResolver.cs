using System.Collections;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;

namespace AiZc2.Avatar
{
    internal static class AvatarVrmExpressionKeyResolver
    {
        public static List<object> ResolveAvailableKeys(object expressionRuntime)
        {
            object value = ReadMemberValue(expressionRuntime, "ExpressionKeys");
            if (value == null || value is string || !(value is IEnumerable enumerable))
            {
                return new List<object>();
            }

            return enumerable.Cast<object>().Where((item) => item != null).ToList();
        }

        public static bool TryFindAvailableKey(
            IReadOnlyList<object> availableKeys,
            string candidate,
            out object key,
            out string keyName)
        {
            key = null;
            keyName = "";
            string normalizedCandidate = AvatarExpressionCandidates.NormalizeName(candidate);
            if (string.IsNullOrEmpty(normalizedCandidate))
            {
                return false;
            }

            foreach (object availableKey in availableKeys)
            {
                string nextName = ResolveKeyName(availableKey);
                if (AvatarExpressionCandidates.NormalizeName(nextName) != normalizedCandidate)
                {
                    continue;
                }

                key = availableKey;
                keyName = nextName;
                return true;
            }

            return false;
        }

        private static string ResolveKeyName(object key)
        {
            object name = ReadMemberValue(key, "Name");
            return string.IsNullOrWhiteSpace(name?.ToString())
                ? key?.ToString() ?? ""
                : name.ToString();
        }

        private static object ReadMemberValue(object target, string memberName)
        {
            if (target == null)
            {
                return null;
            }

            var flags = BindingFlags.Instance | BindingFlags.Public;
            var type = target.GetType();
            return type.GetProperty(memberName, flags)?.GetValue(target)
                ?? type.GetField(memberName, flags)?.GetValue(target);
        }
    }
}
