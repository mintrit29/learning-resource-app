/* eslint-disable @typescript-eslint/no-require-imports */

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld(
  "scholarFlowDesktop",
  Object.freeze({
    isDesktop: true,
    platform: process.platform,
    electronVersion: process.versions.electron,
    captureSearchRegion: (rectangle) => ipcRenderer.invoke("visual-search:capture-region", rectangle),
    getComponentStatus: () => ipcRenderer.invoke("components:status"),
    installComponent: (id) => ipcRenderer.invoke("components:install", id),
    cancelComponentInstall: (id) => ipcRenderer.invoke("components:cancel", id),
    verifyComponent: (id) => ipcRenderer.invoke("components:verify", id),
    removeComponent: (id) => ipcRenderer.invoke("components:remove", id),
    onComponentProgress: (listener) => {
      if (typeof listener !== "function") return () => {};
      const handler = (_event, progress) => listener(progress);
      ipcRenderer.on("components:progress", handler);
      return () => ipcRenderer.removeListener("components:progress", handler);
    },
  }),
);
