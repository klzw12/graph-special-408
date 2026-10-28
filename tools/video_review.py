#!/usr/bin/env python3
"""
video_review.py — manim 教学视频审阅（单文件）
=============================================

用途：抽关键帧 → 拼成一张 contact sheet → 附上源码旁白，供人或 AI 判断
      「排版问题」与「逻辑问题」。

设计取舍（都是实测踩出来的，不要随手改）：
  1. 不用 ffmpeg 的 select=gt(scene,X)：manim 换屏是淡入淡出，实测 0 命中。
     改为抽低清帧算帧差，取峰值 Top-K。
  2. 峰值落在淡入淡出**中间**，抽到的是半透明转场帧 → 峰值后移 OFFSET 秒。
  3. 旁白用 AST 提取，不用正则：多行字符串会把整段代码当旁白吐出来。
  4. 拼图用 PIL 而不是 ffmpeg tile：少一层滤镜表达式，且能给每格标时间码。

用法：
  uv run --with numpy --with pillow video_review.py <video.mp4> [选项]

  常用：
    --py  <scene.py>     对应 manim 源码，用于提取旁白与分屏方法
    --out <dir>          输出目录（默认 tmp/review）
    --max-frames 6       最多抽几帧
    --offset 1.2         峰值后移秒数（避开转场）
    --fps 2              低清取样帧率
    --cols 3             拼图列数
    --json               额外打印机器可读摘要

输出：
  <out>/f01.png ...    关键帧
  <out>/sheet.png      拼图（每格左上角标 #序号 + 时间码）
  <out>/frames.txt     帧对照 + 源码分屏/旁白

退出码：0 正常；2 参数错误；3 找不到 ffmpeg/ffprobe。
"""

from __future__ import annotations

import argparse
import ast
import json
import shutil
import subprocess
import sys
from pathlib import Path

try:
    import numpy as np
    from PIL import Image, ImageDraw
except ImportError:  # pragma: no cover
    sys.exit("需要 numpy 与 pillow：uv run --with numpy --with pillow ...")

MAGIC_W, MAGIC_H = 64, 36   # 帧差计算用的缩略尺寸
MIN_GAP = 3.0               # 两个切屏点最小间隔（秒）
MIN_DIFF = 0.15             # 低于此差值视为噪声


# ── 外部命令 ────────────────────────────────────────────────
def _ffmpeg() -> str:
    exe = shutil.which("ffmpeg")
    if not exe:
        sys.exit("找不到 ffmpeg，请把 ffmpeg 加入 PATH")
    return exe


def _ffprobe() -> str:
    exe = shutil.which("ffprobe")
    if not exe:
        sys.exit("找不到 ffprobe，请把 ffmpeg 加入 PATH")
    return exe


def probe(video: Path) -> dict:
    out = subprocess.run(
        [_ffprobe(), "-v", "error", "-show_entries",
         "format=duration:stream=width,height", "-of", "json", str(video)],
        capture_output=True, text=True, check=True,
    ).stdout
    data = json.loads(out)
    duration = float(data["format"]["duration"])
    streams = [s for s in data.get("streams", []) if s.get("width")]
    w, h = (streams[0]["width"], streams[0]["height"]) if streams else (0, 0)
    return {"duration": duration, "width": w, "height": h}


# ── 切屏检测 ────────────────────────────────────────────────
def sample_frames(video: Path, workdir: Path, fps: float) -> list[Path]:
    subprocess.run(
        [_ffmpeg(), "-v", "error", "-y", "-i", str(video),
         "-vf", f"fps={fps},scale=320:-1", str(workdir / "p%04d.png")],
        check=True, capture_output=True,
    )
    return sorted(workdir.glob("p*.png"))


def detect_cuts(frames: list[Path], fps: float, max_frames: int) -> list[float]:
    if len(frames) < 3:
        return []
    arr = [np.asarray(Image.open(f).convert("L").resize((MAGIC_W, MAGIC_H)), dtype=np.float32)
           for f in frames]
    diffs = np.array([np.abs(arr[i] - arr[i - 1]).mean() for i in range(1, len(arr))])
    times = np.array([(i + 1) / fps for i in range(1, len(arr))], dtype=float)
    if float(diffs.max()) < 1e-6:
        return []

    smooth = np.convolve(diffs, np.ones(3) / 3, mode="same")
    peaks = [i for i in range(1, len(smooth) - 1)
             if smooth[i] >= smooth[i - 1] and smooth[i] >= smooth[i + 1]]
    peaks.sort(key=lambda i: -smooth[i])

    picked: list[tuple[float, float]] = []
    for i in peaks:
        if smooth[i] < MIN_DIFF:
            break
        if picked and abs(times[i] - picked[-1][0]) < MIN_GAP:
            continue
        picked.append((float(times[i]), float(smooth[i])))
        if len(picked) >= max_frames:
            break

    picked.sort()
    out, prev = [], -1e9
    for t, _ in picked:
        if t - prev >= MIN_GAP:
            out.append(t)
            prev = t
    return out


# ── 抽帧 + 拼图 ─────────────────────────────────────────────
def grab(video: Path, t: float, dst: Path, width: int = 640) -> None:
    subprocess.run(
        [_ffmpeg(), "-v", "error", "-y", "-ss", f"{t:.2f}", "-i", str(video),
         "-frames:v", "1", "-vf", f"scale={width}:-1", str(dst)],
        check=True, capture_output=True,
    )


