using System;
using System.Reflection;
using UnityEngine;

namespace AiZc2.Bridge
{
    internal static class AvatarBridgeRuntimeOverrides
    {
        private const string PortArgument = "--desktop-pet-bridge-port";
        private const string HostArgument = "--desktop-pet-bridge-host";

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
        private static void ApplyAfterSceneLoad()
        {
            foreach (var transport in UnityEngine.Object.FindObjectsByType<AvatarBridgeTransport>(
                FindObjectsInactive.Include,
                FindObjectsSortMode.None))
            {
                Apply(transport);
            }
        }

        private static void Apply(AvatarBridgeTransport transport)
        {
            if (transport == null)
            {
                return;
            }

            string[] args = Environment.GetCommandLineArgs();
            string host = ReadArgument(args, HostArgument);
            string port = ReadArgument(args, PortArgument);
            if (!string.IsNullOrWhiteSpace(host))
            {
                SetPrivateField(transport, "tcpHost", host);
            }

            if (int.TryParse(port, out int parsedPort) && parsedPort > 0)
            {
                SetPrivateField(transport, "tcpPort", parsedPort);
            }
        }

        private static string ReadArgument(string[] args, string name)
        {
            for (int index = 0; index < args.Length - 1; index += 1)
            {
                if (string.Equals(args[index], name, StringComparison.OrdinalIgnoreCase))
                {
                    return args[index + 1];
                }
            }

            return "";
        }

        private static void SetPrivateField(object target, string fieldName, object value)
        {
            var field = target.GetType().GetField(fieldName, BindingFlags.Instance | BindingFlags.NonPublic);
            field?.SetValue(target, value);
        }
    }
}
