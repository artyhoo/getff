#!/usr/bin/env python3
"""Host-awake active clock helper (dot relay HOST-RESILIENCE §3).

Emits one LF-terminated JSON line per second on stdout:

    {"boot_id": "<kern.bootsessionuuid>", "active_ns": "<decimal nanoseconds>"}

`active_ns` is mach_absolute_time() converted through the timebase — on
darwin it does NOT advance while the host sleeps, which makes it the ONLY
valid budget clock for a host-awake allowance. Node's hrtime /
mach_continuous_time INCLUDE sleep and must never be used as one.

`--sample-once` (R08 independent freshness probe) prints the SAME sample
shape exactly once and exits 0 — the supervisor's independent validator
uses it to prove the continuous helper above is fresh (same boot,
monotonic, bounded skew), so a stalled main helper can never freeze the
budget.

Fail-closed: anything that would make the clock unprovable (non-darwin
platform, unreadable boot uuid, a backwards sample, a broken stdout pipe)
stops the helper with a nonzero exit — never a silently wrong budget.

The supervisor registers its supervised child on stdin as ONE JSON line:

    {"child_pid": 1234, "child_start": "<ps lstart= text>"}

On stdin EOF (supervisor death — the parent-IPC liveness signal) or on
SIGTERM/SIGINT, the helper runs the §5 cessation ladder against that exact
child: re-probe identity via ps; TERM only the exact live process; wait the
grace window (DOT_RELAY_CLOCK_GRACE_S, default 10); re-probe; KILL only if
the SAME live process persists. A pid whose start text differs is never
signaled (PID reuse).

Stdlib only; no network, no filesystem writes, no secrets.
"""

import ctypes
import json
import os
import signal
import subprocess
import sys
import threading
import time

POLL_S = 1.0
GRACE_S = float(os.environ.get("DOT_RELAY_CLOCK_GRACE_S", "10"))


def fail_closed(reason):
    sys.stderr.write("active-clock: CLOCK_UNPROVEN: %s\n" % reason)
    sys.exit(3)


if sys.platform != "darwin":
    fail_closed("mach_absolute_time requires darwin")

_libc = ctypes.CDLL(None, use_errno=True)
if not hasattr(_libc, "mach_absolute_time") or not hasattr(_libc, "mach_timebase_info"):
    fail_closed("mach clock symbols missing")

# mach_absolute_time returns uint64_t; without an explicit restype ctypes
# truncates it to a signed 32-bit int (caught by the first-line regex test).
_libc.mach_absolute_time.restype = ctypes.c_uint64


class _Timebase(ctypes.Structure):
    _fields_ = [("numer", ctypes.c_uint32), ("denom", ctypes.c_uint32)]


_tb = _Timebase()
if _libc.mach_timebase_info(ctypes.byref(_tb)) != 0:
    fail_closed("mach_timebase_info failed")


def active_ns():
    t = _libc.mach_absolute_time()
    return (t * _tb.numer) // _tb.denom


def boot_id():
    try:
        out = subprocess.run(
            ["/usr/sbin/sysctl", "-n", "kern.bootsessionuuid"],
            capture_output=True, text=True, check=True,
        )
    except Exception as exc:  # noqa: BLE001 - any failure is unprovable
        fail_closed("sysctl kern.bootsessionuuid: %s" % exc)
    value = out.stdout.strip()
    if not value:
        fail_closed("empty bootsessionuuid")
    return value


def sample_once():
    """R08 mode: emit ONE {boot_id, active_ns} line (same shape as the stream)."""
    sys.stdout.write(
        json.dumps({"boot_id": boot_id(), "active_ns": str(active_ns())}, separators=(",", ":")) + "\n"
    )
    sys.stdout.flush()


def ps_start(pid):
    """Exact process start text for `pid`, or None when unreadable/dead."""
    try:
        out = subprocess.run(
            ["ps", "-o", "lstart=", "-p", str(pid)],
            capture_output=True, text=True, check=True,
        )
    except Exception:  # noqa: BLE001 - dead or unreadable -> no identity
        return None
    start = out.stdout.strip()
    return start or None


# --------------------------------------------------------------- supervised child

_child = {"pid": None, "start": None}
_child_lock = threading.Lock()


def register_child(line):
    try:
        msg = json.loads(line)
    except ValueError:
        sys.stderr.write("active-clock: bad registration line ignored\n")
        return
    with _child_lock:
        _child["pid"] = msg.get("child_pid")
        _child["start"] = msg.get("child_start")


def snapshot_child():
    with _child_lock:
        return dict(_child)


def _term_exact(pid):
    try:
        os.kill(pid, signal.SIGTERM)
    except ProcessLookupError:
        pass
    except PermissionError:
        sys.stderr.write("active-clock: no permission to TERM %d\n" % pid)


def _kill_exact(pid):
    try:
        os.kill(pid, signal.SIGKILL)
    except (ProcessLookupError, PermissionError):
        pass


def is_exact_live(pid, start):
    if pid is None or not start:
        return False
    current = ps_start(pid)
    return current is not None and current == start


def cease_registered_child():
    """§5 cessation ladder: TERM exact live child -> grace -> KILL same live."""
    child = snapshot_child()
    pid, start = child["pid"], child["start"]
    if pid is None:
        return
    if is_exact_live(pid, start):
        _term_exact(pid)
        time.sleep(max(GRACE_S, 0.0))
        if is_exact_live(pid, start):
            _kill_exact(pid)
    else:
        sys.stderr.write(
            "active-clock: child %s not signaled (identity mismatch or gone)\n" % pid
        )


# --------------------------------------------------------------- lifecycle

_stop = threading.Event()
_exit_code = 0


def initiate_stop(code=0):
    global _exit_code
    _exit_code = code
    _stop.set()


def on_signal(signum, _frame):
    initiate_stop(0)


signal.signal(signal.SIGTERM, on_signal)
signal.signal(signal.SIGINT, on_signal)


def stdin_reader():
    """Registration lines in; EOF (parent death) triggers the cessation ladder."""
    for line in sys.stdin:
        line = line.strip()
        if line:
            register_child(line)
    initiate_stop(0)


threading.Thread(target=stdin_reader, daemon=True).start()


def main():
    # R08 independent freshness probe: ONE validated sample, then exit. Never
    # enters the continuous loop, never registers a child, never depends on
    # stdin (the reader thread seeing instant EOF is harmless here).
    if "--sample-once" in sys.argv[1:]:
        sample_once()
        sys.exit(0)
    bid = boot_id()
    last = None
    while not _stop.is_set():
        ns = active_ns()
        if last is not None and ns < last:
            fail_closed("backwards mach sample")
        last = ns
        try:
            # decimal STRING: nanosecond values exceed JS Number precision
            sys.stdout.write(
                json.dumps({"boot_id": bid, "active_ns": str(ns)}, separators=(",", ":")) + "\n"
            )
            sys.stdout.flush()
        except BrokenPipeError:
            # Supervisor stopped reading: same as supervisor death.
            cease_registered_child()
            os._exit(0)
        _stop.wait(POLL_S)
    # EOF/SIGTERM: run the cessation ladder for the exact registered child.
    cease_registered_child()
    sys.exit(_exit_code)


if __name__ == "__main__":
    main()
