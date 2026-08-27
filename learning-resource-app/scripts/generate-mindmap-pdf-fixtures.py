"""Reproducible Vietnamese mind maps: identical native text and scanned PDF pages."""
from pathlib import Path
import tempfile
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
import pypdfium2 as pdfium

root = Path(__file__).resolve().parents[1]
out = root / 'test-fixtures/scholarflow/06_mindmap_audio'
out.mkdir(parents=True, exist_ok=True)
font_dir = Path('C:/Windows/Fonts')
pdfmetrics.registerFont(TTFont('VN', str(font_dir / 'arial.ttf')))
pdfmetrics.registerFont(TTFont('VN-Bold', str(font_dir / 'arialbd.ttf')))
native = out / '04_mindmap_text.pdf'
scanned = out / '05_mindmap_scan.pdf'
c = canvas.Canvas(str(native), pagesize=(1000, 700))
pages = [
    ('MẠNG MÁY TÍNH', [
        ('Định tuyến OSPF', 'Trạng thái liên kết', 'Chọn tuyến theo tổng chi phí'),
        ('Mô hình TCP/IP', 'Bốn tầng giao thức', 'Ứng dụng, vận chuyển, Internet, mạng'),
        ('Bảo mật mạng', 'Mã hóa và tường lửa', 'Encryption and firewall'),
        ('Địa chỉ IPv4', 'Mặt nạ mạng con', 'Subnet mask and addressing'),
    ]),
    ('CƠ SỞ DỮ LIỆU', [
        ('Chuẩn hóa 3NF', 'Loại phụ thuộc bắc cầu', 'Third normal form'),
        ('Giao dịch ACID', 'Tính nguyên tử và nhất quán', 'Atomicity and consistency'),
        ('Chỉ mục B-tree', 'Tăng tốc truy vấn', 'Index range scan'),
        ('Khóa ngoại', 'Toàn vẹn tham chiếu', 'Foreign key constraint'),
    ]),
]
for page_index, (title, branches) in enumerate(pages, 1):
    c.setFillColorRGB(.96, .98, .98)
    c.rect(0, 0, 1000, 700, fill=1, stroke=0)
    c.setFillColorRGB(.08, .18, .17)
    c.setFont('VN-Bold', 22)
    c.drawCentredString(500, 655, f'SƠ ĐỒ TƯ DUY - {page_index}/2')
    positions = [(35, 440), (555, 440), (35, 80), (555, 80)]
    c.setStrokeColorRGB(.18, .53, .48)
    c.setLineWidth(2)
    for x, y in positions:
        c.line(500, 345, x + 205, y + 65)
    c.setFillColorRGB(1, 1, 1)
    c.roundRect(275, 305, 450, 80, 14, fill=1, stroke=1)
    c.setFont('VN-Bold', 23)
    c.setFillColorRGB(.03, .35, .31)
    c.drawCentredString(500, 337, title)
    for (heading, line1, line2), (x, y) in zip(branches, positions):
        c.setFillColorRGB(1, 1, 1)
        c.roundRect(x, y, 410, 130, 12, fill=1, stroke=1)
        c.setFillColorRGB(.08, .18, .17)
        c.setFont('VN-Bold', 20)
        c.drawCentredString(x + 205, y + 92, heading)
        c.setFont('VN', 17)
        c.drawCentredString(x + 205, y + 58, line1)
        c.setFont('VN', 15)
        c.drawCentredString(x + 205, y + 28, line2)
    c.setFont('VN', 12)
    c.drawCentredString(500, 28, 'Bộ test ScholarFlow | Đối chiếu đủ bốn nhánh, không suy diễn quan hệ từ OCR')
    c.showPage()
c.save()
# No text layer: render the native pages, then embed only their pixels.
pdf = pdfium.PdfDocument(str(native))
with tempfile.TemporaryDirectory(prefix='sf-mindmap-') as temp:
    c = canvas.Canvas(str(scanned), pagesize=(1000, 700))
    for i in range(len(pdf)):
        page = pdf[i]
        bitmap = page.render(scale=2)
        image_path = Path(temp) / f'{i}.png'
        bitmap.to_pil().save(image_path)
        c.drawImage(str(image_path), 0, 0, width=1000, height=700)
        c.showPage()
        bitmap.close()
        page.close()
    c.save()
pdf.close()
print(native)
print(scanned)
