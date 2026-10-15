Add-Type -TypeDefinition @"
using System;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;

public class AsarHandleUnlocker {
    [DllImport("ntdll.dll")]
    public static extern int NtQuerySystemInformation(int SystemInformationClass, IntPtr SystemInformation, int SystemInformationLength, out int ReturnLength);

    [DllImport("kernel32.dll", SetLastError = true)]
    public static extern IntPtr OpenProcess(int processAccess, bool bInheritHandle, int processId);

    [DllImport("kernel32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static extern bool DuplicateHandle(IntPtr hSourceProcessHandle, IntPtr hSourceHandle, IntPtr hTargetProcessHandle, out IntPtr lpTargetHandle, uint dwDesiredAccess, [MarshalAs(UnmanagedType.Bool)] bool bInheritHandle, uint dwOptions);

    [DllImport("kernel32.dll")]
    public static extern bool CloseHandle(IntPtr hObject);

    [DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Auto)]
    public static extern uint GetFinalPathNameByHandle(IntPtr hFile, [Out] StringBuilder lpszFilePath, uint cchFilePath, uint dwFlags);

    [DllImport("kernel32.dll")]
    public static extern IntPtr GetCurrentProcess();

    [DllImport("kernel32.dll")]
    public static extern uint GetFileType(IntPtr hFile);

    const int SystemHandleInformation = 16;
    const uint DUPLICATE_CLOSE_SOURCE = 0x00000001;
    const uint DUPLICATE_SAME_ACCESS = 0x00000002;
    const int PROCESS_DUP_HANDLE = 0x0040;
    const uint FILE_TYPE_DISK = 0x0001;

    [StructLayout(LayoutKind.Sequential)]
    public struct SYSTEM_HANDLE_ENTRY {
        public ushort OwnerPid;
        public ushort CreatorBackTraceIndex;
        public byte ObjectType;
        public byte HandleFlags;
        public ushort HandleValue;
        public IntPtr ObjectPointer;
        public uint AccessMask;
    }

    public static int UnlockDirectory(string targetDir) {
        int length = 0x10000;
        IntPtr ptr = Marshal.AllocHGlobal(length);
        int retLength;

        while (NtQuerySystemInformation(SystemHandleInformation, ptr, length, out retLength) == -1073741820) {
            Marshal.FreeHGlobal(ptr);
            length = retLength;
            ptr = Marshal.AllocHGlobal(length);
        }

        long handleCount = Marshal.ReadIntPtr(ptr).ToInt64();
        IntPtr handlePtr = new IntPtr(ptr.ToInt64() + IntPtr.Size);
        int entrySize = Marshal.SizeOf(typeof(SYSTEM_HANDLE_ENTRY));

        int closedCount = 0;
        IntPtr curProc = GetCurrentProcess();

        for (long i = 0; i < handleCount; i++) {
            SYSTEM_HANDLE_ENTRY entry = (SYSTEM_HANDLE_ENTRY)Marshal.PtrToStructure(handlePtr, typeof(SYSTEM_HANDLE_ENTRY));
            handlePtr = new IntPtr(handlePtr.ToInt64() + entrySize);

            // Open process
            IntPtr hProcess = OpenProcess(PROCESS_DUP_HANDLE, false, (int)entry.OwnerPid);
            if (hProcess == IntPtr.Zero) continue;

            IntPtr dupHandle = IntPtr.Zero;
            if (DuplicateHandle(hProcess, new IntPtr(entry.HandleValue), curProc, out dupHandle, 0, false, DUPLICATE_SAME_ACCESS)) {
                if (GetFileType(dupHandle) == FILE_TYPE_DISK) {
                    StringBuilder sb = new StringBuilder(1024);
                    uint res = GetFinalPathNameByHandle(dupHandle, sb, (uint)sb.Capacity, 0);
                    if (res > 0) {
                        string path = sb.ToString();
                        // Only close handles that are within the target directory and match app.asar or win-unpacked
                        if (path.IndexOf(targetDir, StringComparison.OrdinalIgnoreCase) >= 0 &&
                           (path.IndexOf("app.asar", StringComparison.OrdinalIgnoreCase) >= 0 || path.IndexOf("win-unpacked", StringComparison.OrdinalIgnoreCase) >= 0)) {
                            Console.WriteLine("Safely unlocked handle in PID " + entry.OwnerPid + " -> " + path);
                            IntPtr dummy = IntPtr.Zero;
                            DuplicateHandle(hProcess, new IntPtr(entry.HandleValue), IntPtr.Zero, out dummy, 0, false, DUPLICATE_CLOSE_SOURCE);
                            closedCount++;
                        }
                    }
                }
                CloseHandle(dupHandle);
            }
            CloseHandle(hProcess);
        }

        Marshal.FreeHGlobal(ptr);
        return closedCount;
    }
}
"@

$relDir = Join-Path (Split-Path -Parent $PSScriptRoot) "release"
if (Test-Path $relDir) {
    $target = (Resolve-Path $relDir).Path
    $closed = [AsarHandleUnlocker]::UnlockDirectory($target)
    if ($closed -gt 0) {
        Write-Host "Safely unlocked $closed handles in $target"
    }
}
