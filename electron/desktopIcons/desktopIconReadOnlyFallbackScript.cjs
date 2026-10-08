const desktopIconReadOnlyFallbackPowerShellBlock = String.raw`if ($IncludeReadOnlyPositionFallback -and @($icons).Count -eq 0) {
  try {
    Add-Type -ReferencedAssemblies @('UIAutomationClient', 'UIAutomationTypes', 'WindowsBase') -TypeDefinition @"
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Text;
using System.Windows;
using System.Windows.Automation;

public class DesktopPetDesktopIconAutomationInfo {
  public bool canMove { get; set; }
  public int index { get; set; }
  public string name { get; set; }
  public string positionSource { get; set; }
  public int x { get; set; }
  public int y { get; set; }
  public int width { get; set; }
  public int height { get; set; }
  public int centerX { get; set; }
  public int centerY { get; set; }
  public int desktopGridCellWidth { get; set; }
  public int desktopGridCellHeight { get; set; }
}

public static class DesktopPetDesktopIconAutomationReader {
  private const int DEFAULT_ICON_WIDTH = 96;
  private const int DEFAULT_ICON_HEIGHT = 74;
  private delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

  [DllImport("user32.dll", CharSet = CharSet.Unicode)]
  private static extern IntPtr FindWindow(string lpClassName, string lpWindowName);

  [DllImport("user32.dll")]
  private static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);

  [DllImport("user32.dll")]
  private static extern bool EnumChildWindows(IntPtr hWndParent, EnumWindowsProc lpEnumFunc, IntPtr lParam);

  [DllImport("user32.dll", CharSet = CharSet.Unicode)]
  private static extern int GetClassName(IntPtr hWnd, StringBuilder lpClassName, int nMaxCount);

  [DllImport("user32.dll")]
  private static extern bool SetProcessDpiAwarenessContext(IntPtr dpiContext);

  [DllImport("user32.dll")]
  private static extern bool SetProcessDPIAware();

  private static readonly IntPtr DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2 = new IntPtr(-4);

  private static void TryEnableDpiAwareness() {
    try {
      if (SetProcessDpiAwarenessContext(DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2)) {
        return;
      }
    } catch {
    }

    try {
      SetProcessDPIAware();
    } catch {
    }
  }

  public static DesktopPetDesktopIconAutomationInfo[] GetIcons() {
    TryEnableDpiAwareness();
    List<IntPtr> candidates = FindDesktopListViews();
    List<DesktopPetDesktopIconAutomationInfo> bestIcons = new List<DesktopPetDesktopIconAutomationInfo>();

    foreach (IntPtr candidate in candidates) {
      List<DesktopPetDesktopIconAutomationInfo> icons = ReadListViewItems(candidate);
      if (icons.Count > bestIcons.Count) {
        bestIcons = icons;
      }
    }

    return bestIcons.ToArray();
  }

  private static List<DesktopPetDesktopIconAutomationInfo> ReadListViewItems(IntPtr listView) {
    List<DesktopPetDesktopIconAutomationInfo> icons = new List<DesktopPetDesktopIconAutomationInfo>();
    if (listView == IntPtr.Zero) {
      return icons;
    }

    AutomationElement element = null;
    try {
      element = AutomationElement.FromHandle(listView);
    } catch {
      return icons;
    }

    if (element == null) {
      return icons;
    }

    AutomationElementCollection items;
    try {
      Condition listItemCondition = new PropertyCondition(
        AutomationElement.ControlTypeProperty,
        ControlType.ListItem
      );
      items = element.FindAll(TreeScope.Children, listItemCondition);
      if (items == null || items.Count == 0) {
        items = element.FindAll(TreeScope.Descendants, listItemCondition);
      }
    } catch {
      return icons;
    }

    if (items == null || items.Count == 0) {
      return icons;
    }

    int index = 0;
    foreach (AutomationElement item in items) {
      try {
        string name = item.Current.Name;
        Rect rect = item.Current.BoundingRectangle;
        if (String.IsNullOrWhiteSpace(name) || rect.IsEmpty || rect.Width <= 1 || rect.Height <= 1) {
          continue;
        }

        object offscreenValue = item.GetCurrentPropertyValue(AutomationElement.IsOffscreenProperty, true);
        if (offscreenValue is bool && (bool)offscreenValue) {
          continue;
        }

        int x = (int)Math.Round(rect.Left);
        int y = (int)Math.Round(rect.Top);
        int width = Math.Max(1, (int)Math.Round(rect.Width));
        int height = Math.Max(1, (int)Math.Round(rect.Height));
        icons.Add(new DesktopPetDesktopIconAutomationInfo {
          canMove = false,
          index = index,
          name = name,
          positionSource = "ui-automation",
          x = x,
          y = y,
          width = width,
          height = height,
          centerX = x + width / 2,
          centerY = y + height / 2,
          desktopGridCellWidth = DEFAULT_ICON_WIDTH,
          desktopGridCellHeight = DEFAULT_ICON_HEIGHT
        });
        index += 1;
      } catch {
      }
    }

    return icons;
  }

  private static List<IntPtr> FindDesktopListViews() {
    IntPtr progman = FindWindow("Progman", null);
    List<IntPtr> candidates = new List<IntPtr>();

    AddListViewCandidates(progman, candidates);
    EnumWindows(delegate(IntPtr hWnd, IntPtr lParam) {
      string className = GetWindowClassName(hWnd);
      if (className == "Progman" || className == "WorkerW") {
        AddListViewCandidates(hWnd, candidates);
      }

      return true;
    }, IntPtr.Zero);

    return candidates;
  }

  private static void AddListViewCandidates(IntPtr root, List<IntPtr> candidates) {
    if (root == IntPtr.Zero) {
      return;
    }

    EnumChildWindows(root, delegate(IntPtr child, IntPtr lParam) {
      if (GetWindowClassName(child) == "SysListView32" && !candidates.Contains(child)) {
        candidates.Add(child);
      }

      return true;
    }, IntPtr.Zero);
  }

  private static string GetWindowClassName(IntPtr hWnd) {
    StringBuilder className = new StringBuilder(256);
    GetClassName(hWnd, className, className.Capacity);
    return className.ToString();
  }
}
"@
    $automationIcons = [DesktopPetDesktopIconAutomationReader]::GetIcons()
    if (@($automationIcons).Count -gt 0) {
      $icons = $automationIcons
    }
  } catch {
  }
}
`;

module.exports = { desktopIconReadOnlyFallbackPowerShellBlock };
