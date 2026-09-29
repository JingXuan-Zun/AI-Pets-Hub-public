using System;
using System.Collections;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;
using UnityEngine;
using Debug = UnityEngine.Debug;

namespace AiZc2.Runtime
{
    public sealed class UnityRuntimeWindowController : MonoBehaviour
    {
        private const string OverlayArgument = "--desktop-pet-window-overlay";
        private const int DefaultWindowWidth = 420;
        private const int DefaultWindowHeight = 720;
        private const float ReapplyIntervalSeconds = 2f;
        private const int InitialApplyAttempts = 60;
        private const float InitialApplyDelaySeconds = 0.1f;
        private const uint TransparentColorKey = 0x00000000;
        private const int TargetFrameRate = 165;
        private const int HighQualityAntiAliasingSamples = 8;
        private const float HighQualityLodBias = 2f;
        private static bool hasLoggedAppliedWindowStyle;
        private static IntPtr appliedWindowHandle = IntPtr.Zero;
        private static OverlayBounds appliedOverlayBounds;
        private static bool hasAppliedOverlayBounds;

        private float nextReapplyAt;
        private struct OverlayBounds
        {
            public int x;
            public int y;
            public int width;
            public int height;
        }

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
        private static void Bootstrap()
        {
            if (!ShouldEnableOverlayWindow())
            {
                return;
            }

            if (FindAnyObjectByType<UnityRuntimeWindowController>() != null)
            {
                return;
            }

            var host = new GameObject(nameof(UnityRuntimeWindowController));
            DontDestroyOnLoad(host);
            host.hideFlags = HideFlags.HideAndDontSave;
            host.AddComponent<UnityRuntimeWindowController>();
        }

        private void Awake()
        {
            Application.runInBackground = true;
            ConfigureRenderingQuality();
            PrepareTransparentScene();
        }

        private IEnumerator Start()
        {
            OverlayBounds overlayBounds = ResolveOverlayBounds();
            Screen.fullScreenMode = FullScreenMode.Windowed;
            Screen.SetResolution(overlayBounds.width, overlayBounds.height, false);
            yield return null;

            for (int attempt = 0; attempt < InitialApplyAttempts; attempt += 1)
            {
                PrepareTransparentScene();
                if (TryApplyWindowsOverlayStyles())
                {
                    yield break;
                }

                yield return new WaitForSeconds(InitialApplyDelaySeconds);
            }

            Debug.LogWarning("[UnityRuntimeWindowController] Failed to resolve the Unity player window handle.");
        }

        private void LateUpdate()
        {
            if (Time.unscaledTime < nextReapplyAt)
            {
                return;
            }

            PrepareTransparentScene();
            TryApplyWindowsOverlayStyles(false);
            nextReapplyAt = Time.unscaledTime + ReapplyIntervalSeconds;
        }

        private static bool ShouldEnableOverlayWindow()
        {
            string[] args = Environment.GetCommandLineArgs();
            for (int index = 0; index < args.Length; index += 1)
            {
                if (string.Equals(args[index], OverlayArgument, StringComparison.OrdinalIgnoreCase))
                {
                    return true;
                }
            }

            return false;
        }

        private static void PrepareTransparentScene()
        {
            RenderSettings.skybox = null;

            Camera[] cameras = Camera.allCameras;
            for (int index = 0; index < cameras.Length; index += 1)
            {
                Camera camera = cameras[index];
                if (camera == null)
                {
                    continue;
                }

                camera.clearFlags = CameraClearFlags.SolidColor;
                camera.backgroundColor = Color.black;
                camera.allowHDR = false;
                camera.allowMSAA = true;
            }
        }

        private static void ConfigureRenderingQuality()
        {
            Application.targetFrameRate = TargetFrameRate;
            QualitySettings.antiAliasing = Mathf.Max(QualitySettings.antiAliasing, HighQualityAntiAliasingSamples);
            QualitySettings.anisotropicFiltering = AnisotropicFiltering.ForceEnable;
            QualitySettings.lodBias = Mathf.Max(QualitySettings.lodBias, HighQualityLodBias);
            QualitySettings.masterTextureLimit = 0;
            QualitySettings.maximumLODLevel = 0;
            QualitySettings.skinWeights = SkinWeights.FourBones;
        }

        private static int ResolveOverlayWidth()
        {
            return ResolveOverlayBounds().width;
        }

        private static int ResolveOverlayHeight()
        {
            return ResolveOverlayBounds().height;
        }

