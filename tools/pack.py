"""把扩展目录打成商店可上传的 zip(根目录直接是 manifest.json)。

用法:
    python tools/pack.py

输出: dist/bilibili-duration-filter-<version>.zip
"""
import json
import os
import sys
import zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
EXT_DIR = os.path.join(ROOT, "B站时长过滤扩展")
DIST_DIR = os.path.join(ROOT, "dist")

SKIP_EXT = (".pem", ".crx", ".md", ".zip")
SKIP_NAMES = {"Thumbs.db", ".DS_Store", "desktop.ini"}


def main():
    if not os.path.isdir(EXT_DIR):
        sys.exit("extension dir not found: %s" % EXT_DIR)

    with open(os.path.join(EXT_DIR, "manifest.json"), encoding="utf-8-sig") as f:
        manifest = json.load(f)
    version = manifest["version"]
    out = os.path.join(DIST_DIR, "bilibili-duration-filter-%s.zip" % version)
    os.makedirs(DIST_DIR, exist_ok=True)

    count = 0
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
        for base, dirs, files in os.walk(EXT_DIR):
            dirs.sort()
            for name in sorted(files):
                if name.lower().endswith(SKIP_EXT) or name in SKIP_NAMES:
                    continue
                path = os.path.join(base, name)
                arc = os.path.relpath(path, EXT_DIR).replace(os.sep, "/")
                z.write(path, arc)
                count += 1

    print("version:", version)
    print("files:", count)
    print("output:", out)
    print("size: %.1f KB" % (os.path.getsize(out) / 1024.0))
    with zipfile.ZipFile(out) as z:
        names = z.namelist()
    if "manifest.json" not in names:
        sys.exit("ERROR: manifest.json is not at zip root")
    for n in names:
        print("  ", n)


if __name__ == "__main__":
    main()