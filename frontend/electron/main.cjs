const { app, BrowserWindow, dialog } = require("electron");
const { spawn } = require("node:child_process");
const net = require("node:net");
const path = require("node:path");
const fs = require("node:fs");

let apiProcess;

function writeLog(message) {
  const logPath = path.join(app.getPath("userData"), "backend-launch.log");
  fs.appendFileSync(logPath, `[${new Date().toISOString()}] ${message}\n`);
  return logPath;
}

function getAvailablePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close((error) => (error ? reject(error) : resolve(port)));
    });
  });
}

function apiCommand() {
  if (app.isPackaged) {
    return {
      command: path.join(
        process.resourcesPath,
        "backend",
        "socks-on-stocks-api",
        "socks-on-stocks-api",
      ),
      args: [],
    };
  }

  return {
    command: process.env.PYTHON || "python3",
    args: [path.join(app.getAppPath(), "..", "desktop", "api_server.py")],
  };
}

function startApi(port) {
  const { command, args } = apiCommand();
  const dataDir = path.join(app.getPath("userData"), "data");
  fs.mkdirSync(dataDir, { recursive: true });

  writeLog(`Starting local service on port ${port}: ${command}`);
  apiProcess = spawn(command, args, {
    env: {
      ...process.env,
      SOCKS_ON_STOCKS_DATA_DIR: dataDir,
      SOCKS_ON_STOCKS_PORT: String(port),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  apiProcess.stdout.on("data", (data) => writeLog(data.toString().trim()));
  apiProcess.stderr.on("data", (data) => writeLog(data.toString().trim()));
  apiProcess.on("exit", (code, signal) => {
    writeLog(`Local service exited (code=${code}, signal=${signal ?? "none"}).`);
  });
  apiProcess.on("error", (error) => {
    const logPath = writeLog(`Could not start local service: ${error.message}`);
    dialog.showErrorBox("Socks on Stocks", `Could not start its local service: ${error.message}\n\nLog: ${logPath}`);
  });
}

async function waitForApi(apiUrl) {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${apiUrl}/health`);
      if (response.ok) return;
    } catch (_) {
      // The frozen Python process is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("The local service did not become ready in time.");
}

function createWindow(apiUrl) {
  const window = new BrowserWindow({
    width: 1360,
    height: 880,
    minWidth: 1024,
    minHeight: 700,
    title: "Socks on Stocks",
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  });

  if (process.env.ELECTRON_START_URL) {
    window.loadURL(process.env.ELECTRON_START_URL);
  } else {
    window.loadFile(path.join(app.getAppPath(), "dist", "index.html"), {
      query: { apiUrl },
    });
  }
}

app.whenReady().then(async () => {
  try {
    const port = await getAvailablePort();
    const apiUrl = `http://127.0.0.1:${port}`;
    startApi(port);
    await waitForApi(apiUrl);
    createWindow(apiUrl);
  } catch (error) {
    const logPath = writeLog(`Local service did not become ready: ${error.message}`);
    dialog.showErrorBox("Socks on Stocks", `${error.message}\n\nLog: ${logPath}`);
    app.quit();
  }
});

app.on("window-all-closed", () => app.quit());
app.on("before-quit", () => apiProcess?.kill());