        private static OverlayBounds ResolveOverlayBounds()
        {
#if UNITY_STANDALONE_WIN && !UNITY_EDITOR
            OverlayBounds virtualBounds = ResolveVirtualScreenBounds();
            if (virtualBounds.width > 0 && virtualBounds.height > 0)
            {
                return virtualBounds;
            }
#endif

            int width = Screen.currentResolution.width;
            int height = Screen.currentResolution.height;
            return new OverlayBounds
            {
                x = 0,
                y = 0,
                width = width > 0 ? width : DefaultWindowWidth,
                height = height > 0 ? height : DefaultWindowHeight,
            };
        }

#if UNITY_STANDALONE_WIN && !UNITY_EDITOR
        private const int GwlWndProc = -4;
        private const int GwlStyle = -16;
        private const int GwlExStyle = -20;
        private const uint WmNcHitTest = 0x0084;
        private static readonly IntPtr HtTransparent = new IntPtr(-1);
        private const long WsCaption = 0x00C00000L;
        private const long WsThickFrame = 0x00040000L;
        private const long WsMinimizeBox = 0x00020000L;
        private const long WsMaximizeBox = 0x00010000L;
        private const long WsSysMenu = 0x00080000L;
        private const long WsPopup = unchecked((long)0x80000000);
        private const long WsExNoActivate = 0x08000000L;
        private const long WsExToolWindow = 0x00000080L;
        private const long WsExLayered = 0x00080000L;
        private const long WsExTransparent = 0x00000020L;
        private const uint LwaColorKey = 0x00000001;
        private const int SmXVirtualScreen = 76;
        private const int SmYVirtualScreen = 77;
        private const int SmCxVirtualScreen = 78;
        private const int SmCyVirtualScreen = 79;
        private const uint SwpNoActivate = 0x0010;
        private const uint SwpShowWindow = 0x0040;
        private const uint SwpFrameChanged = 0x0020;

        private static readonly IntPtr HwndTopmost = new IntPtr(-1);
        private delegate bool EnumWindowsProc(IntPtr hwnd, IntPtr lParam);
        private delegate IntPtr WindowProc(IntPtr hwnd, uint message, IntPtr wParam, IntPtr lParam);
        private static readonly WindowProc TransparentHitTestWindowProc = HandleOverlayWindowMessage;
        private static IntPtr hookedWindowHandle = IntPtr.Zero;
        private static IntPtr previousWindowProc = IntPtr.Zero;
        private static IntPtr transparentHitTestWindowProcPointer = IntPtr.Zero;

        [StructLayout(LayoutKind.Sequential)]
        private struct Margins
        {
            public int left;
            public int right;
            public int top;
            public int bottom;
        }

        [DllImport("user32.dll", EntryPoint = "GetWindowLongPtrW", SetLastError = true)]
        private static extern IntPtr GetWindowLongPtr(IntPtr hwnd, int index);

        [DllImport("user32.dll", EntryPoint = "SetWindowLongPtrW", SetLastError = true)]
        private static extern IntPtr SetWindowLongPtr(IntPtr hwnd, int index, IntPtr newLong);

        [DllImport("user32.dll", EntryPoint = "CallWindowProcW", SetLastError = true)]
        private static extern IntPtr CallWindowProc(IntPtr previousWindowProc, IntPtr hwnd, uint message, IntPtr wParam, IntPtr lParam);

        [DllImport("user32.dll", EntryPoint = "DefWindowProcW", SetLastError = true)]
        private static extern IntPtr DefWindowProc(IntPtr hwnd, uint message, IntPtr wParam, IntPtr lParam);

        [DllImport("user32.dll")]
        private static extern IntPtr GetActiveWindow();

        [DllImport("user32.dll", SetLastError = true)]
        private static extern bool SetWindowPos(
            IntPtr hwnd,
            IntPtr insertAfter,
            int x,
            int y,
            int cx,
            int cy,
            uint flags);

        [DllImport("user32.dll", SetLastError = true)]
        private static extern bool SetLayeredWindowAttributes(IntPtr hwnd, uint colorKey, byte alpha, uint flags);

        [DllImport("user32.dll")]
        private static extern int GetSystemMetrics(int index);

        [DllImport("user32.dll")]
        private static extern bool EnumWindows(EnumWindowsProc enumProc, IntPtr lParam);

        [DllImport("user32.dll", SetLastError = true)]
        private static extern uint GetWindowThreadProcessId(IntPtr hwnd, out uint processId);

        [DllImport("user32.dll")]
        private static extern bool IsWindowVisible(IntPtr hwnd);

        [DllImport("user32.dll", EntryPoint = "GetClassNameW", SetLastError = true, CharSet = CharSet.Unicode)]
        private static extern int GetClassName(IntPtr hwnd, StringBuilder className, int maxCount);

