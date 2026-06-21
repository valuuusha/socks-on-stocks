# Performance Test Assets

This folder contains helper files for the NFR-3 productivity/performance manual test.

## Generate test JPEG files

1. Create a local working folder outside the repository:

   ```bash
   mkdir -p ~/Documents/socks-test
   cd ~/Documents/socks-test
   ```

2. Put any small JPEG image into that folder and name it:

   ```text
   source.jpg
   ```

3. Run the generator from this repository:

   ```bash
   python3 /Users/annaromancuk/Downloads/socks-on-stocks-main/socks-on-stocks/docs/nfr/performance-test/generate_45mb_jpegs.py
   ```

4. Verify the generated files:

   ```bash
   python3 - <<'PY'
   from pathlib import Path

   folder = Path("test_100_jpegs")
   files = list(folder.glob("*.jpg"))
   sizes = [f.stat().st_size for f in files]

   print("Files:", len(files))
   print("Unique sizes:", sorted(set(sizes)))
   print("Expected size:", 45_000_000)
   print("All OK:", len(files) == 100 and all(s == 45_000_000 for s in sizes))
   PY
   ```

Do not commit the generated 4.5 GB `test_100_jpegs` folder into Git.
