const { contextBridge, webUtils } = require("electron");

contextBridge.exposeInMainWorld("socksOnStocks", {
  getPathForFile(file) {
    return webUtils.getPathForFile(file);
  },
});
