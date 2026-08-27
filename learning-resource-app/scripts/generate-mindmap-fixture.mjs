import { createCanvas } from "@napi-rs/canvas";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDirectory = path.join(projectRoot, "test-fixtures", "scholarflow", "06_mindmap_audio");
const outputPath = path.join(outputDirectory, "01_mindmap_mang_may_tinh.png");
const canvas = createCanvas(1600, 1000);
const context = canvas.getContext("2d");

context.fillStyle = "#f6fbfa";
context.fillRect(0, 0, canvas.width, canvas.height);
context.lineWidth = 5;
context.strokeStyle = "#0b8f7f";
context.font = "bold 34px Arial";
context.textAlign = "center";
context.textBaseline = "middle";

function roundedBox(x, y, width, height, fill, text, font = "bold 30px Arial") {
  context.beginPath();
  context.roundRect(x, y, width, height, 24);
  context.fillStyle = fill;
  context.fill();
  context.strokeStyle = "#0b8f7f";
  context.stroke();
  context.fillStyle = "#17211f";
  context.font = font;
  context.fillText(text, x + width / 2, y + height / 2);
}

function connector(x1, y1, x2, y2) {
  context.beginPath();
  context.moveTo(x1, y1);
  context.lineTo(x2, y2);
  context.strokeStyle = "#5f8f86";
  context.stroke();
}

const branches = [
  { x: 100, y: 120, text: "Định tuyến OSPF" },
  { x: 1080, y: 120, text: "Mô hình TCP/IP" },
  { x: 100, y: 730, text: "Bảo mật mạng" },
  { x: 1080, y: 730, text: "Địa chỉ IPv4" },
];
for (const branch of branches) {
  connector(800, 485, branch.x + 210, branch.y + 65);
}
roundedBox(520, 400, 560, 170, "#ffffff", "CHỦ ĐỀ MẠNG MÁY TÍNH", "bold 38px Arial");
for (const branch of branches) {
  roundedBox(branch.x, branch.y, 420, 130, "#ffffff", branch.text);
}

context.fillStyle = "#52615d";
context.font = "24px Arial";
context.fillText("Trạng thái liên kết", 310, 300);
context.fillText("Bốn tầng giao thức", 1290, 300);
context.fillText("Mã hóa và tường lửa", 310, 690);
context.fillText("Mặt nạ mạng con", 1290, 690);

await mkdir(outputDirectory, { recursive: true });
await writeFile(outputPath, canvas.toBuffer("image/png"));
console.log(outputPath);
