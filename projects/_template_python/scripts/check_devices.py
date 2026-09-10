#!/usr/bin/env python3
"""
List connected iOS / Android devices (same role as framework checkDevices.js).
Usage:
  python scripts/check_devices.py
  python scripts/check_devices.py ios
  python scripts/check_devices.py android
"""
from __future__ import annotations

import re
import subprocess
import sys


def run(cmd: list[str]) -> str:
    try:
        out = subprocess.check_output(cmd, stderr=subprocess.DEVNULL, text=True)
        return out.strip()
    except Exception:
        return ""


def list_ios() -> list[tuple[str, str]]:
    text = run(["xcrun", "xctrace", "list", "devices"])
    devices: list[tuple[str, str]] = []
    if not text:
        return devices
    for line in text.splitlines():
        # Skip simulators section
        if "Simulators" in line:
            break
        m = re.search(r"^(.+?)\s+\(([0-9.]+)\)\s+\(([0-9A-Fa-f-]+)\)$", line.strip())
        if m:
            devices.append((m.group(1).strip(), m.group(3)))
    return devices


def list_android() -> list[str]:
    text = run(["adb", "devices"])
    ids: list[str] = []
    for line in text.splitlines()[1:]:
        parts = line.split()
        if len(parts) >= 2 and parts[1] == "device":
            ids.append(parts[0])
    return ids


def main() -> int:
    want = (sys.argv[1] if len(sys.argv) > 1 else "all").lower()
    if want in {"ios", "all"}:
        ios = list_ios()
        print("iOS devices:")
        if not ios:
            print("  (none — unlock phone, trust this Mac, check cable)")
        for name, udid in ios:
            print(f"  {name}  {udid}")
    if want in {"android", "all"}:
        androids = list_android()
        print("Android devices:")
        if not androids:
            print("  (none — enable USB debugging)")
        for device_id in androids:
            print(f"  {device_id}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
