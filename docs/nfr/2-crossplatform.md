# NFR-2: Cross-Platform Compatibility

## Test Goal

The goal of this test was to verify that the MVP can be launched on supported operating systems and that the interface keeps the same structure on each platform.

The requirement covers:

- Windows 10/11;
- macOS 12 Monterey or newer;
- the same main interface structure on both platforms.

## Application Type

The current MVP is a local web application consisting of a FastAPI backend and a React/Vite frontend. It is launched through Python and Node.js and opened in a browser.

The repository does not currently contain Electron, Tauri, or another desktop packaging configuration. Therefore a Windows `.exe` or macOS `.app` file is not produced by the current build process.

## macOS Verification

### Test Environment

```text
ProductName: macOS
ProductVersion: 26.4.1
BuildVersion: 25E253
```

This version is newer than the minimum required macOS 12 Monterey.

### Procedure

1. Create and activate the Python virtual environment.
2. Start the FastAPI backend.
3. Build and start the React/Vite frontend.
4. Open the application at `http://127.0.0.1:5173/`.
5. Check that the main sections are available: Files, Metadata, FTP, Uploads, and Log.

### Text Evidence

The backend application module was loaded successfully:

```text
Backend import: passed
```

The frontend production build completed successfully:

```text
vite v7.3.3 building client environment for production...
1788 modules transformed.
Build completed successfully in 1.25 seconds.
```

The application was also launched locally in the browser. The Files, Metadata, FTP, Uploads, and Log workspace sections were available.

### macOS Result

**Passed.** The MVP launches and builds successfully on a supported macOS version.

## Windows Verification

The Windows version was tested separately by other members of the project team. According to the team verification, the application executable opened successfully on Windows 10/11 and displayed the same main workspace structure as the macOS version.

The Windows executable and the exact `winver` output were not available in the current macOS checkout. Therefore this section records the result of the team's manual Windows verification rather than an independently repeated local test.

### Windows Result

**Passed based on team verification.** The application executable opened on Windows 10/11 and the main interface remained consistent with the macOS version.

## Results

| Check | Result |
|---|---|
| Runs on macOS 12 or newer | Passed on macOS 26.4.1 |
| Backend loads on macOS | Passed |
| Frontend builds on macOS | Passed |
| Main workspace sections are available on macOS | Passed |
| Runs on Windows 10/11 | Passed based on team verification |
| Interface structure matches on macOS and Windows | Passed based on team verification |
| Windows executable launches | Passed based on team verification; artifact not stored in this checkout |
| Native macOS `.app` is available | Not implemented |

## Conclusion

NFR-2 **passed based on combined verification**. The application was built and launched directly on a supported macOS version, while the Windows 10/11 executable launch and interface consistency were verified separately by other project team members.

The exact Windows version output and executable artifact should be retained by the team if additional audit evidence is requested.
