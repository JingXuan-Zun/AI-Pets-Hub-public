using System;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using UniVRM10;
using UnityEngine;

namespace AiZc2.Avatar
{
    internal class AvatarVrmExpressionAdapter
    {
        private object expressionRuntime;
        private MethodInfo expressionSetMethod;
        private readonly List<object> availableExpressionKeys = new List<object>();
        private readonly List<object> previousExpressionKeys = new List<object>();

        public void Bind(Vrm10Instance vrmInstance)
        {
            Clear();
            expressionRuntime = ResolveExpressionRuntime(vrmInstance);
            expressionSetMethod = ResolveExpressionSetMethod(expressionRuntime);
            availableExpressionKeys.Clear();
            availableExpressionKeys.AddRange(AvatarVrmExpressionKeyResolver.ResolveAvailableKeys(expressionRuntime));
        }

        public AvatarVrmExpressionApplyResult ApplyCandidates(IEnumerable<string> candidates, float weight)
        {
            if (expressionRuntime == null || expressionSetMethod == null)
            {
                return AvatarVrmExpressionApplyResult.Miss();
            }

            foreach (string candidate in candidates)
            {
                if (TryApplyCandidate(candidate, weight, out string keyName))
                {
                    return AvatarVrmExpressionApplyResult.Applied(keyName);
                }
            }

            return AvatarVrmExpressionApplyResult.Miss();
        }

        public int AvailableKeyCount
        {
            get
            {
                return availableExpressionKeys.Count;
            }
        }

        public string AvailableKeySample
        {
            get
            {
                return string.Join(",", availableExpressionKeys
                    .Select((key) => key?.ToString() ?? "")
                    .Where((key) => !string.IsNullOrWhiteSpace(key))
                    .Take(12));
            }
        }

        public void Clear()
        {
            if (expressionRuntime == null || expressionSetMethod == null)
            {
                previousExpressionKeys.Clear();
                return;
            }

            foreach (object key in previousExpressionKeys)
            {
                TrySetWeight(key, 0f);
            }

            previousExpressionKeys.Clear();
        }

        public void Unbind()
        {
            Clear();
            expressionRuntime = null;
            expressionSetMethod = null;
            availableExpressionKeys.Clear();
        }

        private bool TryApplyCandidate(string candidate, float weight, out string keyName)
        {
            keyName = "";
            if (!AvatarVrmExpressionKeyResolver.TryFindAvailableKey(
                availableExpressionKeys,
                candidate,
                out object key,
                out keyName))
            {
                return false;
            }

            if (!TrySetWeight(key, weight))
            {
                return false;
            }

            previousExpressionKeys.Add(key);
            return true;
        }

        private bool TrySetWeight(object key, float weight)
        {
            try
            {
                expressionSetMethod.Invoke(expressionRuntime, new[] { key, weight });
                return true;
            }
            catch (Exception ex)
            {
                Debug.LogWarning($"[AvatarVrmExpressionAdapter] Failed to apply VRM expression: {ex.Message}");
                return false;
            }
        }

        private static object ResolveExpressionRuntime(Vrm10Instance vrmInstance)
        {
            var runtime = vrmInstance != null ? vrmInstance.Runtime : null;
            var runtimeType = runtime != null ? runtime.GetType() : null;
            return runtimeType?.GetProperty("Expression")?.GetValue(runtime)
                ?? runtimeType?.GetProperty("Expressions")?.GetValue(runtime)
                ?? runtimeType?.GetField("Expression")?.GetValue(runtime)
                ?? runtimeType?.GetField("Expressions")?.GetValue(runtime);
        }

        private static MethodInfo ResolveExpressionSetMethod(object runtime)
        {
            if (runtime == null)
            {
                return null;
            }

            return runtime.GetType()
                .GetMethods(BindingFlags.Instance | BindingFlags.Public)
                .FirstOrDefault(IsSupportedSetMethod);
        }

        private static bool IsSupportedSetMethod(MethodInfo method)
        {
            if (method.Name != "SetWeight" && method.Name != "SetValue")
            {
                return false;
            }

            var parameters = method.GetParameters();
            return parameters.Length == 2 && parameters[1].ParameterType == typeof(float);
        }

    }
}
