"""
从 manim 场景源码里抽取「分屏方法」和「旁白文本」
=================================================
为什么不用正则：
  正则会被多行字符串、f-string、LaTeX 转义搞乱（实测会把整段代码当旁白吐出来）。
  AST 是 Python 自己的解析器，稳。

用法：
  python py_narration.py <scene.py>

输出（每行一条）：
  SCREEN  方法名
  NARR    旁白/说明文本（长度 >= 12 的字符串常量，按出现顺序）
"""

import ast
import sys

MIN_LEN = 12


def main():
    path = sys.argv[1]
    src = open(path, encoding='utf-8').read()
    tree = ast.parse(src)

    screen_methods = []
    narrations = []

    for node in ast.walk(tree):
        if isinstance(node, ast.ClassDef):
            for item in node.body:
                if isinstance(item, ast.FunctionDef) and item.name.startswith('_') and item.name not in ('__init__',):
                    screen_methods.append(item.name)
        if isinstance(node, ast.Constant) and isinstance(node.value, str):
            text = ' '.join(node.value.split())
            if len(text) >= MIN_LEN and not any(
                tok in text for tok in ('import ', 'def ', 'class ', 'font_size', 'color=', '\n\n\n')
            ):
                narrations.append(text)

    for name in dict.fromkeys(screen_methods):
        print(f'SCREEN\t{name}')
    for text in narrations:
        print(f'NARR\t{text}')


if __name__ == '__main__':
    main()
