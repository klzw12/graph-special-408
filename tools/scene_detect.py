"""
帧差切屏检测（v2）
==================
输入：等间隔抽出的低清帧目录 + 抽帧频率
输出：时间点 JSON 数组（秒）

v2 修正：不再用"阈值筛选"，改为 **取峰值 Top-K + 最小间隔**。
原因：manim 换屏是淡入淡出，差值曲线是**宽峰**而不是尖峰，
      固定阈值要么全漏（实测 0 命中）要么全收。Top-K 稳定得多。
"""

import sys
import json
import glob
import os

import numpy as np
from PIL import Image

W, H = 64, 36
MIN_GAP = 3.0       # 两个切屏点至少隔 3 秒
MIN_DIFF = 0.15     # 低于这个差值视为噪声（画面几乎没变）


def load_small(path):
    with Image.open(path) as im:
        return np.asarray(im.convert('L').resize((W, H)), dtype=np.float32)


def main():
    probe_dir, fps, max_frames = sys.argv[1], float(sys.argv[2]), int(sys.argv[3])

    files = sorted(glob.glob(os.path.join(probe_dir, '*.png')))
    if len(files) < 3:
        print('[]')
        return

    frames = [load_small(f) for f in files]
    diffs = np.array([np.abs(frames[i] - frames[i - 1]).mean() for i in range(1, len(frames))])
    times = np.array([(i + 1) / fps for i in range(1, len(frames))])

    if float(diffs.max()) < 1e-6:
        print('[]')
        return

    # 3 帧滑动平均，抑制单帧抖动
    smooth = np.convolve(diffs, np.ones(3) / 3, mode='same')

    # 局部极大（峰）
    peaks = [i for i in range(1, len(smooth) - 1) if smooth[i] >= smooth[i - 1] and smooth[i] >= smooth[i + 1]]
    peaks.sort(key=lambda i: -smooth[i])

    picked, last = [], -1e9
    for i in peaks:
        if smooth[i] < MIN_DIFF:
            break
        if abs(times[i] - last) < MIN_GAP:
            continue
        picked.append((times[i], float(smooth[i])))
        last = times[i]
        if len(picked) >= max_frames:
            break

    picked.sort()

    # 兜底去重：按时间排序后再保证最小间隔（早出现的优先）
    final, prev = [], -1e9
    for t, score in picked:
        if t - prev >= MIN_GAP:
            final.append(t)
            prev = t

    print(json.dumps([round(t, 2) for t in final]))


if __name__ == '__main__':
    main()