        [DllImport("dwmapi.dll")]
        private static extern int DwmExtendFrameIntoClientArea(IntPtr hwnd, ref Margins margins);

        private static bool TryApplyWindowsOverlayStyles(bool force = true)
        {
            IntPtr hwnd = ResolveUnityWindowHandle();
            if (hwnd == IntPtr.Zero)
            {
                return false;
            }

            OverlayBounds overlayBounds = ResolveOverlayBounds();
            if (!force && IsOverlayAlreadyApplied(hwnd, overlayBounds))
            {
                return true;
            }

            var margins = new Margins
            {
                left = 0,
                right = 0,
                top = 0,
                bottom = 0,
            };
            int dwmResult = DwmExtendFrameIntoClientArea(hwnd, ref margins);
            long previousExStyleValue = GetWindowLongPtr(hwnd, GwlExStyle).ToInt64();
            long exStyle = previousExStyleValue | WsExLayered | WsExNoActivate | WsExToolWindow | WsExTransparent;
            IntPtr previousExStyle = SetWindowLongPtr(hwnd, GwlExStyle, new IntPtr(exStyle));
            int exStyleError = Marshal.GetLastWin32Error();
            bool layeredResult = SetLayeredWindowAttributes(hwnd, TransparentColorKey, 255, LwaColorKey);
            int layeredError = Marshal.GetLastWin32Error();
            long style = GetWindowLongPtr(hwnd, GwlStyle).ToInt64();
            style &= ~(WsCaption | WsThickFrame | WsMinimizeBox | WsMaximizeBox | WsSysMenu);
            style |= WsPopup;
            IntPtr previousStyle = SetWindowLongPtr(hwnd, GwlStyle, new IntPtr(style));
            int styleError = Marshal.GetLastWin32Error();
            bool posResult = SetWindowPos(
                hwnd,
                HwndTopmost,
                overlayBounds.x,
                overlayBounds.y,
                overlayBounds.width,
                overlayBounds.height,
                SwpNoActivate | SwpShowWindow | SwpFrameChanged);
            int posError = Marshal.GetLastWin32Error();
            bool hitTestHookResult = TryInstallTransparentHitTest(hwnd, out int hitTestHookError);

            if (layeredResult && posResult)
            {
                appliedWindowHandle = hwnd;
                appliedOverlayBounds = overlayBounds;
                hasAppliedOverlayBounds = true;
            }

            if (!hasLoggedAppliedWindowStyle)
            {
                hasLoggedAppliedWindowStyle = true;
                Debug.Log(
                    "[UnityRuntimeWindowController] Applied overlay window styles "
                    + $"hwnd=0x{hwnd.ToInt64():X} "
                    + $"class='{GetWindowClassName(hwnd)}' "
                    + $"previousStyle=0x{previousStyle.ToInt64():X} style=0x{style:X} styleError={styleError} "
                    + $"previousExStyle=0x{previousExStyle.ToInt64():X} previousExStyleValue=0x{previousExStyleValue:X} "
                    + $"exStyle=0x{exStyle:X} exStyleError={exStyleError} "
                    + $"margins=({margins.left},{margins.right},{margins.top},{margins.bottom}) "
                    + $"overlay=({overlayBounds.x},{overlayBounds.y},{overlayBounds.width},{overlayBounds.height}) "
                    + $"dwmResult={dwmResult} layeredColorKey=0x{TransparentColorKey:X} "
                    + $"layeredColorKeyResult={layeredResult} layeredColorKeyError={layeredError} "
                    + $"posResult={posResult} posError={posError} "
                    + $"hitTestHookResult={hitTestHookResult} hitTestHookError={hitTestHookError}");
            }

            return layeredResult && posResult;
        }

        private static bool IsOverlayAlreadyApplied(IntPtr hwnd, OverlayBounds overlayBounds)
        {
            if (
                hwnd == IntPtr.Zero
                || appliedWindowHandle != hwnd
                || !hasAppliedOverlayBounds
                || !AreOverlayBoundsEqual(appliedOverlayBounds, overlayBounds)
            )
            {
                return false;
            }

            long exStyle = GetWindowLongPtr(hwnd, GwlExStyle).ToInt64();
            const long requiredExStyle = WsExLayered | WsExNoActivate | WsExToolWindow | WsExTransparent;
            if ((exStyle & requiredExStyle) != requiredExStyle)
            {
                return false;
            }

            long style = GetWindowLongPtr(hwnd, GwlStyle).ToInt64();
            const long forbiddenStyle = WsCaption | WsThickFrame | WsMinimizeBox | WsMaximizeBox | WsSysMenu;
            return (style & forbiddenStyle) == 0
                && (style & WsPopup) == WsPopup
                && IsTransparentHitTestInstalled(hwnd);
        }

