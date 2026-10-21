/**
 * 🔢 408 · 四科骨架
 * =================
 * 骨架服从目的（考研），所以这一层就是大纲的四科，**不增不减**。
 * 四科里目前只有 OS 有内容，其余三科留空壳 —— 空壳是骨架占位，不是假节点。
 *
 * 新增一科：
 *   1. 在本目录建 <科>.js，导出 { root, relations }（root 的 id 用 408-os / 408-ds / 408-co / 408-cn）
 *   2. 在下面 import 并加进 subs
 */

import os from './408/os.js'

const subs = [os]

export default {
  root: {
    id: '408',
    label: '408',
    color: '#4d96ff',
    description: '计算机学科专业基础综合：操作系统 / 数据结构 / 计组 / 计网',
    children: [
      ...subs.map((s) => s.root),
      { id: '408-ds', label: '数据结构', color: '#2f7ed8', description: '待建' },
      { id: '408-co', label: '计算机组成原理', color: '#2f7ed8', description: '待建' },
      { id: '408-cn', label: '计算机网络', color: '#2f7ed8', description: '待建' },
    ],
  },
  relations: subs.flatMap((s) => s.relations || []),
}
