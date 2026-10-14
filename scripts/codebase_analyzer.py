#!/usr/bin/env python3
"""
Codebase Analysis Caching Engine (Token-Saving Hierarchical Knowledge Engine)
---------------------------------------------------------------------------
Maintains an incremental, content-hash indexed document database under .code-analysis/
that mirrors the exact directory hierarchy of the project. AI agents and developers
refer to these comprehensive, structured architectural documents rather than
re-analyzing raw code files and consuming thousands of context tokens.

Features:
1. Mirrored Directory Hierarchy: Outputs .code-analysis/<rel_path>.md matching project files.
2. Incremental SHA-256 Hash Caching: Only modified files are re-analyzed.
3. Minute Detail Extraction: Captures imports, exports, interfaces, types, React hooks,
   state variables, IPC handlers/calls, function signatures with line numbers, and CSS selectors.
4. Master Knowledge Base: Compiles .code-analysis/KNOWLEDGE_BASE.md for rapid agent navigation.
5. Token Efficiency Metrics: Measures context tokens saved per session.
"""

import os
import sys
import json
import hashlib
import re
from datetime import datetime
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
CACHE_DIR = ROOT_DIR / ".code-analysis"
INDEX_FILE = CACHE_DIR / "index.json"
MASTER_DOC = CACHE_DIR / "KNOWLEDGE_BASE.md"

EXTENSIONS = {".ts", ".tsx", ".js", ".jsx", ".py", ".css", ".json"}
IGNORE_DIRS = {
    "node_modules", ".git", "dist", "out", "build", ".gsd", 
    ".code-analysis", ".tasks", "__pycache__", ".agent", ".agents",
    "release", ".venv", "env"
}

def get_file_hash(filepath: Path) -> str:
    hasher = hashlib.sha256()
    with open(filepath, "rb") as f:
        while chunk := f.read(65536):
            hasher.update(chunk)
    return hasher.hexdigest()

