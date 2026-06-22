param(
    [ValidateSet("cpu", "cuda")]
    [string]$Device = "cuda",
    [int]$BatchSize = 0,
    [int]$Port = 8001
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath ".venv\Scripts\python.exe")) {
    throw "Missing .venv. Run .\setup.ps1 -Device $Device first."
}

if ($BatchSize -le 0) {
    $BatchSize = if ($Device -eq "cuda") { 2 } else { 4 }
}

if ($Device -eq "cuda") {
    & .\.venv\Scripts\python.exe -c "import torch, sys; sys.exit(0 if torch.cuda.is_available() else 1)"
    if ($LASTEXITCODE -ne 0) {
        throw "CUDA is unavailable. Run .\setup.ps1 -Device cuda or start with -Device cpu."
    }
}

$env:EMBEDDING_DEVICE = $Device
$env:EMBEDDING_BATCH_SIZE = [string]$BatchSize

Write-Host "Starting BGE-M3 on $Device with batch size $BatchSize."
& .\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port $Port
