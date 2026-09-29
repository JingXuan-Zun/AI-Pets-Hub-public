using System;
using System.Collections.Generic;
using System.Linq;

namespace AiZc2.Avatar
{
    internal static class AvatarExpressionCandidates
    {
        public static IEnumerable<string> ResolveExpressionCandidates(string expressionKey)
        {
            string key = expressionKey ?? "";
            var candidates = new List<string> { key, key.ToLowerInvariant() };

            switch (NormalizeName(key))
            {
                case "happy":
                case "smile":
                    candidates.AddRange(new[] { "happy", "joy", "smile", "\u7B11\u3044", "\u7B11\u9854", "\u53E3\u89D2\u4E0A\u3052" });
                    break;
                case "sad":
                    candidates.AddRange(new[] { "sad", "sorrow", "frown", "\u53E3\u89D2\u4E0B\u3052" });
                    break;
                case "mouthcornerup":
                    candidates.AddRange(new[] { "mouthcornerup", "\u53E3\u89D2\u4E0A\u3052" });
                    break;
                case "sleeping":
                case "relaxed":
                    candidates.AddRange(new[] { "relaxed", "sleeping", "blink", "\u307E\u3070\u305F\u304D" });
                    break;
                case "eating":
                    candidates.AddRange(new[] { "eating", "eat", "happy" });
                    break;
            }

            return UniqueNonEmpty(candidates);
        }

        public static IEnumerable<string> ResolveVisemeCandidates(string viseme)
        {
            switch (NormalizeName(viseme))
            {
                case "aa":
                    return new[] { "aa", "a", "mouthopen", "open", "\u3042" };
                case "ee":
                    return new[] { "ee", "e", "\u3048" };
                case "ih":
                    return new[] { "ih", "i", "\u3044" };
                case "oh":
                    return new[] { "oh", "o", "\u304A" };
                case "ou":
                    return new[] { "ou", "u", "\u3046" };
                default:
                    return Array.Empty<string>();
            }
        }

        public static string NormalizeName(string value)
        {
            return new string((value ?? "")
                .Trim()
                .ToLowerInvariant()
                .Where(char.IsLetterOrDigit)
                .ToArray());
        }

        private static IEnumerable<string> UniqueNonEmpty(IEnumerable<string> values)
        {
            return values
                .Select((value) => value?.Trim() ?? "")
                .Where((value) => !string.IsNullOrWhiteSpace(value))
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToArray();
        }
    }
}
