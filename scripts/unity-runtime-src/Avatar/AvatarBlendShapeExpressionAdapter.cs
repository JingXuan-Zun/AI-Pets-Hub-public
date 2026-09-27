using System;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;

namespace AiZc2.Avatar
{
    internal class AvatarBlendShapeExpressionAdapter
    {
        private class Binding
        {
            public int index;
            public string key = "";
            public SkinnedMeshRenderer renderer;
        }

        private readonly List<Binding> bindings = new List<Binding>();
        private readonly HashSet<string> previousKeys = new HashSet<string>();

        public void Bind(GameObject avatarRoot)
        {
            Clear();
            bindings.Clear();
            if (avatarRoot == null)
            {
                return;
            }

            foreach (var renderer in avatarRoot.GetComponentsInChildren<SkinnedMeshRenderer>(true))
            {
                AddRendererBindings(renderer);
            }
        }

        public AvatarBlendShapeExpressionMatch QueueWeights(
            Dictionary<string, float> pendingWeights,
            IEnumerable<string> candidates,
            float weight)
        {
            var matches = ResolveBindings(candidates).ToArray();
            foreach (var binding in matches)
            {
                float currentWeight;
                pendingWeights.TryGetValue(binding.key, out currentWeight);
                pendingWeights[binding.key] = Mathf.Max(currentWeight, weight);
            }

            return new AvatarBlendShapeExpressionMatch(matches.Select((binding) => binding.key));
        }

        public int BindingKeyCount
        {
            get
            {
                return bindings.Select((binding) => binding.key).Distinct().Count();
            }
        }

        public string BindingKeySample
        {
            get
            {
                return string.Join(",", bindings
                    .Select((binding) => binding.key)
                    .Distinct()
                    .Take(12));
            }
        }

        public void ApplyWeights(Dictionary<string, float> pendingWeights)
        {
            foreach (string key in previousKeys.Where((key) => !pendingWeights.ContainsKey(key)).ToArray())
            {
                SetWeight(key, 0f);
                previousKeys.Remove(key);
            }

            foreach (var entry in pendingWeights)
            {
                SetWeight(entry.Key, entry.Value);
                previousKeys.Add(entry.Key);
            }
        }

        public void Clear()
        {
            ApplyWeights(new Dictionary<string, float>());
            previousKeys.Clear();
        }

        public void Unbind()
        {
            Clear();
            bindings.Clear();
        }

        private void AddRendererBindings(SkinnedMeshRenderer renderer)
        {
            Mesh mesh = renderer != null ? renderer.sharedMesh : null;
            if (mesh == null)
            {
                return;
            }

            for (int index = 0; index < mesh.blendShapeCount; index += 1)
            {
                string key = AvatarExpressionCandidates.NormalizeName(mesh.GetBlendShapeName(index));
                if (string.IsNullOrEmpty(key))
                {
                    continue;
                }

                bindings.Add(new Binding
                {
                    index = index,
                    key = key,
                    renderer = renderer,
                });
            }
        }

        private IEnumerable<Binding> ResolveBindings(IEnumerable<string> candidates)
        {
            var normalizedCandidates = candidates
                .Select(AvatarExpressionCandidates.NormalizeName)
                .Where((candidate) => !string.IsNullOrEmpty(candidate))
                .ToArray();
            if (normalizedCandidates.Length == 0)
            {
                return Array.Empty<Binding>();
            }

            var exact = bindings
                .Where((binding) => normalizedCandidates.Contains(binding.key))
                .ToArray();
            return exact.Length > 0
                ? exact
                : bindings.Where((binding) => normalizedCandidates.Any((candidate) =>
                    binding.key.Contains(candidate) || candidate.Contains(binding.key)));
        }

        private void SetWeight(string key, float weight)
        {
            foreach (var binding in bindings.Where((entry) => entry.key == key))
            {
                if (binding.renderer != null)
                {
                    binding.renderer.SetBlendShapeWeight(binding.index, weight);
                }
            }
        }
    }
}
