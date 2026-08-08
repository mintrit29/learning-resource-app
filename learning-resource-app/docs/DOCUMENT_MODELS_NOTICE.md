# Document model notice

ScholarFlow packages unmodified document-processing assets downloaded from the official `docling-project/docling.rs` model release. These assets are licensed separately from ScholarFlow and `docling.rs`:

- RT-DETR layout (`layout_heron.onnx`): Apache-2.0, `docling-project/docling-layout-heron`.
- TableFormer: CDLA-Permissive-2.0 / Apache-2.0, `docling-project/docling-models`.
- DocumentFigureClassifier: Apache-2.0, `docling-project/DocumentFigureClassifier-v2.5`.
- PP-OCRv3 recognition model and dictionary: Apache-2.0, PaddleOCR / SWHL RapidOCR.
- PDFium Windows binary: BSD-3-Clause / Apache-2.0, `bblanchon/pdfium-binaries` builds of Google's PDFium.

The preparation script downloads the files without retraining or modifying their weights. Refer to each upstream model card and repository for the complete license text and terms.
