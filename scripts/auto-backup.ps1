$ProjectRoot = "c:\Users\USER\Documents\trae_projects\GAMBLE"
$LogFile = Join-Path $ProjectRoot "data\backups\backup.log"
$DateStr = Get-Date -Format "yyyy-MM-dd_HHmm"
$OneDriveExe = "$env:LOCALAPPDATA\Microsoft\OneDrive\OneDrive.exe"
$OneDriveBackup = "$env:USERPROFILE\OneDrive\Documents\GAMBLE_backups"

$logLines = [System.Collections.ArrayList]::new()
[void]$logLines.Add("=== Backup $DateStr ===")

Set-Location $ProjectRoot
$ErrorActionPreference = "Continue"

try {
    [void]$logLines.Add("[1/3] Git add + commit ...")
    $addOutput = git add -A 2>&1
    if ($LASTEXITCODE -ne 0 -and $addOutput) {
        [void]$logLines.Add("  Git add warning: $addOutput")
    }

    git diff --cached --quiet 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) {
        $commitOutput = git commit -m "chore: daily backup $DateStr" 2>&1
        [void]$logLines.Add("  Committed: $commitOutput")

        [void]$logLines.Add("[2/3] Git push ...")
        $pushOutput = git push origin main 2>&1
        if ($LASTEXITCODE -ne 0) {
            [void]$logLines.Add("  Push ERROR: $pushOutput")
        } else {
            [void]$logLines.Add("  Pushed to GitHub.")
        }
    } else {
        [void]$logLines.Add("  No changes to commit.")
    }

    [void]$logLines.Add("[3/3] OneDrive ZIP backup ...")

    $onedriveRunning = Get-Process "OneDrive" -ErrorAction SilentlyContinue
    if (-not $onedriveRunning) {
        if (Test-Path $OneDriveExe) {
            Start-Process $OneDriveExe -WindowStyle Hidden
            [void]$logLines.Add("  Started OneDrive sync.")
            Start-Sleep -Seconds 3
        } else {
            [void]$logLines.Add("  WARNING: OneDrive.exe not found.")
        }
    }

    if (-not (Test-Path $OneDriveBackup)) {
        New-Item -ItemType Directory -Path $OneDriveBackup -Force | Out-Null
    }

    $ZipDest = Join-Path $OneDriveBackup "GAMBLE_$DateStr.zip"
    $files = Get-ChildItem -Path $ProjectRoot -Recurse -File -ErrorAction SilentlyContinue |
        Where-Object {
            $_.FullName -notmatch "\\.next\\" -and
            $_.FullName -notmatch "\\node_modules\\" -and
            $_.FullName -notmatch "\\.git\\"
        }
    $files | Compress-Archive -DestinationPath $ZipDest -Force

    $zipSize = [math]::Round((Get-Item $ZipDest).Length / 1KB, 1)
    [void]$logLines.Add("  ZIP saved: $ZipDest ($zipSize KB)")

    $ziplist = Get-ChildItem $OneDriveBackup -Filter "GAMBLE_*.zip" |
        Sort-Object LastWriteTime -Descending |
        Select-Object -Skip 7
    foreach ($old in $ziplist) {
        Remove-Item $old.FullName -Force -ErrorAction SilentlyContinue
        [void]$logLines.Add("  Removed old: $($old.Name)")
    }

    [void]$logLines.Add("=== SUCCESS ===")
} catch {
    [void]$logLines.Add("=== FAILED: $_ ===")
}

$logText = $logLines -join "`n"
$logText | Out-File -FilePath $LogFile -Append -Encoding UTF8
Write-Output $logText
