# 🎬 教学视频审阅工具
# ====================
# 用途：为 manim 讲解视频做"抽帧 + 拼图 + 源码对照"，人（或 AI）看图后判排版与逻辑。
#
# 三条设计原则（都是实测踩出来的）：
#   1. 不按时间均匀抽帧 —— 按"切屏点"抽。切屏处才是排版事故高发点。
#   2. 不输出几十张图 —— 拼成一张 contact sheet，一张图看完全片。
#   3. 逻辑问题先看源码旁白，再看画面。画面只告诉你"画了什么"。
#
# ⚠️ manim 的换屏是淡入淡出，ffmpeg 的 select=gt(scene,X) 在本机实测 0 命中，
#    所以切屏点由 tools/scene_detect.py（帧差 + 自适应阈值）计算。
#
# 用法：
#   .\tools\video-review.ps1 -Video "D:\...\039_ReqPaging-ReqPaging-480p15.mp4"
#   .\tools\video-review.ps1 -Video "..." -Py "C:\...\src\408\OS\039_ReqPaging.py"
#   .\tools\video-review.ps1 -Video "..." -MaxFrames 6 -OutDir "tmp\review\039"
#
# 输出：
#   <OutDir>\f01.png ... fNN.png   关键帧（640 宽）
#   <OutDir>\sheet.png             拼图（3 列）
#   <OutDir>\frames.txt            帧号 -> 时间码 对照表 + 源码旁白

param(
  [Parameter(Mandatory = $true)][string]$Video,
  [string]$Py = '',
  [int]$MaxFrames = 9,
  [string]$OutDir = 'tmp\review',
  [string]$PythonExe = 'C:\Users\31783\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\python\python.exe',
  [double]$ProbeFps = 2.0,
  [double]$PeakOffset = 1.2   # 峰值落在淡入淡出中间，取稍后一点才是稳定画面
)

$ErrorActionPreference = 'Stop'
if (-not (Test-Path -LiteralPath $Video)) { throw "找不到视频: $Video" }
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
Get-ChildItem -LiteralPath $OutDir -Filter '*.png' -ErrorAction SilentlyContinue | Remove-Item -Force

$probeDir = Join-Path $OutDir '_probe'
if (Test-Path -LiteralPath $probeDir) { Remove-Item -LiteralPath $probeDir -Recurse -Force }
New-Item -ItemType Directory -Force -Path $probeDir | Out-Null

# ── 1. 元信息
$probe = & ffprobe -v error -show_entries format=duration:stream=width,height -of default=nw=1 $Video 2>&1 | Out-String
$dur = [double]([regex]::Match($probe, 'duration=([\d.]+)').Groups[1].Value)
$w = ([regex]::Match($probe, 'width=(\d+)')).Groups[1].Value
$h = ([regex]::Match($probe, 'height=(\d+)')).Groups[1].Value
Write-Host "视频: $(Split-Path $Video -Leaf)  ${w}x${h}  时长 $([math]::Round($dur,1))s" -ForegroundColor Cyan

# ── 2. 低清取样 + 帧差找切屏点
Write-Host "低清取样（${ProbeFps}fps）..." -ForegroundColor DarkGray
& ffmpeg -v error -y -i $Video -vf "fps=$ProbeFps,scale=320:-1" (Join-Path $probeDir 'p%04d.png') 2>&1 | Out-Null
$probeCount = (Get-ChildItem -LiteralPath $probeDir -Filter '*.png' | Measure-Object).Count
Write-Host "取样 $probeCount 帧" -ForegroundColor DarkGray

$times = @()
if (Test-Path -LiteralPath $PythonExe) {
  $script = Join-Path $PSScriptRoot 'scene_detect.py'
  $json = & $PythonExe $script $probeDir $ProbeFps $MaxFrames 2>&1 | Out-String
  try { $times = @($json.Trim() | ConvertFrom-Json | ForEach-Object { [double]$_ }) } catch { $times = @() }
  Write-Host "检测到 $($times.Count) 个切屏点" -ForegroundColor DarkGray
} else {
  Write-Host "未找到带 numpy/Pillow 的 python，跳过切屏检测" -ForegroundColor Yellow
}

if ($times.Count -eq 0) {
  Write-Host "无切屏点，改为均匀抽帧" -ForegroundColor Yellow
  $times = @(0..($MaxFrames - 1) | ForEach-Object { $dur * (($_ + 0.5) / $MaxFrames) })
}

# ── 3. 首帧 + 切屏点，去重后取前 N
$picked = $times | ForEach-Object { [math]::Min($_, $dur - 0.5) + $PeakOffset } | ForEach-Object { [math]::Min($_, $dur - 0.2) } | Sort-Object -Unique | Select-Object -First $MaxFrames

# ── 4. 抽高清帧
$n = 0; $map = @()
foreach ($t in $picked) {
  $n++
  $f = Join-Path $OutDir ('f{0:D2}.png' -f $n)
  & ffmpeg -v error -y -ss $t -i $Video -frames:v 1 -vf 'scale=640:-1' $f 2>&1 | Out-Null
  $map += ("#{0}  {1,7:N2}s  {2}" -f $n, $t, (Split-Path $f -Leaf))
}

# ── 5. 拼图
$cols = 3
$rows = [math]::Ceiling($n / $cols)
& ffmpeg -v error -y -i (Join-Path $OutDir 'f%02d.png') `
  -filter_complex "scale=640:-1,tile=${cols}x${rows}:padding=6:margin=6:color=0x111111" `
  -frames:v 1 (Join-Path $OutDir 'sheet.png') 2>&1 | Out-Null
Write-Host "拼图: $(Join-Path $OutDir 'sheet.png')" -ForegroundColor Green

# ── 6. 对照表 + 源码旁白（AST 提取，不用正则）
$report = @('== 帧对照 ==') + $map
if ($Py -and (Test-Path -LiteralPath $Py)) {
  $report += ''
  $report += '== 源码：分屏 + 旁白（AST 提取） =='
  if (Test-Path -LiteralPath $PythonExe) {
    $env:PYTHONIOENCODING = 'utf-8'
    $env:PYTHONUTF8 = '1'
    $lines = & $PythonExe (Join-Path $PSScriptRoot 'py_narration.py') $Py 2>&1
    foreach ($l in $lines) {
      $s = [string]$l
      if ($s -match '^SCREEN\t(.+)$') { $report += ('  [屏] ' + $Matches[1]) }
      elseif ($s -match '^NARR\t(.+)$') { $report += ('  [讲] ' + $Matches[1]) }
    }
  } else {
    $report += '  （未找到带 AST 运行环境的 python，跳过）'
  }
}
$report = $report | Select-Object -Unique
$report | Set-Content -LiteralPath (Join-Path $OutDir 'frames.txt') -Encoding UTF8
$report | ForEach-Object { Write-Host $_ }
