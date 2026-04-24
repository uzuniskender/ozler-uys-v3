# UYS v3 - Install git hooks via core.hooksPath
# Run ONCE per machine after first clone (or after changing hook path).

$ErrorActionPreference = "Stop"

try {
    $repoRoot = git rev-parse --show-toplevel 2>$null
} catch {
    $repoRoot = $null
}
if (-not $repoRoot) {
    Write-Host "ERROR: Not in a git repository." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "=== UYS v3 git hook installation ===" -ForegroundColor Cyan
Write-Host "Repo: $repoRoot"

# Point git at the versioned hooks directory
git config core.hooksPath scripts/git-hooks
Write-Host ""
Write-Host "core.hooksPath = scripts/git-hooks" -ForegroundColor Green
Write-Host ""

# Verify
$hookPath = Join-Path $repoRoot "scripts\git-hooks\pre-push"
if (Test-Path $hookPath) {
    Write-Host "pre-push hook found: OK" -ForegroundColor Green
} else {
    Write-Host "WARNING: $hookPath not found." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Test with: git push --dry-run" -ForegroundColor Gray
Write-Host "Bypass any time with: git push --no-verify" -ForegroundColor Gray
Write-Host ""
