const DESKTOP_INPUT_NATIVE_INTEROP = String.raw`using System;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;

public static class DesktopPetInput {
  [StructLayout(LayoutKind.Sequential)]
  public struct POINT {
    public int X;
    public int Y;
  }

  [StructLayout(LayoutKind.Sequential)]
  public struct INPUT {
    public uint type;
    public MOUSEINPUT mi;
  }

  [StructLayout(LayoutKind.Sequential)]
  public struct MOUSEINPUT {
    public int dx;
    public int dy;
    public uint mouseData;
    public uint dwFlags;
    public uint time;
    public UIntPtr dwExtraInfo;
  }

  [StructLayout(LayoutKind.Sequential)]
  public struct TOKEN_ELEVATION {
    public int TokenIsElevated;
  }

  [StructLayout(LayoutKind.Sequential)]
  public struct RECT {
    public int left;
    public int top;
    public int right;
    public int bottom;
  }

  [StructLayout(LayoutKind.Sequential)]
  public struct POINTER_INFO {
    public uint pointerType;
    public uint pointerId;
    public uint frameId;
    public uint pointerFlags;
    public IntPtr sourceDevice;
    public IntPtr hwndTarget;
    public POINT ptPixelLocation;
    public POINT ptHimetricLocation;
    public POINT ptPixelLocationRaw;
    public POINT ptHimetricLocationRaw;
    public uint dwTime;
    public uint historyCount;
    public int inputData;
    public uint dwKeyStates;
    public ulong PerformanceCount;
    public int ButtonChangeType;
  }

  [StructLayout(LayoutKind.Sequential)]
  public struct POINTER_TOUCH_INFO {
    public POINTER_INFO pointerInfo;
    public uint touchFlags;
    public uint touchMask;
    public RECT rcContact;
    public RECT rcContactRaw;
    public uint orientation;
    public uint pressure;
  }

  [DllImport("user32.dll")]
  public static extern bool SetCursorPos(int X, int Y);

  [DllImport("user32.dll")]
  public static extern bool GetCursorPos(out POINT lpPoint);

  [DllImport("user32.dll")]
  public static extern int GetSystemMetrics(int nIndex);

  [DllImport("user32.dll")]
  public static extern IntPtr GetForegroundWindow();

  [DllImport("user32.dll")]
  public static extern IntPtr WindowFromPoint(POINT point);

  [DllImport("user32.dll")]
  public static extern IntPtr GetAncestor(IntPtr hWnd, uint gaFlags);

  [DllImport("user32.dll", CharSet = CharSet.Unicode)]
  public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);

  [DllImport("user32.dll")]
  public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);

  [DllImport("user32.dll", SetLastError=true)]
  public static extern uint SendInput(uint nInputs, INPUT[] pInputs, int cbSize);

  [StructLayout(LayoutKind.Sequential)]
  public struct KEYBDINPUT {
    public ushort wVk;
    public ushort wScan;
    public uint dwFlags;
    public uint time;
    public UIntPtr dwExtraInfo;
  }

  // Same size as INPUT (whose union is sized by MOUSEINPUT), keyboard member instead.
  [StructLayout(LayoutKind.Sequential)]
  public struct KEYINPUT {
    public uint type;
    public KEYBDINPUT ki;
    public uint padding1;
    public uint padding2;
  }

  [DllImport("user32.dll", EntryPoint="SendInput", SetLastError=true)]
  public static extern uint SendKeyboardInput(uint nInputs, KEYINPUT[] pInputs, int cbSize);

  private static KEYINPUT KeyInput(ushort vk, ushort scan, uint flags) {
    KEYINPUT input = new KEYINPUT();
    input.type = 1;
    input.ki.wVk = vk;
    input.ki.wScan = scan;
    input.ki.dwFlags = flags;
    return input;
  }

  // Types text as Unicode characters (KEYEVENTF_UNICODE). Unlike SendKeys, letters are not
  // turned into pinyin by an active Chinese IME. Newlines and tabs are real key presses.
  // Returns false when SendInput rejected the input, so the caller can fall back.
  public static bool TypeUnicode(string text) {
    int size = Marshal.SizeOf(typeof(INPUT));
    if (Marshal.SizeOf(typeof(KEYINPUT)) != size) return false;
    const int chunk = 1;
    for (int start = 0; start < text.Length; start += chunk) {
      var inputs = new System.Collections.Generic.List<KEYINPUT>();
      for (int index = start; index < Math.Min(text.Length, start + chunk); index++) {
        char c = text[index];
        if (c == '\r') continue;
        if (c == '\n' || c == '\t') {
          ushort vk = (ushort)(c == '\n' ? 0x0D : 0x09);
          inputs.Add(KeyInput(vk, 0, 0));
          inputs.Add(KeyInput(vk, 0, 0x0002));
          continue;
        }
        inputs.Add(KeyInput(0, c, 0x0004));
        inputs.Add(KeyInput(0, c, 0x0004 | 0x0002));
      }
      if (inputs.Count == 0) continue;
      uint sent = SendKeyboardInput((uint)inputs.Count, inputs.ToArray(), size);
      if (sent != inputs.Count) return false;
      System.Threading.Thread.Sleep(8);
    }
    return true;
  }

  [DllImport("user32.dll")]
  public static extern void mouse_event(uint dwFlags, uint dx, uint dy, uint dwData, UIntPtr dwExtraInfo);

  [DllImport("user32.dll")]
  public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);

  [DllImport("user32.dll", SetLastError=true)]
  public static extern bool InitializeTouchInjection(uint maxCount, uint dwMode);

  [DllImport("user32.dll", SetLastError=true)]
  public static extern bool InjectTouchInput(uint count, POINTER_TOUCH_INFO[] contacts);

  [DllImport("advapi32.dll", SetLastError=true)]
  public static extern bool OpenProcessToken(IntPtr ProcessHandle, uint DesiredAccess, out IntPtr TokenHandle);

  [DllImport("advapi32.dll", SetLastError=true)]
  public static extern bool GetTokenInformation(IntPtr TokenHandle, int TokenInformationClass, out TOKEN_ELEVATION TokenInformation, int TokenInformationLength, out int ReturnLength);

  [DllImport("kernel32.dll", SetLastError=true)]
  public static extern bool CloseHandle(IntPtr hObject);

  [DllImport("kernel32.dll", SetLastError=true)]
  public static extern IntPtr OpenProcess(uint desiredAccess, bool inheritHandle, int processId);

  // Process.Handle asks for full access, which a normal process never gets on an elevated
  // one (WeGame), so elevated windows used to read as "unknown" and clicks just failed.
  // Query-only access works across the boundary, like Task Manager's "Elevated" column; if
  // even the token is refused, the process runs above us.
  public static bool TryIsProcessElevated(int pid, out bool elevated) {
    elevated = false;
    IntPtr token = IntPtr.Zero;
    IntPtr processHandle = IntPtr.Zero;
    try {
      processHandle = OpenProcess(0x1000, false, pid);
      if (processHandle == IntPtr.Zero) {
        return false;
      }
      if (!OpenProcessToken(processHandle, 0x0008, out token)) {
        if (Marshal.GetLastWin32Error() == 5) {
          elevated = true;
          return true;
        }
        return false;
      }

      TOKEN_ELEVATION elevation;
      int returnLength;
      if (!GetTokenInformation(token, 20, out elevation, Marshal.SizeOf(typeof(TOKEN_ELEVATION)), out returnLength)) {
        return false;
      }

      elevated = elevation.TokenIsElevated != 0;
      return true;
    } catch {
      return false;
    } finally {
      if (token != IntPtr.Zero) {
        CloseHandle(token);
      }
      if (processHandle != IntPtr.Zero) {
        CloseHandle(processHandle);
      }
    }
  }

  public static INPUT CreateMouseInput(uint flags) {
    INPUT input = new INPUT();
    input.type = 0;
    input.mi = new MOUSEINPUT();
    input.mi.dwFlags = flags;
    return input;
  }

  public static INPUT CreateAbsoluteMouseMove(int x, int y) {
    const int SM_XVIRTUALSCREEN = 76;
    const int SM_YVIRTUALSCREEN = 77;
    const int SM_CXVIRTUALSCREEN = 78;
    const int SM_CYVIRTUALSCREEN = 79;
    int left = GetSystemMetrics(SM_XVIRTUALSCREEN);
    int top = GetSystemMetrics(SM_YVIRTUALSCREEN);
    int width = Math.Max(1, GetSystemMetrics(SM_CXVIRTUALSCREEN));
    int height = Math.Max(1, GetSystemMetrics(SM_CYVIRTUALSCREEN));
    int absoluteX = (int)Math.Round((x - left) * 65535.0 / Math.Max(1, width - 1));
    int absoluteY = (int)Math.Round((y - top) * 65535.0 / Math.Max(1, height - 1));
    INPUT input = CreateMouseInput(0x0001 | 0x8000);
    input.mi.dx = Math.Max(0, Math.Min(65535, absoluteX));
    input.mi.dy = Math.Max(0, Math.Min(65535, absoluteY));
    return input;
  }

  public static POINTER_TOUCH_INFO CreatePrimaryTouch(uint id, int x, int y, uint flags, IntPtr hwndTarget) {
    POINTER_TOUCH_INFO contact = new POINTER_TOUCH_INFO();
    contact.pointerInfo.pointerType = 2;
    contact.pointerInfo.pointerId = id;
    contact.pointerInfo.frameId = 0;
    contact.pointerInfo.pointerFlags = flags;
    contact.pointerInfo.sourceDevice = IntPtr.Zero;
    contact.pointerInfo.hwndTarget = hwndTarget;
    contact.pointerInfo.ptPixelLocation.X = x;
    contact.pointerInfo.ptPixelLocation.Y = y;
    contact.pointerInfo.ptHimetricLocation.X = 0;
    contact.pointerInfo.ptHimetricLocation.Y = 0;
    contact.pointerInfo.ptPixelLocationRaw.X = x;
    contact.pointerInfo.ptPixelLocationRaw.Y = y;
    contact.pointerInfo.ptHimetricLocationRaw.X = 0;
    contact.pointerInfo.ptHimetricLocationRaw.Y = 0;
    contact.pointerInfo.dwTime = 0;
    contact.pointerInfo.historyCount = 1;
    contact.pointerInfo.inputData = 0;
    contact.pointerInfo.dwKeyStates = 0;
    contact.pointerInfo.PerformanceCount = 0;
    contact.pointerInfo.ButtonChangeType = 0;
    contact.touchFlags = 0;
    contact.touchMask = 0x00000001 | 0x00000002 | 0x00000004;
    contact.rcContact.left = x - 3;
    contact.rcContact.right = x + 3;
    contact.rcContact.top = y - 3;
    contact.rcContact.bottom = y + 3;
    contact.rcContactRaw = contact.rcContact;
    contact.orientation = 90;
    contact.pressure = 512;
    return contact;
  }
}`;

module.exports = { DESKTOP_INPUT_NATIVE_INTEROP };
