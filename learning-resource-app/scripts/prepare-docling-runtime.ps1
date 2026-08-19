param(
  [switch]$Force
)

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$runtimeRoot = Join-Path $projectRoot ".docling-runtime"
$modelsRoot = Join-Path $runtimeRoot "models"
$tableFormerRoot = Join-Path $modelsRoot "tableformer"
$tesseractRoot = Join-Path $modelsRoot "tesseract"
$pdfiumRoot = Join-Path $runtimeRoot "pdfium\lib"
$modelsBaseUrl = if ($env:DOCLING_RS_MODELS_URL) {
  $env:DOCLING_RS_MODELS_URL.TrimEnd("/")
} else {
  "https://github.com/docling-project/docling.rs/releases/download/models-v1"
}
$pdfiumUrl = "https://github.com/bblanchon/pdfium-binaries/releases/latest/download/pdfium-win-x64.tgz"

New-Item -ItemType Directory -Force -Path $modelsRoot, $tableFormerRoot, $tesseractRoot, $pdfiumRoot | Out-Null

function Get-RuntimeAsset {
  param(
    [Parameter(Mandatory = $true)][string]$Url,
    [Parameter(Mandatory = $true)][string]$Destination,
    [switch]$Optional
  )

  if ((Test-Path -LiteralPath $Destination) -and -not $Force) {
    Write-Host "= $Destination"
    return
  }

  $downloadPath = "$Destination.download"
  Write-Host "> $Destination"
  & curl.exe -fL --connect-timeout 30 --speed-limit 1024 --speed-time 60 --retry 3 --retry-delay 2 -o $downloadPath $Url
  if ($LASTEXITCODE -ne 0) {
    Remove-Item -LiteralPath $downloadPath -Force -ErrorAction SilentlyContinue
    if ($Optional) {
      Write-Host "  Không có asset tùy chọn: $Url"
      return
    }
    throw "Không tải được $Url"
  }
  Move-Item -LiteralPath $downloadPath -Destination $Destination -Force
}

$pdfiumDll = Join-Path $pdfiumRoot "pdfium.dll"
if (-not (Test-Path -LiteralPath $pdfiumDll) -or $Force) {
  $archivePath = Join-Path $env:TEMP "scholarflow-pdfium-win-x64.tgz"
  $extractRoot = Join-Path $env:TEMP ("scholarflow-pdfium-" + [guid]::NewGuid().ToString("N"))
  try {
    Get-RuntimeAsset -Url $pdfiumUrl -Destination $archivePath
    New-Item -ItemType Directory -Force -Path $extractRoot | Out-Null
    & tar.exe -xzf $archivePath -C $extractRoot bin/pdfium.dll
    if ($LASTEXITCODE -ne 0) { throw "Không giải nén được pdfium.dll" }
    Copy-Item -LiteralPath (Join-Path $extractRoot "bin\pdfium.dll") -Destination $pdfiumDll -Force
  } finally {
    Remove-Item -LiteralPath $archivePath -Force -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath $extractRoot -Recurse -Force -ErrorAction SilentlyContinue
  }
} else {
  Write-Host "= $pdfiumDll"
}

$requiredAssets = @(
  @("layout_heron.onnx", (Join-Path $modelsRoot "layout_heron.onnx")),
  @("ocr_rec.onnx", (Join-Path $modelsRoot "ocr_rec.onnx")),
  @("ppocr_keys_v1.txt", (Join-Path $modelsRoot "ppocr_keys_v1.txt")),
  @("encoder.onnx", (Join-Path $tableFormerRoot "encoder.onnx")),
  @("decoder.onnx", (Join-Path $tableFormerRoot "decoder.onnx")),
  @("bbox.onnx", (Join-Path $tableFormerRoot "bbox.onnx"))
)

foreach ($asset in $requiredAssets) {
  Get-RuntimeAsset -Url "$modelsBaseUrl/$($asset[0])" -Destination $asset[1]
}

$vietnameseOcrModel = Join-Path $tesseractRoot "vie.traineddata"
Get-RuntimeAsset -Url "https://raw.githubusercontent.com/tesseract-ocr/tessdata_fast/4.1.0/vie.traineddata" -Destination $vietnameseOcrModel
$vietnameseOcrHash = (Get-FileHash -LiteralPath $vietnameseOcrModel -Algorithm SHA256).Hash.ToLowerInvariant()
if ($vietnameseOcrHash -ne "79df64caf7bcfb2a27df5042ecb6121e196eada34da774956995747636d5bfa1") {
  throw "Checksum model OCR tiếng Việt không đúng"
}
$englishOcrModel = Join-Path $tesseractRoot "eng.traineddata"
Get-RuntimeAsset -Url "https://raw.githubusercontent.com/tesseract-ocr/tessdata_fast/4.1.0/eng.traineddata" -Destination $englishOcrModel
$englishOcrHash = (Get-FileHash -LiteralPath $englishOcrModel -Algorithm SHA256).Hash.ToLowerInvariant()
if ($englishOcrHash -ne "7d4322bd2a7749724879683fc3912cb542f19906c83bcc1a52132556427170b2") {
  throw "Checksum model OCR tiếng Anh/kỹ thuật không đúng"
}

$optionalAssets = @(
  @("encoder.onnx.data", (Join-Path $tableFormerRoot "encoder.onnx.data")),
  @("decoder.onnx.data", (Join-Path $tableFormerRoot "decoder.onnx.data")),
  @("decoder_kv.onnx", (Join-Path $tableFormerRoot "decoder_kv.onnx")),
  @("decoder_kv.onnx.data", (Join-Path $tableFormerRoot "decoder_kv.onnx.data")),
  @("bbox.onnx.data", (Join-Path $tableFormerRoot "bbox.onnx.data")),
  @("wordmap.json", (Join-Path $tableFormerRoot "wordmap.json")),
  @("picture_classifier.onnx", (Join-Path $modelsRoot "picture_classifier.onnx")),
  @("layout_heron_int8.onnx", (Join-Path $modelsRoot "layout_heron_int8.onnx")),
  @("decoder_kv_int8.onnx", (Join-Path $tableFormerRoot "decoder_kv_int8.onnx")),
  @("decoder_kv_int8.onnx.data", (Join-Path $tableFormerRoot "decoder_kv_int8.onnx.data"))
)

foreach ($asset in $optionalAssets) {
  Get-RuntimeAsset -Url "$modelsBaseUrl/$($asset[0])" -Destination $asset[1] -Optional
}

Copy-Item -LiteralPath (Join-Path $projectRoot "docs\DOCUMENT_MODELS_NOTICE.md") -Destination (Join-Path $runtimeRoot "MODEL_LICENSES.md") -Force

Write-Host "Docling runtime đã sẵn sàng tại $runtimeRoot"
