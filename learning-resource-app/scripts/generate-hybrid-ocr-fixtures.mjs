import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createCanvas, loadImage } from "@napi-rs/canvas";

const outputDir = path.join(process.cwd(), "test-fixtures", "scholarflow-hybrid-ocr");
await mkdir(outputDir, { recursive: true });

const fixtures = [];

function baseCanvas(width = 1400, height = 520) {
  const canvas = createCanvas(width, height);
  const context = canvas.getContext("2d");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.fillStyle = "#17201f";
  context.textBaseline = "middle";
  return { canvas, context };
}

function addFixture(id, expectedRoute, expectedMarkers, render, description) {
  const { canvas, context } = baseCanvas();
  render(context, canvas.width, canvas.height);
  fixtures.push({
    id,
    file: `${id}.png`,
    expectedRoute,
    expectedMarkers,
    description,
  });
  return writeFile(path.join(outputDir, `${id}.png`), canvas.toBuffer("image/png"));
}

function centeredText(context, text, y, font = "54px 'Cambria Math'") {
  context.font = font;
  context.textAlign = "center";
  context.fillText(text, 700, y);
}

function drawFraction(context, numerator, denominator, centerX, centerY, width = 440) {
  context.font = "48px 'Cambria Math'";
  context.textAlign = "center";
  context.fillText(numerator, centerX, centerY - 42);
  context.strokeStyle = "#17201f";
  context.lineWidth = 4;
  context.beginPath();
  context.moveTo(centerX - width / 2, centerY);
  context.lineTo(centerX + width / 2, centerY);
  context.stroke();
  context.fillText(denominator, centerX, centerY + 48);
}

