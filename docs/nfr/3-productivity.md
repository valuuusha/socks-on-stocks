# Performance Test Report: Local JPEG Workspace and Metadata Editing

## Test Goal

The goal of the testing was to verify the non-functional performance requirements of the Socks on Stocks application:

1. The application must open or import a workspace with 100 local JPEG files of up to 45 MB each in no more than 5 seconds on a machine with at least 8 GB of RAM.
2. During metadata editing, the UI must not freeze for more than 1 second after changing a value in the title, description, or tags field.

## Test Environment

- Operating system: macOS
- RAM: 16 GB
- CPU: Apple M2 Pro, 10 cores (6 Performance and 4 Efficiency)
- Application version / Git branch: `docs-nfr`
- Test date: 2026-06-12
- Browser / runtime: Chrome, local Vite app at `http://127.0.0.1:5173/`

## Test Data

A folder with 100 unique JPEG files was created for testing.

- File count: 100
- Size per file: 45,000,000 bytes (displayed as 42.9 MB in the UI)
- Total data size: 4.5 GB
- File format: `.jpg`

Test files are generated locally using the script:

```bash
python3 docs/nfr/performance-test/generate_45mb_jpegs.py
```

Confirmation of test file generation:

```text
Files: 100
Unique sizes: [45000000]
Expected size: 45000000
All OK: True
```

## Test 1 — Opening a Workspace with 100 JPEG Files

### Expected Result

The application must open or import a workspace with 100 local JPEG files in no more than 5 seconds.

### Verification Method

1. Start the backend and frontend of the application.
2. Open the application in the browser.
3. Import 100 JPEG files from the test folder.
4. Measure the import time using a stopwatch or logs.
5. Verify that all 100 files are displayed in the workspace.

### Actual Result

- Import time: 24 seconds
- Files imported: 100
- Result: **failed**

Screenshot of import result:

![Import result](./performance-test/screenshots/02_import_result.png)

### Conclusion

The requirement to open the workspace within 5 seconds was not met. The actual import time for 100 JPEG files was 24 seconds, which exceeds the expected maximum of 5 seconds.

## Test 2 — UI Profiling During Metadata Editing

### Expected Result

When changing a value in the title, description, or tags field, the UI must not freeze for more than 1 second.

### Verification Method

Chrome DevTools Performance / React Profiler was used. During the recording, text was typed rapidly into the metadata fields.

### Actual Result

- Maximum recorded UI freeze: no more than 153.5 ms within the measured Performance timeline range
- Blocking longer than 1000 ms: no
- Result: **passed**

Screenshot of performance profiling:

![Performance profiling](./performance-test/screenshots/03_performance_metadata_editing.png)

### Conclusion

The requirement for no UI freeze longer than 1 second was met.

## Overall Conclusion

Testing covered application performance when working with 100 local JPEG files totalling 4.5 GB, and UI behaviour during metadata editing.

Overall test result: **not fully passed.**

Metadata editing passed the requirement for no UI freezes exceeding 1 second. However, importing 100 JPEG files took 24 seconds, so the requirement to open or import the workspace in no more than 5 seconds was not met.

If requirements are not met, workspace opening, thumbnail generation, or metadata field rendering should be optimised.