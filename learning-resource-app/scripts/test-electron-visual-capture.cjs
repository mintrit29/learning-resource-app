/* eslint-disable @typescript-eslint/no-require-imports */

const assert = require("node:assert/strict");
const { app, BrowserWindow, screen } = require("electron");

const requestedScale = process.argv.find((argument) => argument.startsWith("--scale="))?.split("=")[1];
if (requestedScale) app.commandLine.appendSwitch("force-device-scale-factor", requestedScale);
app.disableHardwareAcceleration();

async function main() {
  const window = new BrowserWindow({
    width: 800,
    height: 600,
    useContentSize: true,
    show: false,
    webPreferences: {
      backgroundThrottling: false,
      contextIsolation: true,
      nodeIntegration: false,
      offscreen: true,
      sandbox: true,
    },
  });
  const html = `<!doctype html><style>*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;background:#d22}.target{position:fixed;left:120px;top:90px;width:240px;height:120px;background:#0f0;color:#000;font:32px Arial}</style><div class="target">ScholarFlow OCR</div>`;
  await window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);

  for (const zoom of [.8, 1, 1.25]) {
    window.webContents.setZoomFactor(zoom);
    await new Promise((resolve) => setTimeout(resolve, 120));
    const rectangle = await window.webContents.executeJavaScript(`(() => { const r = document.querySelector('.target').getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) }; })()`);
    const image = await window.webContents.capturePage(rectangle);
    assert.equal(image.isEmpty(), false);
    const { width, height } = image.getSize();
    assert.ok(width > 0 && height > 0);
    const bitmap = image.toBitmap();
    const pixelOffset = (Math.floor(height / 2) * width + Math.floor(width / 2)) * 4;
    const [blue, green, red] = bitmap.subarray(pixelOffset, pixelOffset + 3);
    assert.ok(green > 180 && red < 90 && blue < 90, `Sai vùng crop ở zoom ${zoom}: rgb(${red},${green},${blue})`);
  }

  console.log(`Electron visual capture passed (device scale ${screen.getPrimaryDisplay().scaleFactor}, forced ${requestedScale ?? "none"}).`);
  window.destroy();
}

app.whenReady()
  .then(main)
  .then(() => app.exit(0))
  .catch((error) => {
    console.error(error);
    app.exit(1);
  });
