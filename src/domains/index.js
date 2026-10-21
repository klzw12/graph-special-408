/**
 * 🕸️ Domain 入口
 * ==============
 * 三个顶级域（v2 规格 §一）：408 / 数学 / 政治。
 *
 * 新增顶级域：import 后加入 categories 数组。
 * 新增一科：改对应顶级域的聚合文件（如 ./408.js），不要动这里。
 */

import k408 from './408.js'
import math from './math.js'
import pol from './pol.js'

const categories = [k408, math, pol]

export const graphData = {
  title: '考研知识图谱',
  root: {
    id: 'root',
    label: '考研知识图谱',
    color: '#ffffff',
    description: '408 / 数学 / 政治 —— 按大纲组织，按因果理解',
    children: categories.map((c) => c.root),
  },
  relations: categories.flatMap((c) => c.relations || []),
}

function countNodes(root) {
  let n = 1
  if (root.children) root.children.forEach((c) => (n += countNodes(c)))
  return n
}

console.log(
  `🕸️ 已加载 ${categories.length} 个大类, 共 ${countNodes(graphData.root)} 个节点, ${graphData.relations.length} 条交叉关联`
)
