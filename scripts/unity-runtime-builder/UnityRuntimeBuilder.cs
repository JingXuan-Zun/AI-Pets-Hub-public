using System;
using System.IO;
using System.Linq;
using System.Reflection;
using UnityEditor;
using UnityEngine;
using UnityEngine.Rendering;

namespace AiZc2.Editor
{
    public static class UnityRuntimeBuilder
    {
        private const string DefaultOutputPath = "release/unity-runtime/AI Desktop Pet Unity Runtime.exe";
        private const string MainScenePath = "Assets/Scenes/main.unity";
        private const string RuntimeCompanyName = "AI Desktop Pet";
        private const string RuntimeProductName = "AI Desktop Pet Unity Runtime";

        public static void BuildWindowsRuntime()
        {
            string projectRoot = ResolveDesktopPetProjectRoot();
            string outputPath = ResolveOutputPath(projectRoot);
            string[] scenes = ResolveBuildScenes();

            Directory.CreateDirectory(Path.GetDirectoryName(outputPath) ?? projectRoot);
            ConfigurePlayerWindow();

            var buildOptions = new BuildPlayerOptions
            {
                scenes = scenes,
                locationPathName = outputPath,
                target = BuildTarget.StandaloneWindows64,
                options = BuildOptions.None,
            };

            var report = BuildPipeline.BuildPlayer(buildOptions);
            var summary = report.summary;

            if (summary.result != UnityEditor.Build.Reporting.BuildResult.Succeeded)
            {
                throw new InvalidOperationException($"Unity runtime build failed: {summary.result}");
            }

            UnityEngine.Debug.Log($"[UnityRuntimeBuilder] Built Unity runtime: {outputPath}");
        }

        private static string ResolveDesktopPetProjectRoot()
        {
            string envRoot = Environment.GetEnvironmentVariable("DESKTOP_PET_PROJECT_ROOT");
            if (!string.IsNullOrWhiteSpace(envRoot))
            {
                return Path.GetFullPath(envRoot);
            }

            string unityProjectRoot = Path.GetFullPath(Path.Combine(Application.dataPath, ".."));
            return Path.GetFullPath(Path.Combine(unityProjectRoot, "..", "..", "ai-desktop-pet"));
        }

        private static string ResolveOutputPath(string projectRoot)
        {
            string outputPath = Environment.GetEnvironmentVariable("DESKTOP_PET_UNITY_RUNTIME_OUTPUT");
            if (string.IsNullOrWhiteSpace(outputPath))
            {
                outputPath = Path.Combine(projectRoot, DefaultOutputPath);
            }

            return Path.GetFullPath(outputPath);
        }

        private static string[] ResolveBuildScenes()
        {
            var enabledScenes = EditorBuildSettings.scenes
                .Where(scene => scene.enabled && !string.IsNullOrWhiteSpace(scene.path))
                .Select(scene => scene.path)
                .ToArray();

            if (enabledScenes.Length > 0)
            {
                return enabledScenes;
            }

            return new[] { MainScenePath };
        }

        private static void ConfigurePlayerWindow()
        {
            PlayerSettings.companyName = RuntimeCompanyName;
            PlayerSettings.productName = RuntimeProductName;
            PlayerSettings.fullScreenMode = FullScreenMode.Windowed;
            PlayerSettings.defaultScreenWidth = 420;
            PlayerSettings.defaultScreenHeight = 720;
            PlayerSettings.resizableWindow = true;
            PlayerSettings.runInBackground = true;
            PlayerSettings.SetUseDefaultGraphicsAPIs(BuildTarget.StandaloneWindows64, false);
            PlayerSettings.SetGraphicsAPIs(BuildTarget.StandaloneWindows64, new[] { GraphicsDeviceType.OpenGLCore });
            SetOptionalBoolPlayerSetting("defaultIsNativeResolution", true);
            SetOptionalBoolPlayerSetting("preserveFramebufferAlpha", true);
            SetOptionalBoolPlayerSetting("useFlipModelSwapchain", false);
            ConfigureSplashScreen();
        }

        private static void ConfigureSplashScreen()
        {
            Type splashScreenType = typeof(PlayerSettings).GetNestedType(
                "SplashScreen",
                BindingFlags.Public | BindingFlags.NonPublic);

            if (splashScreenType == null)
            {
                return;
            }

            SetOptionalStaticBoolSetting(splashScreenType, "show", false);
            SetOptionalStaticBoolSetting(splashScreenType, "showUnityLogo", false);
            SetOptionalStaticFloatSetting(splashScreenType, "overlayOpacity", 0f);
        }

        private static void SetOptionalBoolPlayerSetting(string propertyName, bool value)
        {
            var property = typeof(PlayerSettings).GetProperty(propertyName, BindingFlags.Public | BindingFlags.Static);
            if (property == null || property.PropertyType != typeof(bool) || !property.CanWrite)
            {
                return;
            }

            try
            {
                property.SetValue(null, value);
            }
            catch (Exception ex)
            {
                UnityEngine.Debug.LogWarning($"[UnityRuntimeBuilder] Failed to set PlayerSettings.{propertyName}: {ex.Message}");
            }
        }

        private static void SetOptionalStaticBoolSetting(Type declaringType, string propertyName, bool value)
        {
            var property = declaringType.GetProperty(propertyName, BindingFlags.Public | BindingFlags.Static);
            if (property == null || property.PropertyType != typeof(bool) || !property.CanWrite)
            {
                return;
            }

            try
            {
                property.SetValue(null, value);
            }
            catch (Exception ex)
            {
                UnityEngine.Debug.LogWarning($"[UnityRuntimeBuilder] Failed to set {declaringType.FullName}.{propertyName}: {ex.Message}");
            }
        }

        private static void SetOptionalStaticFloatSetting(Type declaringType, string propertyName, float value)
        {
            var property = declaringType.GetProperty(propertyName, BindingFlags.Public | BindingFlags.Static);
            if (property == null || property.PropertyType != typeof(float) || !property.CanWrite)
            {
                return;
            }

            try
            {
                property.SetValue(null, value);
            }
            catch (Exception ex)
            {
                UnityEngine.Debug.LogWarning($"[UnityRuntimeBuilder] Failed to set {declaringType.FullName}.{propertyName}: {ex.Message}");
            }
        }
    }
}
