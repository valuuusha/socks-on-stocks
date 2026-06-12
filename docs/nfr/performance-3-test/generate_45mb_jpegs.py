from pathlib import Path
import sys


SOURCE = Path("source.jpg")
OUT_DIR = Path("test_100_jpegs")
COUNT = 100
TARGET_SIZE = 45_000_000


def make_comment_segments(total_bytes: int, index: int) -> bytes:
    segments = bytearray()
    remaining = total_bytes
    segment_no = 0

    while remaining > 0:
        if remaining < 4:
            segments.extend(b"X" * remaining)
            break

        max_total = 65_537
        current_total = min(max_total, remaining)

        if 0 < remaining - current_total < 4:
            current_total -= 4 - (remaining - current_total)

        payload_len = current_total - 4
        payload_seed = (
            f"SOCKS_ON_STOCKS_LOAD_TEST_FILE_{index:03d}_"
            f"SEGMENT_{segment_no:03d}_"
        ).encode()
        payload = (payload_seed * ((payload_len // len(payload_seed)) + 1))[
            :payload_len
        ]

        length_field = payload_len + 2
        segments.extend(b"\xff\xfe")
        segments.extend(length_field.to_bytes(2, "big"))
        segments.extend(payload)

        remaining -= current_total
        segment_no += 1

    return bytes(segments)


def main() -> None:
    if not SOURCE.exists():
        print("ERROR: source.jpg not found")
        sys.exit(1)

    src = SOURCE.read_bytes()

    if not src.startswith(b"\xff\xd8"):
        print("ERROR: source.jpg is not a valid JPEG file")
        sys.exit(1)

    if len(src) >= TARGET_SIZE:
        print("ERROR: source.jpg must be smaller than 45 MB")
        sys.exit(1)

    OUT_DIR.mkdir(exist_ok=True)

    for i in range(1, COUNT + 1):
        needed = TARGET_SIZE - len(src)
        comments = make_comment_segments(needed, i)
        result = src[:2] + comments + src[2:]

        out_path = OUT_DIR / f"socks_test_{i:03d}.jpg"
        out_path.write_bytes(result)

        if out_path.stat().st_size != TARGET_SIZE:
            raise RuntimeError(f"Wrong size for {out_path}")

    print(f"Created {COUNT} JPEG files in {OUT_DIR}")
    print(f"Each file size: {TARGET_SIZE} bytes")
    print(f"Total size: {TARGET_SIZE * COUNT / 1_000_000_000:.2f} GB")


if __name__ == "__main__":
    main()

