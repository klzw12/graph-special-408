# 🎬 批量审阅
# ============
# 对一个目录下的所有 manim 视频跑 video-review.ps1，并汇总成一份表。
#
# 约定：视频名 001_Foo-Foo-480p15.mp4  ↔  源码 001_Foo.py（按 "_" 前的前缀匹配）
#
# 用法：
#   .\tools\video-review-batch.ps1 -VideoDir "C:\...\videos\LinearAlgebra" -PyDir "C:\...\src\Math\LinearAlgebra"

param(
  [Parameter(Mandatory = $true)][string]$VideoDir,
  [Parameter(Mandatory = $true)][string]$PyDir,
  [string]$OutRoot = 'tmp\review\batch',
  [int]$MaxFrames = 6
)

$ErrorActionPreference = 'Stop'
$rows = @()

foreach ($v in (Get-ChildItem -LiteralPath $VideoDir -Filter '*.mp4' | Sort-Object Name)) {
  $prefix = ($v.BaseName -split '-')[0]          # 001_DeterminantGeometry
  $py = Join-Path $PyDir ($prefix + '.py')
  $out = Join-Path $OutRoot $prefix

  Write-Host "`n=== $prefix ===" -ForegroundColor Cyan
  $args = @{
    Video    = $v.FullName
    OutDir   = $out
    MaxFrames = $MaxFrames
  }
  if (Test-Path -LiteralPath $py) { $args.Py = $py }

  & (Join-Path $PSScriptRoot 'video-review.ps1') @args | Out-Null

  $frames = Get-ChildItem -LiteralPath $out -Filter 'f*.png' -ErrorAction SilentlyContinue
  $sheet = Join-Path $out 'sheet.png'
  $rows += [pscustomobject]@{
    prefix = $prefix
    frames = $frames.Count
    sheet  = if (Test-Path -LiteralPath $sheet) { (Resolve-Path $sheet).Path } else { '' }
    py     = if (Test-Path -LiteralPath $py) { 'yes' } else { 'MISSING' }
  }
}

Write-Host "`n== 汇总 ==" -ForegroundColor Green
$rows | Format-Table -AutoSize
$rows | Export-Csv -LiteralPath (Join-Path $OutRoot '_index.csv') -Encoding UTF8 -NoTypeInformation