def make_sheet(shots: list[tuple[float, Path]], dst: Path, cols: int = 3) -> None:
    imgs = [Image.open(p).convert("RGB") for _, p in shots]
    if not imgs:
        return
    w = max(i.width for i in imgs)
    h = max(i.height for i in imgs)
    pad, margin, label_h = 6, 8, 18
    rows = (len(imgs) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * w + (cols - 1) * pad + 2 * margin,
                              rows * (h + label_h) + (rows - 1) * pad + 2 * margin),
                      (17, 17, 17))
    draw = ImageDraw.Draw(sheet)
    for k, ((t, _), im) in enumerate(zip(shots, imgs)):
        r, c = divmod(k, cols)
        x = margin + c * (w + pad)
        y = margin + r * (h + label_h + pad)
        sheet.paste(im, (x, y + label_h))
        draw.text((x + 4, y + 3), f"#{k + 1}  {t:6.1f}s", fill=(210, 210, 210))
    sheet.save(dst)


# ── 源码旁白（AST） ──────────────────────────────────────────
def narration(py: Path) -> tuple[list[str], list[str]]:
    tree = ast.parse(py.read_text(encoding="utf-8"))
    screens, texts = [], []
    for node in ast.walk(tree):
        if isinstance(node, ast.ClassDef):
            for item in node.body:
                if isinstance(item, ast.FunctionDef) and item.name.startswith("_") \
                        and item.name != "__init__":
                    screens.append(item.name)
        if isinstance(node, ast.Constant) and isinstance(node.value, str):
            s = " ".join(node.value.split())
            if len(s) >= 12 and not any(tok in s for tok in ("import ", "def ", "class ", "font_size", "color=")):
                texts.append(s)
    return list(dict.fromkeys(screens)), texts


# ── 主流程 ─────────────────────────────────────────────────
def main() -> int:
    ap = argparse.ArgumentParser(description="manim 教学视频审阅")
    ap.add_argument("video", type=Path, nargs="?")
    ap.add_argument("--py", type=Path, default=None, help="对应 manim 源码")
    ap.add_argument("--out", type=Path, default=Path("tmp/review"))
    ap.add_argument("--max-frames", type=int, default=6)
    ap.add_argument("--offset", type=float, default=1.2, help="峰值后移秒数")
    ap.add_argument("--fps", type=float, default=2.0)
    ap.add_argument("--cols", type=int, default=3)
    ap.add_argument("--json", action="store_true")
    ap.add_argument("--video-dir", type=Path, default=None, help="批量：视频目录")
    ap.add_argument("--py-dir", type=Path, default=None, help="批量：对应源码目录")
    args = ap.parse_args()

    # ── 批量模式：每个视频递归调用本文件，互不干扰 ──
    if args.video_dir is not None:
        vids = sorted(args.video_dir.glob("*.mp4"))
        if not vids:
            print(f"{args.video_dir} 下没有 mp4")
            return 2
        for v in vids:
            prefix = v.name.split("-")[0]
            sub = ["--out", str(args.out / prefix), "--max-frames", str(args.max_frames),
                   "--offset", str(args.offset), "--fps", str(args.fps), "--cols", str(args.cols)]
            if args.py_dir:
                cand = args.py_dir / f"{prefix}.py"
                if cand.exists():
                    sub += ["--py", str(cand)]
            print(f"\n=== {prefix} ===")
            subprocess.run([sys.executable, str(Path(__file__).resolve()), str(v)] + sub, check=False)
        return 0

    if args.video is None or not args.video.exists():
        print(f"找不到视频: {args.video}")
        return 2

    args.out.mkdir(parents=True, exist_ok=True)
    for old in args.out.glob("f*.png"):
        old.unlink()

    meta = probe(args.video)
    print(f"视频: {args.video.name}  {meta['width']}x{meta['height']}  "
          f"时长 {meta['duration']:.1f}s")

    # 临时目录放在输出目录下（系统临时区在沙箱里可能不可写）
    probe_dir = args.out / '_probe'
    if probe_dir.exists():
        for f in probe_dir.glob('*.png'):
            f.unlink()
    probe_dir.mkdir(parents=True, exist_ok=True)
    frames = sample_frames(args.video, probe_dir, args.fps)
    cuts = detect_cuts(frames, args.fps, args.max_frames)
    print(f"低清取样 {len(frames)} 帧 → 切屏点 {len(cuts)} 个")
    for f in probe_dir.glob('*.png'):
        f.unlink()
    probe_dir.rmdir()

    dur = meta["duration"]
    if not cuts:
        print("未检出切屏，改为均匀抽帧")
        cuts = [dur * (i + 0.5) / args.max_frames for i in range(args.max_frames)]
    times = sorted({min(t + args.offset, dur - 0.2) for t in cuts})[: args.max_frames]

    shots: list[tuple[float, Path]] = []
    for i, t in enumerate(times, 1):
        p = args.out / f"f{i:02d}.png"
        grab(args.video, t, p)
        shots.append((t, p))

    sheet = args.out / "sheet.png"
    make_sheet(shots, sheet, args.cols)
    print(f"拼图: {sheet}")

    lines = ["== 帧对照 =="]
    lines += [f"#{i}  {t:7.2f}s  f{i:02d}.png" for i, (t, _) in enumerate(shots, 1)]

    if args.py and args.py.exists():
        screens, texts = narration(args.py)
        lines += ["", "== 源码：分屏方法 =="]
        lines += [f"  {s}" for s in screens]
        lines += ["", "== 源码：旁白（逻辑核对用） =="]
        lines += [f"  {t}" for t in texts]

    report = args.out / "frames.txt"
    report.write_text("\n".join(lines), encoding="utf-8")
    print(f"报告: {report}")

    if args.json:
        print(json.dumps({"video": str(args.video), "sheet": str(sheet),
                          "frames": [{"t": t, "file": str(p)} for t, p in shots],
                          "report": str(report)}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    for _s in (sys.stdout, sys.stderr):
        try:
            _s.reconfigure(encoding='utf-8')
        except Exception:
            pass
    raise SystemExit(main())
