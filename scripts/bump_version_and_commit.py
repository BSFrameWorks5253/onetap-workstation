import os
import re
import json
import subprocess
import datetime
import sys

# Paths
REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
EXT_VERSION_JSON = os.path.join(REPO_ROOT, "extensions", "one-tap-extension", "version.json")
PARENT_VERSION_JSON = os.path.join(REPO_ROOT, "extensions", "one-tap-parent-extension", "version.json")
GLOBAL_VERSION_JSON = os.path.join(REPO_ROOT, "version", "version.json")

EXT_INDEX_HTML = os.path.join(REPO_ROOT, "extensions", "one-tap-extension", "index.html")
PARENT_INDEX_HTML = os.path.join(REPO_ROOT, "extensions", "one-tap-parent-extension", "index.html")
EXT_UPDATER_JS = os.path.join(REPO_ROOT, "extensions", "one-tap-extension", "js", "updater.js")
PARENT_UPDATER_JS = os.path.join(REPO_ROOT, "extensions", "one-tap-parent-extension", "js", "updater.js")

def bump_version_string(ver_str):
    """
    Given '26.11.1', increments to '26.11.2'.
    If custom increment logic is needed, splits by dots.
    """
    parts = ver_str.strip().lstrip('v').split('.')
    if len(parts) == 3:
        major, minor, patch = parts
        try:
            new_patch = str(int(patch) + 1)
            return f"{major}.{minor}.{new_patch}"
        except ValueError:
            pass
    return ver_str

def main():
    print("=" * 60)
    print("One Tap Extension - Auto-Bump & Git Release Script")
    print("=" * 60)

    # 1. Read current version
    current_ver = "26.11.1"
    if os.path.exists(EXT_VERSION_JSON):
        with open(EXT_VERSION_JSON, "r", encoding="utf-8") as f:
            data = json.load(f)
            current_ver = data.get("version", current_ver)

    # 2. Compute new version
    target_ver = bump_version_string(current_ver)
    
    # Allow manual override if passed as command line argument
    if len(sys.argv) > 1 and sys.argv[1].strip():
        arg_val = sys.argv[1].strip().lstrip('v')
        if re.match(r'^\d+\.\d+\.\d+$', arg_val):
            target_ver = arg_val

    print(f"[*] Current Version : v{current_ver}")
    print(f"[*] New Version     : v{target_ver}")
    now_iso = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    # 3. Update version.json files
    ver_payload = {
        "version": target_ver,
        "repoOwner": "BSFrameWorks5253",
        "repoName": "onetap-workstation",
        "branch": "main",
        "releaseNotes": f"One Tap Extension v{target_ver} release update.",
        "updatedAt": now_iso
    }

    for path in [EXT_VERSION_JSON, PARENT_VERSION_JSON, GLOBAL_VERSION_JSON]:
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(ver_payload, f, indent=2)
        print(f"[+] Updated {os.path.relpath(path, REPO_ROOT)}")

    # 4. Update index.html badge in both extensions
    for html_path in [EXT_INDEX_HTML, PARENT_INDEX_HTML]:
        if os.path.exists(html_path):
            with open(html_path, "r", encoding="utf-8") as f:
                content = f.read()
            # Replace version tag: <span id="versionBadge" class="version-tag">v...</span>
            updated = re.sub(
                r'<span id="versionBadge" class="version-tag">v[^<]+</span>',
                f'<span id="versionBadge" class="version-tag">v{target_ver}</span>',
                content
            )
            with open(html_path, "w", encoding="utf-8") as f:
                f.write(updated)
            print(f"[+] Updated version tag in {os.path.relpath(html_path, REPO_ROOT)}")

    # 5. Update updater.js currentVersion in both extensions
    for js_path in [EXT_UPDATER_JS, PARENT_UPDATER_JS]:
        if os.path.exists(js_path):
            with open(js_path, "r", encoding="utf-8") as f:
                content = f.read()
            updated = re.sub(
                r'currentVersion:\s*"[^"]+"',
                f'currentVersion: "{target_ver}"',
                content
            )
            with open(js_path, "w", encoding="utf-8") as f:
                f.write(updated)
            print(f"[+] Updated currentVersion in {os.path.relpath(js_path, REPO_ROOT)}")

    # 6. Ask user for commit message or use default
    default_msg = f"release(extension): bump version to v{target_ver}"
    commit_msg = input(f"\nEnter commit message (press Enter for '{default_msg}'): ").strip()
    if not commit_msg:
        commit_msg = default_msg

    print("\n[*] Staging files for git...")
    subprocess.run(["git", "add", "extensions/", "version/"], cwd=REPO_ROOT, check=True)

    print(f"[*] Committing changes: {commit_msg}")
    subprocess.run(["git", "commit", "-m", commit_msg], cwd=REPO_ROOT, check=True)

    push_choice = input("\nDo you want to git push origin auto-update-bootloader now? (y/n): ").strip().lower()
    if push_choice in ['y', 'yes']:
        print("[*] Pushing to GitHub...")
        subprocess.run(["git", "push", "origin", "auto-update-bootloader"], cwd=REPO_ROOT, check=True)
        print("\n[✓] Successfully committed and pushed to GitHub!")
    else:
        print("\n[✓] Committed locally! You can run 'git push origin auto-update-bootloader' whenever you are ready.")

if __name__ == "__main__":
    main()
