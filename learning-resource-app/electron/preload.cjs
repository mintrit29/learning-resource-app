/* eslint-disable @typescript-eslint/no-require-imports */

const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld(
  "scholarFlowDesktop",
  Object.freeze({
    isDesktop: true,
    platform: process.platform,
    electronVersion: process.versions.electron,
  }),
);
