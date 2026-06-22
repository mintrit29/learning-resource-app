param(
    [ValidateSet("cpu", "cuda")]
    [string]$Device = "cpu"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath ".venv")) {
    python -m venv .venv
}

& .\.venv\Scripts\python.exe -m pip install --upgrade pip
if ($Device -eq "cuda") {
    & .\.venv\Scripts\python.exe -m pip install torch==2.12.1+cu130 --index-url https://download.pytorch.org/whl/cu130
} else {
    & .\.venv\Scripts\python.exe -m pip install torch==2.12.1+cpu --index-url https://download.pytorch.org/whl/cpu
}
& .\.venv\Scripts\python.exe -m pip install -r requirements.txt

Write-Host "Embedding service dependencies are ready for $Device."