def analyze_source_file(filepath: Path, rel_path: str) -> dict:
    try:
        with open(filepath, "r", encoding="utf-8", errors="replace") as f:
            content = f.read()
    except Exception as e:
        return {"error": str(e), "path": rel_path}

    lines = content.splitlines()
    loc = len(lines)
    file_bytes = len(content.encode("utf-8", errors="replace"))
    ext = filepath.suffix.lower()

    imports = []
    internal_imports = []
    external_imports = []
    exports = []
    interfaces_types = []
    react_hooks = []
    ipc_channels = []
    functions_methods = []
    css_classes = []

    if ext in {".ts", ".tsx", ".js", ".jsx"}:
        # Detailed import parsing
        import_matches = re.finditer(r'import\s+(?:(?:(\{[^}]+\})|([A-Za-z0-9_$\*]+))\s+from\s+)?[\'"]([^\'"]+)[\'"]', content)
        for m in import_matches:
            named_or_def = m.group(1) or m.group(2) or "*"
            src = m.group(3)
            clean_named = " ".join(named_or_def.split())
            entry = f"{clean_named} from '{src}'"
            imports.append(entry)
            if src.startswith(".") or src.startswith("@/"):
                internal_imports.append(src)
            else:
                external_imports.append(src)

        # Exports & Type contracts
        for idx, line in enumerate(lines, 1):
            # Interface / Type
            type_match = re.search(r'export\s+(?:default\s+)?(interface|type)\s+([A-Za-z0-9_]+)', line)
            if type_match:
                interfaces_types.append({"type": type_match.group(1), "name": type_match.group(2), "line": idx})

            # Named/Default export
            exp_match = re.search(r'export\s+(?:default\s+)?(function|class|const|let|var)\s+([A-Za-z0-9_]+)', line)
            if exp_match:
                exports.append({"kind": exp_match.group(1), "name": exp_match.group(2), "line": idx})

            # Function declarations (including non-exported)
            fn_match = re.search(r'(?:async\s+)?function\s+([A-Za-z0-9_]+)\s*\(([^)]*)\)', line)
            if fn_match:
                functions_methods.append({"name": fn_match.group(1), "args": fn_match.group(2).strip(), "line": idx})
            else:
                arrow_match = re.search(r'(?:const|let)\s+([A-Za-z0-9_]+)\s*=\s*(?:async\s*)?\(([^)]*)\)\s*(?::\s*[^=]+)?\s*=>', line)
                if arrow_match:
                    functions_methods.append({"name": arrow_match.group(1), "args": arrow_match.group(2).strip(), "line": idx})

        # React Hooks & State detection
        hook_names = set(re.findall(r'\b(use[A-Z][A-Za-z0-9_]+)\b', content))
        if hook_names:
            react_hooks = sorted(list(hook_names))

        # IPC Calls / Handlers
        ipc_invokes = re.findall(r'ipcRenderer\.(?:invoke|send)\s*\(\s*[\'"]([^\'"]+)[\'"]', content)
        ipc_handles = re.findall(r'ipcMain\.(?:handle|on)\s*\(\s*[\'"]([^\'"]+)[\'"]', content)
        ipc_channels = sorted(list(set(ipc_invokes + ipc_handles)))

    elif ext == ".py":
        # Python imports & functions
        for idx, line in enumerate(lines, 1):
            imp_m = re.search(r'^(?:from\s+([\w\.]+)\s+import\s+(.+)|import\s+([\w\.]+))', line)
            if imp_m:
                imports.append(line.strip())
            fn_m = re.search(r'^\s*(?:def|class)\s+([A-Za-z0-9_]+)\s*(\([^)]*\))?', line)
            if fn_m:
                functions_methods.append({"name": fn_m.group(1), "args": fn_m.group(2) or "()", "line": idx})
                exports.append({"kind": "def/class", "name": fn_m.group(1), "line": idx})

    elif ext == ".css":
        # CSS class definitions
        css_selectors = re.findall(r'(\.[a-zA-Z0-9_\-]+)\s*\{', content)
        css_classes = sorted(list(set(css_selectors)))[:30]

    # Detect high-level purpose
    purpose = "Utility / Helper Module"
    if "pages" in rel_path:
        purpose = "Renderer UI Page View"
    elif "components" in rel_path:
        purpose = "Modular UI Component"
    elif "main" in rel_path or "index.ts" in rel_path:
        purpose = "Electron Main Process / Background Engine"
    elif "preload" in rel_path:
        purpose = "IPC Bridge / Security Sandbox Preload"
    elif "styles" in rel_path or ext == ".css":
        purpose = "Design Tokens & Stylesheet"
    elif "stores" in rel_path:
        purpose = "Global State Store (Zustand / Event Emitter)"
    elif "scripts" in rel_path:
        purpose = "Automation, Build & Packaging Script"
    elif "types" in rel_path:
        purpose = "TypeScript Interfaces & Type Declarations"

    # Token calculations
    raw_tokens = file_bytes // 4
    summary_tokens = min(raw_tokens, 220)

    return {
        "path": rel_path,
        "extension": ext,
        "loc": loc,
        "bytes": file_bytes,
        "purpose": purpose,
        "imports": imports[:25],
        "internal_imports": list(set(internal_imports))[:15],
        "external_imports": list(set(external_imports))[:15],
        "exports": exports[:25],
        "interfaces_types": interfaces_types[:20],
        "react_hooks": react_hooks,
        "ipc_channels": ipc_channels,
        "functions_methods": functions_methods[:30],
        "css_classes": css_classes,
        "raw_tokens": raw_tokens,
        "summary_tokens": summary_tokens,
        "last_analyzed": datetime.now().isoformat()
    }

