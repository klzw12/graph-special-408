/**
 * 📐 考研数学 · 骨架
 * ==================
 * 骨架按大纲章走；AI 应用作为 ext-* 旁支挂在本科根下（v2 规格 §二）。
 * 目前只有骨架，无内容。
 */

export default {
  root: {
    id: 'math',
    label: '数学',
    color: '#eab308',
    description: '高等数学 / 线性代数 / 概率论与数理统计',
    children: [
      {
        id: 'math-calc',
        label: '高等数学',
        color: '#d4a000',
        children: [
          { id: 'math-calc-limit', label: '极限与连续', color: '#c89810' },
          { id: 'math-calc-deriv', label: '一元微分学', color: '#c89810' },
          { id: 'math-calc-integ', label: '一元积分学', color: '#c89810' },
          { id: 'math-calc-multi', label: '多元微积分', color: '#c89810' },
          { id: 'math-calc-series', label: '级数与微分方程', color: '#c89810' },
        ],
      },
      {
        id: 'math-linalg',
        label: '线性代数',
        color: '#d4a000',
        children: [
          { id: 'math-linalg-det', label: '行列式', color: '#c89810' },
          { id: 'math-linalg-matrix', label: '矩阵', color: '#c89810' },
          { id: 'math-linalg-vector', label: '向量组', color: '#c89810' },
          { id: 'math-linalg-eigen', label: '特征值与二次型', color: '#c89810' },
        ],
      },
      {
        id: 'math-prob',
        label: '概率论与数理统计',
        color: '#d4a000',
        children: [
          { id: 'math-prob-event', label: '随机事件与概率', color: '#c89810' },
          { id: 'math-prob-rv', label: '随机变量及其分布', color: '#c89810' },
          { id: 'math-prob-stat', label: '统计与假设检验', color: '#c89810' },
        ],
      },
    ],
  },
  relations: [],
}
