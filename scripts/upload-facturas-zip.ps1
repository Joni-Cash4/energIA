# upload-facturas-zip.ps1
# Descomprime un ZIP de facturas TotalEnergies y sube cada PDF al CRM.
# Uso: .\scripts\upload-facturas-zip.ps1 -ZipPath "C:\Users\...\xxxx.zip"
#
# El API auto-detecta el cliente por CUPS extraido del PDF.
# Facturas ya existentes (mismo numero_factura) se saltan automaticamente.

param(
    [Parameter(Mandatory=$true)]
    [string]$ZipPath,

    [string]$ApiUrl = "http://localhost:3000/api/facturas-contrato/upload"
)

$ErrorActionPreference = "Stop"

# ── Extraer ZIP ──────────────────────────────────────────────────────────────
$zipName = [System.IO.Path]::GetFileNameWithoutExtension($ZipPath)
$destDir = Join-Path ([System.IO.Path]::GetDirectoryName($ZipPath)) "facturas_$zipName"

if (Test-Path $destDir) { Remove-Item $destDir -Recurse -Force }
Expand-Archive -Path $ZipPath -DestinationPath $destDir
$pdfs = Get-ChildItem $destDir -Filter "*.PDF" -Recurse
if (-not $pdfs) { $pdfs = Get-ChildItem $destDir -Filter "*.pdf" -Recurse }

Write-Host ""
Write-Host "=== RECOGE FACTURAS ===" -ForegroundColor Cyan
Write-Host "ZIP: $ZipPath"
Write-Host "PDFs encontrados: $($pdfs.Count)"
Write-Host ""

$ok = 0; $skip = 0; $err = 0

foreach ($pdf in $pdfs) {
    Write-Host "-> $($pdf.Name)" -NoNewline

    $boundary = [System.Guid]::NewGuid().ToString()
    $LF = "`r`n"
    $fileBytes = [System.IO.File]::ReadAllBytes($pdf.FullName)
    $fileName  = $pdf.Name

    $body = [System.Collections.Generic.List[byte]]::new()
    $body.AddRange([System.Text.Encoding]::UTF8.GetBytes(
        "--$boundary$LF" +
        "Content-Disposition: form-data; name=`"pdf`"; filename=`"$fileName`"$LF" +
        "Content-Type: application/pdf$LF$LF"
    ))
    $body.AddRange($fileBytes)
    $body.AddRange([System.Text.Encoding]::UTF8.GetBytes("$LF--$boundary--$LF"))

    try {
        $resp = Invoke-WebRequest -Uri $ApiUrl -Method Post `
            -ContentType "multipart/form-data; boundary=$boundary" `
            -Body $body.ToArray() `
            -UseBasicParsing

        $data = $resp.Content | ConvertFrom-Json

        if ($data.skipped) {
            Write-Host "  [ya existe: $($data.numero_factura)]" -ForegroundColor DarkGray
            $skip++
        } elseif ($data.factura) {
            $f = $data.factura
            $periodo = if ($f.periodo_inicio) { "$($f.periodo_inicio.Substring(0,7))" } else { "?" }
            Write-Host "  OK  $periodo  $($f.kwh_total) kWh  $($f.importe_total) EUR  CUPS: $($f.cups)" -ForegroundColor Green
            $ok++
        } else {
            Write-Host "  ERROR: $($data.error)" -ForegroundColor Red
            $err++
        }
    } catch {
        $response = $_.Exception.Response
        $statusCode = 0
        if ($null -ne $response) { $statusCode = [int]$response.StatusCode }

        if ($statusCode -eq 404) {
            try {
                $stream = $response.GetResponseStream()
                $reader = New-Object System.IO.StreamReader($stream)
                $errData = $reader.ReadToEnd() | ConvertFrom-Json
                Write-Host "  [sin cliente en CRM: CUPS $($errData.cups)]" -ForegroundColor Yellow
            } catch {
                Write-Host "  [sin cliente en CRM]" -ForegroundColor Yellow
            }
            $skip++
        } else {
            Write-Host "  ERROR: $_" -ForegroundColor Red
            $err++
        }
    }
}

Write-Host ""
Write-Host "-----------------------------" -ForegroundColor DarkGray
Write-Host "Subidas: $ok  |  Ya existian: $skip  |  Errores: $err" -ForegroundColor Cyan
Write-Host ""