def generate_module_markdown(info: dict) -> str:
    path = info["path"]
    loc = info["loc"]
    bytes_kb = info["bytes"] / 1024.0
    purpose = info["purpose"]
    raw_tokens = info["raw_tokens"]
    summary_tokens = info["summary_tokens"]
    pct_saved = ((1.0 - (summary_tokens / max(1, raw_tokens))) * 100) if raw_tokens > 0 else 0

    sections = [
        f"# Detailed Analysis: `{path}`",
        f"> **Role**: {purpose}  ",
        f"> **Metrics**: {loc} lines · {bytes_kb:.1f} KB · ~{raw_tokens:,} raw tokens → ~{summary_tokens:,} cached ({pct_saved:.1f}% saved)  ",
        f"> **Last Analyzed**: {info['last_analyzed']}  \n",
        "---",
        "\n## 1. Architectural Purpose & Summary",
        f"This file operates as part of the **{purpose}** layer. It is indexed in `.code-analysis/` to eliminate redundant raw file reading during AI reasoning and development sessions.\n"
    ]

    # Exports
    if info.get("exports"):
        sections.append("## 2. Exports & Public Symbols")
        sections.append("| Kind | Symbol | Declared Line |")
        sections.append("|:---|:---|:---:|")
        for e in info["exports"]:
            sections.append(f"| `{e.get('kind', 'export')}` | `{e['name']}` | Line {e.get('line', '?')} |")
        sections.append("")

    # Types & Interfaces
    if info.get("interfaces_types"):
        sections.append("## 3. Interfaces & Type Contracts")
        for t in info["interfaces_types"]:
            sections.append(f"- `{t['type']} {t['name']}` (Line {t['line']})")
        sections.append("")

    # React Hooks
    if info.get("react_hooks"):
        sections.append("## 4. React State & Lifecycle Hooks")
        hooks_str = ", ".join(f"`{h}`" for h in info["react_hooks"])
        sections.append(f"Utilizes: {hooks_str}\n")

    # IPC Channels
    if info.get("ipc_channels"):
        sections.append("## 5. Electron IPC Channels")
        for ch in info["ipc_channels"]:
            sections.append(f"- Channel: `{ch}`")
        sections.append("")

    # Functions / Methods
    if info.get("functions_methods"):
        sections.append("## 6. Key Functions & Methods")
        sections.append("| Line | Function Signature |")
        sections.append("|:---:|:---|")
        for fn in info["functions_methods"]:
            sig = f"`{fn['name']}({fn.get('args', '')})`"
            if len(sig) > 70:
                sig = f"`{fn['name']}(...)`"
            sections.append(f"| {fn.get('line', '?')} | {sig} |")
        sections.append("")

    # CSS Classes
    if info.get("css_classes"):
        sections.append("## 7. Defined CSS Classes")
        classes_str = ", ".join(f"`{c}`" for c in info["css_classes"])
        sections.append(f"{classes_str}\n")

    # Dependencies
    if info.get("external_imports") or info.get("internal_imports"):
        sections.append("## 8. Dependencies & Module Linkages")
        if info.get("external_imports"):
            sections.append(f"- **External Packages**: {', '.join(f'`{p}`' for p in info['external_imports'])}")
        if info.get("internal_imports"):
            sections.append(f"- **Internal Relatives**: {', '.join(f'`{p}`' for p in info['internal_imports'])}")
        sections.append("")

    sections.append("---\n*Generated by UniDesk Studio Hierarchical Codebase Analysis Engine.*")
    return "\n".join(sections)

