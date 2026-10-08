const desktopIconListViewMoveWindowLookupCSharp = String.raw`  private static IntPtr FindDesktopListView() {
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

    IntPtr bestCandidate = ChooseBestListViewCandidate(candidates);
    if (bestCandidate != IntPtr.Zero) {
      return bestCandidate;
    }

    EnumWindows(delegate(IntPtr hWnd, IntPtr lParam) {
      AddListViewCandidates(hWnd, candidates);
      return true;
    }, IntPtr.Zero);

    return ChooseBestListViewCandidate(candidates);
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

  private static IntPtr ChooseBestListViewCandidate(List<IntPtr> candidates) {
    IntPtr bestCandidate = IntPtr.Zero;
    int bestCount = 0;

    foreach (IntPtr candidate in candidates) {
      int count = SendMessage(candidate, LVM_GETITEMCOUNT, IntPtr.Zero, IntPtr.Zero).ToInt32();
      if (count > bestCount) {
        bestCandidate = candidate;
        bestCount = count;
      }
    }

    return bestCandidate;
  }

  private static string GetWindowClassName(IntPtr hWnd) {
    StringBuilder className = new StringBuilder(256);
    GetClassName(hWnd, className, className.Capacity);
    return className.ToString();
  }
}
`;

module.exports = { desktopIconListViewMoveWindowLookupCSharp };