await Promise.all([
  addFixture(
    "formula_01_quadratic",
    "formula",
    ["x", "b", "sqrt", "4", "a", "c", "2"],
    (context) => centeredText(context, "x = (-b ± √(b² - 4ac)) / 2a", 260, "62px 'Cambria Math'"),
    "Công thức bậc hai một dòng, ký hiệu căn và cộng trừ.",
  ),
  addFixture(
    "formula_02_gaussian",
    "formula",
    ["int", "infty", "e", "x", "sqrt", "pi", "2"],
    (context) => centeredText(context, "∫₀∞ e⁻ˣ² dx = √π / 2", 260, "72px 'Cambria Math'"),
    "Tích phân Gaussian có cận, số mũ âm và căn.",
  ),
  addFixture(
    "formula_03_bayes",
    "formula",
    ["P", "A", "B"],
    (context) => {
      context.font = "56px 'Cambria Math'";
      context.textAlign = "right";
      context.fillText("P(A | B) =", 430, 260);
      drawFraction(context, "P(B | A) P(A)", "P(B)", 770, 260, 520);
    },
    "Định lý Bayes dạng phân số hai tầng.",
  ),
  addFixture(
    "formula_04_ols",
    "formula",
    ["beta", "X", "R", "SS"],
    (context) => {
      centeredText(context, "β̂ = (XᵀX)⁻¹Xᵀy", 190, "58px 'Cambria Math'");
      context.font = "54px 'Cambria Math'";
      context.textAlign = "right";
      context.fillText("R² = 1 -", 590, 340);
      drawFraction(context, "SSres", "SStot", 790, 340, 260);
    },
    "Hai công thức hồi quy, gồm chỉ số trên và phân số.",
  ),
  addFixture(
    "formula_05_vector",
    "formula",
    ["nabla", "E", "rho", "varepsilon"],
    (context) => centeredText(context, "∇ · E = ρ / ε₀", 260, "76px 'Cambria Math'"),
    "Công thức vector ngắn với ký tự Hy Lạp.",
  ),
  addFixture(
    "formula_06_with_caption",
    "formula",
    ["sum", "p", "log"],
    (context) => {
      context.font = "31px Arial";
      context.textAlign = "left";
      context.fillStyle = "#42504e";
      context.fillText("Công thức entropy dùng trong lý thuyết thông tin:", 105, 125);
      context.fillStyle = "#17201f";
      centeredText(context, "H(X) = -Σᵢ pᵢ log₂ pᵢ", 295, "68px 'Cambria Math'");
    },
    "Công thức có câu chú thích tiếng Việt phía trên.",
  ),
  addFixture(
    "text_01_vietnamese",
    "ocr",
    ["Mã hóa dữ liệu", "tính bí mật", "toàn vẹn", "xác thực"],
    (context) => {
      context.font = "bold 43px Arial";
      context.textAlign = "left";
      context.fillText("AN TOÀN THÔNG TIN", 100, 115);
      context.font = "34px Arial";
      context.fillText("Mã hóa dữ liệu bảo vệ tính bí mật, toàn vẹn và xác thực.", 100, 220);
      context.fillText("Người dùng cần kiểm tra nguồn trước khi sử dụng tài liệu.", 100, 300);
    },
    "Đoạn văn tiếng Việt có đầy đủ dấu.",
  ),
  addFixture(
    "text_02_english",
    "ocr",
    ["Semantic search", "retrieves", "relevant", "documents"],
    (context) => {
      context.font = "bold 43px Arial";
      context.textAlign = "left";
      context.fillText("SEMANTIC SEARCH", 100, 135);
      context.font = "36px Arial";
      context.fillText("Semantic search retrieves relevant documents by meaning.", 100, 250);
    },
    "Đoạn văn tiếng Anh rõ nét.",
  ),
  addFixture(
    "table_01_vietnamese",
    "ocr",
    ["Thuật toán", "Cấu trúc", "Cạnh âm", "Dijkstra", "Không hỗ trợ"],
    (context) => {
      const left = 90;
      const top = 75;
      const widths = [290, 320, 300, 360];
      const rowHeight = 105;
      const rows = [
        ["Thuật toán", "Cấu trúc", "Cạnh âm", "Độ phức tạp"],
        ["BFS", "Hàng đợi", "Không xét trọng số", "O(V + E)"],
        ["Dijkstra", "Hàng đợi ưu tiên", "Không hỗ trợ", "O((V+E) log V)"],
        ["Bellman-Ford", "Mảng khoảng cách", "Có hỗ trợ", "O(VE)"],
      ];
      context.strokeStyle = "#315b73";
      context.lineWidth = 3;
      let y = top;
      for (let row = 0; row <= rows.length; row += 1) {
        context.beginPath();
        context.moveTo(left, y);
        context.lineTo(left + widths.reduce((sum, value) => sum + value, 0), y);
        context.stroke();
        y += rowHeight;
      }
      let x = left;
      for (const width of widths) {
        context.beginPath();
        context.moveTo(x, top);
        context.lineTo(x, top + rowHeight * rows.length);
        context.stroke();
        x += width;
      }
      context.beginPath();
      context.moveTo(x, top);
      context.lineTo(x, top + rowHeight * rows.length);
      context.stroke();
      context.font = "25px Arial";
      context.textAlign = "left";
      rows.forEach((cells, rowIndex) => {
        let cellX = left;
        cells.forEach((cell, cellIndex) => {
          context.font = `${rowIndex === 0 ? "bold " : ""}25px Arial`;
          context.fillText(cell, cellX + 15, top + rowIndex * rowHeight + rowHeight / 2);
          cellX += widths[cellIndex];
        });
      });
    },
    "Bảng dạng ảnh có đường lưới và dấu tiếng Việt.",
  ),
  addFixture(
    "chart_01_line",
    "ocr",
    ["Độ chính xác", "Tháng 1", "Tháng 2", "82", "91"],
    (context) => {
      context.font = "bold 34px Arial";
      context.textAlign = "center";
      context.fillText("Độ chính xác theo tháng", 700, 55);
      context.strokeStyle = "#304b60";
      context.lineWidth = 4;
      context.beginPath();
      context.moveTo(160, 420);
      context.lineTo(160, 110);
      context.lineTo(1260, 110);
      context.moveTo(160, 420);
      context.lineTo(1260, 420);
      context.stroke();
      const points = [[260, 350, "82", "Tháng 1"], [560, 290, "86", "Tháng 2"], [860, 220, "91", "Tháng 3"], [1160, 170, "94", "Tháng 4"]];
      context.strokeStyle = "#087f6a";
      context.beginPath();
      points.forEach(([x, y], index) => index === 0 ? context.moveTo(x, y) : context.lineTo(x, y));
      context.stroke();
      context.font = "24px Arial";
      points.forEach(([x, y, value, label]) => {
        context.fillStyle = "#087f6a";
        context.beginPath();
        context.arc(x, y, 9, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = "#17201f";
        context.fillText(value, x, y - 28);
        context.fillText(label, x, 465);
      });
    },
    "Biểu đồ đường tiếng Việt, không được gửi sang model công thức.",
  ),
  addFixture(
    "diagram_01_network",
    "ocr",
    ["R1", "R2", "R3", "R4", "OSPF"],
    (context) => {
      const nodes = [[320, 160, "R1"], [1080, 160, "R2"], [320, 380, "R3"], [1080, 380, "R4"]];
      context.strokeStyle = "#456b81";
      context.lineWidth = 5;
      context.beginPath();
      context.moveTo(320, 160); context.lineTo(1080, 160);
      context.moveTo(320, 160); context.lineTo(320, 380);
      context.moveTo(1080, 160); context.lineTo(1080, 380);
      context.moveTo(320, 380); context.lineTo(1080, 380);
      context.stroke();
      context.font = "bold 30px Arial";
      context.textAlign = "center";
      nodes.forEach(([x, y, label]) => {
        context.fillStyle = "#eaf4ff";
        context.beginPath(); context.arc(x, y, 48, 0, Math.PI * 2); context.fill();
        context.strokeStyle = "#1a67c7"; context.stroke();
        context.fillStyle = "#17201f"; context.fillText(label, x, y);
      });
      context.font = "bold 30px Arial";
      context.fillText("OSPF - sơ đồ trạng thái liên kết", 700, 55);
    },
    "Sơ đồ mạng có nhãn ngắn, dễ bị nhầm với biểu thức.",
  ),
  addFixture(
    "code_01_snippet",
    "ocr",
    ["for", "distance", "Infinity", "return"],
    (context) => {
      context.fillStyle = "#f3f5f7";
      context.fillRect(70, 45, 1260, 430);
      context.fillStyle = "#17201f";
      context.font = "31px Consolas";
      context.textAlign = "left";
      [
        "for (const node of graph) {",
        "  distance[node] = Infinity;",
        "}",
        "return distance;",
      ].forEach((line, index) => context.fillText(line, 120, 120 + index * 85));
    },
    "Đoạn mã có nhiều ký hiệu nhưng không phải công thức.",
  ),
  addFixture(
    "noise_01_symbols",
    "reject",
    [],
    (context) => {
      context.fillStyle = "#dfe7e5";
      [[260, 180], [700, 350], [1120, 160]].forEach(([x, y], index) => {
        context.beginPath(); context.arc(x, y, 55 + index * 8, 0, Math.PI * 2); context.fill();
      });
      context.fillStyle = "#cfd8d6";
      context.font = "42px Arial";
      context.textAlign = "center";
      context.fillText("○   ◇   ○", 700, 260);
    },
    "Trang trí ít tương phản, không có query hữu ích.",
  ),
]);

async function addCrop(id, sourceId, crop, expectedMarkers, description) {
  const source = await loadImage(path.join(outputDir, `${sourceId}.png`));
  const canvas = createCanvas(crop.width, crop.height);
  canvas.getContext("2d").drawImage(
    source,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    crop.width,
    crop.height,
  );
  await writeFile(path.join(outputDir, `${id}.png`), canvas.toBuffer("image/png"));
  fixtures.push({ id, file: `${id}.png`, expectedRoute: "formula", expectedMarkers, description });
}

await Promise.all([
  addCrop(
    "formula_04a_ols_beta_crop",
    "formula_04_ols",
    { x: 180, y: 100, width: 1040, height: 175 },
    ["beta", "X", "T", "-1", "y"],
    "Crop riêng phương trình beta để đo ảnh hưởng của tách dòng công thức.",
  ),
  addCrop(
    "formula_04b_ols_r2_crop",
    "formula_04_ols",
    { x: 280, y: 255, width: 840, height: 220 },
    ["R", "2", "1", "SSres", "SStot"],
    "Crop riêng phương trình R² và phân số SSres/SStot.",
  ),
  addCrop(
    "formula_06a_entropy_crop",
    "formula_06_with_caption",
    { x: 180, y: 195, width: 1040, height: 210 },
    ["H", "sum", "p", "log"],
    "Loại câu chú thích, chỉ giữ vùng công thức entropy.",
  ),
]);

await writeFile(
  path.join(outputDir, "manifest.json"),
  JSON.stringify({ version: 1, fixtures }, null, 2),
  "utf8",
);

console.log(`Generated ${fixtures.length} fixtures in ${outputDir}`);