        private static bool AreOverlayBoundsEqual(OverlayBounds left, OverlayBounds right)
        {
            return left.x == right.x
                && left.y == right.y
                && left.width == right.width
                && left.height == right.height;
        }

        private static OverlayBounds ResolveVirtualScreenBounds()
        {
            int width = GetSystemMetrics(SmCxVirtualScreen);
            int height = GetSystemMetrics(SmCyVirtualScreen);

            return new OverlayBounds
            {
                x = GetSystemMetrics(SmXVirtualScreen),
                y = GetSystemMetrics(SmYVirtualScreen),
                width = width > 0 ? width : DefaultWindowWidth,
                height = height > 0 ? height : DefaultWindowHeight,
            };
        }

        private static bool TryInstallTransparentHitTest(IntPtr hwnd, out int error)
        {
            error = 0;
            if (hwnd == IntPtr.Zero)
            {
                return false;
            }

            IntPtr nextWindowProc = GetTransparentHitTestWindowProcPointer();
            IntPtr currentWindowProc = GetWindowLongPtr(hwnd, GwlWndProc);
            if (
                hookedWindowHandle == hwnd
                && previousWindowProc != IntPtr.Zero
                && currentWindowProc == nextWindowProc
            )
            {
                return true;
            }

            IntPtr previousProc = SetWindowLongPtr(hwnd, GwlWndProc, nextWindowProc);
            error = Marshal.GetLastWin32Error();
            if (previousProc == IntPtr.Zero)
            {
                return false;
            }

            hookedWindowHandle = hwnd;
            if (previousProc != nextWindowProc)
            {
                previousWindowProc = previousProc;
            }
            return true;
        }

        private static IntPtr GetTransparentHitTestWindowProcPointer()
        {
            if (transparentHitTestWindowProcPointer == IntPtr.Zero)
            {
                transparentHitTestWindowProcPointer = Marshal.GetFunctionPointerForDelegate(TransparentHitTestWindowProc);
            }

            return transparentHitTestWindowProcPointer;
        }

        private static bool IsTransparentHitTestInstalled(IntPtr hwnd)
        {
            return hwnd != IntPtr.Zero
                && hookedWindowHandle == hwnd
                && previousWindowProc != IntPtr.Zero
                && GetWindowLongPtr(hwnd, GwlWndProc) == GetTransparentHitTestWindowProcPointer();
        }

        private static IntPtr HandleOverlayWindowMessage(IntPtr hwnd, uint message, IntPtr wParam, IntPtr lParam)
        {
            if (message == WmNcHitTest)
            {
                return HtTransparent;
            }

            return previousWindowProc != IntPtr.Zero
                ? CallWindowProc(previousWindowProc, hwnd, message, wParam, lParam)
                : DefWindowProc(hwnd, message, wParam, lParam);
        }

        private static IntPtr ResolveUnityWindowHandle()
        {
            IntPtr activeWindowHandle = GetActiveWindow();
            if (activeWindowHandle != IntPtr.Zero)
            {
                return activeWindowHandle;
            }

            using (Process currentProcess = Process.GetCurrentProcess())
            {
                if (currentProcess.MainWindowHandle != IntPtr.Zero)
                {
                    return currentProcess.MainWindowHandle;
                }

                return ResolveTopLevelWindowHandle((uint)currentProcess.Id);
            }
        }

        private static IntPtr ResolveTopLevelWindowHandle(uint currentProcessId)
        {
            IntPtr resolvedHandle = IntPtr.Zero;
            EnumWindows((hwnd, _lParam) =>
            {
                GetWindowThreadProcessId(hwnd, out uint windowProcessId);
                if (windowProcessId != currentProcessId)
                {
                    return true;
                }

                if (!IsWindowVisible(hwnd))
                {
                    return true;
                }

                string className = GetWindowClassName(hwnd);
                if (string.Equals(className, "UnityWndClass", StringComparison.OrdinalIgnoreCase))
                {
                    resolvedHandle = hwnd;
                    return false;
                }

                if (resolvedHandle == IntPtr.Zero)
                {
                    resolvedHandle = hwnd;
                }

                return true;
            }, IntPtr.Zero);

            return resolvedHandle;
        }

        private static string GetWindowClassName(IntPtr hwnd)
        {
            var className = new StringBuilder(256);
            int length = GetClassName(hwnd, className, className.Capacity);
            return length > 0 ? className.ToString() : "";
        }
#else
        private static bool TryApplyWindowsOverlayStyles(bool force = true)
        {
            _ = force;
            return true;
        }
#endif
    }
}
