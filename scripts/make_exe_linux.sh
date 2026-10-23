#!/usr/bin/env bash
# ====================================================================
# Uni Desk — Linux to Windows EXE Builder Launcher
# ====================================================================
# Run this script to launch the graphical GUI for compiling Windows
# .exe files directly on Linux without Wine.
# ====================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Verify python3
if ! command -v python3 &>/dev/null; then
    echo "❌ Error: python3 is not installed or not in PATH."
    exit 1
fi

# Verify tkinter
if ! python3 -c "import tkinter" &>/dev/null; then
    echo "❌ Error: python3-tk (Tkinter) is not installed."
    echo "   Please run: sudo apt install python3-tk"
    exit 1
fi

echo "🚀 Launching Uni Desk Windows EXE Builder Studio GUI..."
python3 scripts/make_exe_gui.py "$@"
