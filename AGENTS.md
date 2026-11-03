# Workspace Rules for One Tap

## 1. Strict Direct Code Editing (No Scripted Modifiers)
- **NEVER use Python scripts, Node scripts, PowerShell one-liners, or any temporary scripts to modify, replace, or edit the application's source code or configuration files.**
- **ALWAYS edit files directly and manually** using the native editing tools (`edit_file` or `write_file`).
- **NO temporary editing scripts**: Do not create or run helper scripts (e.g., `tools/update_*.py`, `patch.py`, `script.py`, etc.) to rewrite or manipulate application files.
- All code refactoring, styling adjustments, and logic fixes must be performed directly and visibly in the target source files.

## 2. Code Quality & Theme Integrity
- Keep `extensions/one-tap-extension` and `extensions/one-tap-parent-extension` synchronized at all times.
- Adhere strictly to the project's design system tokens (`var(--surface)`, `var(--text-primary)`, `var(--border)`).
- Never hardcode saturated colors or white text (`#fff`) on light/cream surfaces.
- Verify all changes with a clean production build (`npm run build`).