def run_analysis(force: bool = False):
    CACHE_DIR.mkdir(parents=True, exist_ok=True)

    index = {}
    if INDEX_FILE.exists() and not force:
        try:
            with open(INDEX_FILE, "r", encoding="utf-8") as f:
                index = json.load(f)
        except Exception:
            index = {}

    total_scanned = 0
    updated_count = 0
    cached_count = 0
    total_tokens_saved = 0

    scan_roots = [ROOT_DIR / "src", ROOT_DIR / "scripts", ROOT_DIR / "tools"]

    for root_scan in scan_roots:
        if not root_scan.exists():
            continue
        for root, dirs, files in os.walk(root_scan):
            dirs[:] = [d for d in dirs if d not in IGNORE_DIRS]
            for file in files:
                filepath = Path(root) / file
                if filepath.suffix.lower() not in EXTENSIONS:
                    continue

                rel_path = os.path.relpath(filepath, ROOT_DIR).replace("\\", "/")
                file_hash = get_file_hash(filepath)
                total_scanned += 1

                existing = index.get(rel_path)
                if existing and existing.get("hash") == file_hash and not force:
                    cached_count += 1
                    tokens_saved = max(0, existing.get("raw_tokens", 0) - existing.get("summary_tokens", 0))
                    total_tokens_saved += tokens_saved
                    continue

                # File has changed or is new: generate deep analysis
                info = analyze_source_file(filepath, rel_path)
                info["hash"] = file_hash
                index[rel_path] = info

                # Write mirrored markdown document under .code-analysis/<rel_path>.md
                target_md = CACHE_DIR / f"{rel_path}.md"
                target_md.parent.mkdir(parents=True, exist_ok=True)
                with open(target_md, "w", encoding="utf-8") as f:
                    f.write(generate_module_markdown(info))

                tokens_saved = max(0, info["raw_tokens"] - info["summary_tokens"])
                total_tokens_saved += tokens_saved
                updated_count += 1

    # Save master index
    with open(INDEX_FILE, "w", encoding="utf-8") as f:
        json.dump(index, f, indent=2)

    # Generate Hierarchical Master Knowledge Base Markdown
    with open(MASTER_DOC, "w", encoding="utf-8") as f:
        f.write(f"""# 🧠 UniDesk Studio — Hierarchical Codebase Knowledge Base & Analysis Cache
> **Last Synced**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}  
> **Total Files Indexed**: {total_scanned}  
> **Unchanged (Cached)**: {cached_count} | **Re-analyzed**: {updated_count}  
> **Estimated AI Context Tokens Saved**: ~{total_tokens_saved:,} tokens!

This document and the mirrored hierarchy under `.code-analysis/` contain pre-analyzed architectural summaries, exports, interfaces, hooks, and IPC channels for every source file.
**AI Agents**: Consult `.code-analysis/<path>.md` before reading full raw source files to conserve context window!

---

## 📂 Subsystem Directory Breakdown

| Subsystem | File Count | Purpose |
|:---|:---:|:---|
| `src/main` | {len([k for k in index if k.startswith('src/main')])} | Electron main process, IPC controllers, FFmpeg & system engines |
| `src/preload` | {len([k for k in index if k.startswith('src/preload')])} | ContextBridge IPC exposure for secure renderer communications |
| `src/renderer/src/pages` | {len([k for k in index if 'pages/' in k])} | Core workstation pages (TitleAdder, VideoConverter, TaskTracker, Settings, etc.) |
| `src/renderer/src/components` | {len([k for k in index if 'components/' in k])} | Modular UI cards, buttons, loaders, modals, taskbar previews |
| `src/renderer/src/styles` | {len([k for k in index if 'styles/' in k])} | CSS design tokens, soft linen light mode & obsidian dark mode |
| `scripts` | {len([k for k in index if k.startswith('scripts')])} | Automated build, cross-packaging, analysis and packaging scripts |

---

## 🗂️ Mirrored Codebase Index

""")
        current_subsystem = ""
        for path, info in sorted(index.items(), key=lambda x: x[0]):
            subsystem = path.split("/")[0] + ("/" + path.split("/")[1] if "/" in path else "")
            if subsystem != current_subsystem:
                current_subsystem = subsystem
                f.write(f"\n### `{current_subsystem}`\n\n")

            exports_list = [e.get("name") for e in info.get("exports", []) if isinstance(e, dict) and e.get("name")]
            exports_str = f" — Exports: {', '.join(f'`{e}`' for e in exports_list[:4])}" if exports_list else ""
            hooks_str = f" [Hooks: {', '.join(info['react_hooks'][:3])}]" if info.get("react_hooks") else ""
            f.write(f"- **[{path}]({path}.md)**: {info.get('purpose', '')} ({info.get('loc', 0)} lines){exports_str}{hooks_str}\n")

    try:
        print(f"[OK] Hierarchical codebase analysis complete.")
        print(f"     Indexed: {total_scanned} files ({cached_count} cached, {updated_count} updated)")
        print(f"     Mirrored docs under: {CACHE_DIR}")
        print(f"     Estimated AI tokens saved: ~{total_tokens_saved:,}")
        print(f"     Master Knowledge Base: {MASTER_DOC}")
    except Exception:
        pass

if __name__ == "__main__":
    force_run = "--force" in sys.argv
    run_analysis(force=force_run)

