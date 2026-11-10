using System;
using System.ComponentModel;
using System.Diagnostics;
using System.Runtime.InteropServices;

internal static class MemoryGuard
{
    private const uint JobMemoryLimit = 0x200;
    private const uint KillOnJobClose = 0x2000;
    private const uint JobMemoryLimitMessage = 10;

    [StructLayout(LayoutKind.Sequential)]
    private struct BasicLimits
    {
        public long ProcessTime, JobTime;
        public uint Flags;
        public UIntPtr MinimumWorkingSet, MaximumWorkingSet;
        public uint ActiveProcesses;
        public UIntPtr Affinity;
        public uint Priority, Scheduling;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct ExtendedLimits
    {
        public BasicLimits Basic;
        public ulong ReadCount, WriteCount, OtherCount, ReadBytes, WriteBytes, OtherBytes;
        public UIntPtr ProcessMemory, JobMemory, PeakProcessMemory, PeakJobMemory;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct CompletionPort
    {
        public IntPtr Key, Port;
    }

    [DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
    private static extern IntPtr CreateJobObject(IntPtr attributes, string name);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool SetInformationJobObject(IntPtr job, int kind, ref ExtendedLimits data, int size);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool SetInformationJobObject(IntPtr job, int kind, ref CompletionPort data, int size);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool AssignProcessToJobObject(IntPtr job, IntPtr process);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern IntPtr CreateIoCompletionPort(IntPtr file, IntPtr port, IntPtr key, uint threads);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool GetQueuedCompletionStatus(IntPtr port, out uint message, out IntPtr key, out IntPtr data, uint timeout);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool TerminateJobObject(IntPtr job, uint exitCode);

    [DllImport("kernel32.dll")]
    private static extern bool CloseHandle(IntPtr handle);

    private static void Check(bool ok)
    {
        if (!ok) throw new Win32Exception(Marshal.GetLastWin32Error());
    }

    public static int Main(string[] args)
    {
        int pid, softMiB, hardMiB;
        if (args.Length != 3 || !int.TryParse(args[0], out pid)
            || !int.TryParse(args[1], out softMiB) || !int.TryParse(args[2], out hardMiB)
            || softMiB <= 0 || hardMiB <= softMiB || hardMiB > 2048) return 2;

        const long MiB = 1024L * 1024;
        IntPtr job = IntPtr.Zero, port = IntPtr.Zero;
        try
        {
            using (Process app = Process.GetProcessById(pid))
            {
                job = CreateJobObject(IntPtr.Zero, null);
                Check(job != IntPtr.Zero);
                port = CreateIoCompletionPort(new IntPtr(-1), IntPtr.Zero, IntPtr.Zero, 1);
                Check(port != IntPtr.Zero);
                var association = new CompletionPort { Key = new IntPtr(1), Port = port };
                Check(SetInformationJobObject(job, 7, ref association, Marshal.SizeOf(typeof(CompletionPort))));
                var limits = new ExtendedLimits {
                    Basic = new BasicLimits { Flags = JobMemoryLimit | KillOnJobClose },
                    JobMemory = new UIntPtr((ulong)(hardMiB * MiB))
                };
                Check(SetInformationJobObject(job, 9, ref limits, Marshal.SizeOf(typeof(ExtendedLimits))));
                Check(AssignProcessToJobObject(job, app.Handle));
                Console.WriteLine("READY");
                while (!app.HasExited)
                {
                    uint message;
                    IntPtr key, data;
                    bool received = GetQueuedCompletionStatus(port, out message, out key, out data, 500);
                    if (!received) Check(Marshal.GetLastWin32Error() == 258); // WAIT_TIMEOUT
                    app.Refresh();
                    if (app.HasExited) break;
                    long committed;
                    try { committed = app.PrivateMemorySize64; }
                    catch (InvalidOperationException)
                    {
                        if (app.HasExited) break;
                        throw;
                    }
                    if ((received && message == JobMemoryLimitMessage) || committed >= softMiB * MiB)
                    {
                        Console.Error.WriteLine("QUASI_MEMORY_RESTART pid={0} privateMiB={1} softMiB={2} hardMiB={3}",
                            pid, committed / MiB, softMiB, hardMiB);
                        Check(TerminateJobObject(job, 75));
                        break;
                    }
                }
            }
            return 0;
        }
        catch (Exception error)
        {
            Console.Error.WriteLine("QUASI_MEMORY_GUARD_FAILED " + error.Message);
            return 1;
        }
        finally
        {
            if (job != IntPtr.Zero) CloseHandle(job);
            if (port != IntPtr.Zero) CloseHandle(port);
        }
    }
}
