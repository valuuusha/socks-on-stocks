#!/usr/bin/env python3
"""
Pixel Identity Check
====================
Verifies that two images differ ONLY in metadata
(title, tags, description, XMP/IPTC/EXIF tags) while pixels remain identical.

Usage(considering you are in root directory):
    cd docs/nfr/integrity-5-test
    python pixel_identity_check.py original.jpg tagged.jpg
"""

import sys
import hashlib
from pathlib import Path
import numpy as np
from PIL import Image, ExifTags

GREEN  = "\033[92m"
RED    = "\033[91m"
YELLOW = "\033[93m"
CYAN   = "\033[96m"
BOLD   = "\033[1m"
RESET  = "\033[0m"

def ok(msg):     print(f"  {GREEN}✓{RESET}  {msg}")
def fail(msg):   print(f"  {RED}✗{RESET}  {msg}")
def info(msg):   print(f"  {CYAN}·{RESET}  {msg}")
def warn(msg):   print(f"  {YELLOW}!{RESET}  {msg}")
def header(msg): print(f"\n{BOLD}{msg}{RESET}")


METADATA_KEYS = {
    "title", "description", "subject", "tags", "keywords",
    "comment", "author", "artist", "copyright",
    "dc:title", "dc:description", "dc:subject",
    "xmp:title", "xmp:description",
}


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def get_metadata(path: Path) -> dict:
    img = Image.open(path)
    meta = {}

    for k, v in (img.info or {}).items():
        if k.lower() not in ("exif", "icc_profile", "dpi", "jfif",
                              "jfif_version", "jfif_unit", "jfif_density"):
            meta[f"info:{k}"] = str(v)[:120]

    try:
        exif = img.getexif()
        if exif:
            for tag_id, value in exif.items():
                tag_name = ExifTags.TAGS.get(tag_id, str(tag_id))
                meta[f"exif:{tag_name}"] = str(value)[:120]
    except Exception:
        pass

    return meta


def compare_pixels(path_a: Path, path_b: Path):
    img_a = Image.open(path_a).convert("RGBA")
    img_b = Image.open(path_b).convert("RGBA")

    if img_a.size != img_b.size:
        return None, img_a.size, img_b.size

    arr_a = np.array(img_a, dtype=np.int32)
    arr_b = np.array(img_b, dtype=np.int32)
    diff = np.abs(arr_a - arr_b)

    changed_mask   = diff.max(axis=2) > 0
    changed_pixels = int(changed_mask.sum())
    total_pixels   = img_a.size[0] * img_a.size[1]
    max_diff       = int(diff.max())
    mean_diff      = float(diff[changed_mask].mean()) if changed_pixels else 0.0

    return {
        "changed_pixels": changed_pixels,
        "total_pixels":   total_pixels,
        "pct":            changed_pixels / total_pixels * 100,
        "max_diff":       max_diff,
        "mean_diff":      mean_diff,
    }, img_a.size, img_b.size


def diff_metadata(meta_a: dict, meta_b: dict):
    all_keys = set(meta_a) | set(meta_b)
    added, removed, changed, unchanged = {}, {}, {}, {}

    for k in all_keys:
        va, vb = meta_a.get(k), meta_b.get(k)
        if va is None:
            added[k] = vb
        elif vb is None:
            removed[k] = va
        elif va != vb:
            changed[k] = (va, vb)
        else:
            unchanged[k] = va

    return added, removed, changed, unchanged


def is_metadata_key(key: str) -> bool:
    k = key.lower()
    return any(m in k for m in METADATA_KEYS) or k.startswith("xmp") or k.startswith("iptc")


def main():
    if len(sys.argv) != 3:
        print(f"Usage: {sys.argv[0]} original.jpg tagged.jpg")
        sys.exit(1)

    path_a = Path(sys.argv[1])
    path_b = Path(sys.argv[2])

    for p in (path_a, path_b):
        if not p.exists():
            print(f"{RED}File not found: {p}{RESET}")
            sys.exit(1)

    print(f"\n{BOLD}{'─'*54}")
    print(f"  PIXEL IDENTITY CHECK")
    print(f"{'─'*54}{RESET}")
    info(f"Original  : {path_a.name}  ({path_a.stat().st_size:,} bytes)")
    info(f"Tagged    : {path_b.name}  ({path_b.stat().st_size:,} bytes)")

    size_diff = path_b.stat().st_size - path_a.stat().st_size
    sign = "+" if size_diff >= 0 else ""
    info(f"Size diff : {sign}{size_diff:,} bytes  {'(tags added — expected)' if size_diff > 0 else ''}")

    header("1 / SHA-256 hashes")
    hash_a = sha256(path_a)
    hash_b = sha256(path_b)
    info(f"Original  : {hash_a}")
    info(f"Tagged    : {hash_b}")
    if hash_a == hash_b:
        ok("Files are byte-for-byte identical")
    else:
        warn("Hashes differ (expected — metadata/file structure changed)")

    header("2 / Pixel comparison")
    result, size_a, size_b = compare_pixels(path_a, path_b)

    if result is None:
        fail(f"Image dimensions differ: {size_a} vs {size_b}")
        print(f"\n{RED}TEST FAILED — comparison not possible{RESET}\n")
        sys.exit(2)

    info(f"Dimensions: {size_a[0]}×{size_a[1]}  ({result['total_pixels']:,} pixels total)")

    pixels_ok = result["changed_pixels"] == 0

    if pixels_ok:
        ok("Changed pixels: 0 — full pixel identity ✓")
    else:
        fail(f"Changed pixels : {result['changed_pixels']:,}  ({result['pct']:.4f}%)")
        fail(f"Max deviation  : {result['max_diff']}/255")
        fail(f"Mean deviation : {result['mean_diff']:.2f}/255")

    header("3 / Metadata diff")
    meta_a = get_metadata(path_a)
    meta_b = get_metadata(path_b)
    added, removed, changed, unchanged = diff_metadata(meta_a, meta_b)

    unexpected_changes = []

    for k, v in added.items():
        if is_metadata_key(k):
            ok(f"Tag added   [{k}] = {v!r}")
        else:
            unexpected_changes.append(f"Unexpected field added [{k}] = {v!r}")
            fail(f"Added [{k}] = {v!r}")

    for k, v in removed.items():
        warn(f"Tag removed [{k}] = {v!r}")

    for k, (va, vb) in changed.items():
        if is_metadata_key(k):
            ok(f"Tag updated [{k}]: {va!r} → {vb!r}")
        else:
            unexpected_changes.append(f"Unexpected field changed [{k}]")
            fail(f"Changed [{k}]: {va!r} → {vb!r}")

    if not added and not removed and not changed:
        warn("No metadata changes detected at all")

    info(f"Unchanged fields: {len(unchanged)}")

    header("VERDICT")
    print(f"{'─'*54}")

    if pixels_ok and not unexpected_changes:
        print(f"{GREEN}{BOLD}  ✓  TEST PASSED{RESET}")
        print(f"     Pixels are identical. Only metadata changed.")
        print(f"     Image quality and compression are 100% original.\n")
        sys.exit(0)
    else:
        print(f"{RED}{BOLD}  ✗  TEST FAILED{RESET}")
        if not pixels_ok:
            print(f"     {result['changed_pixels']:,} changed pixels found — image was recompressed or modified.")
        for msg in unexpected_changes:
            print(f"     {msg}")
        print()
        sys.exit(1)


if __name__ == "__main__":
    main()