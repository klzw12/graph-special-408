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
          {
            id: 'math-linalg-det',
            label: '1 行列式',
            color: '#c89810',
            description: '方阵的一个数：判断可逆、解的唯一性、体积缩放',
            content: {
              summary: 'Determinant — 方阵到数的一个映射，回答“这个变换有没有把空间压扁”。',
              chain: {
                problem: '解线性方程组时，需要判断“有没有唯一解”，以及唯一解的分母是什么',
                solution: '把所有 n! 种“每行取一个元素”的乘积带符号求和，得到一个数；它同时是体积缩放倍数',
                newProblem:
                  'n! 项没法直接算，4 阶就有 24 项 → 必须靠性质化三角或按行列开降阶',
              },
              tags: ['数学', '线代', '第一章'],
            },
            children: [
              {
                id: 'math-linalg-det-def',
                label: '1.1 定义与六条性质',
                color: '#b98c08',
                content: {
                  summary: '完全展开式（逆序数定符号）+ 转置/换行/提公因子/倍加/成比例为0/展开',
                  chain: {
                    problem: '直接按定义算要 n! 项，必须找到“不改变值但能化简”的合法操作',
                    solution: '六条性质：换行变号、一行提 k、倍加不变、成比例为 0、转置不变、按行列展开',
                    newProblem: '性质只能判断“能怎么变”，还需要一个终止形态 → 化三角形',
                  },
                  tags: ['数学', '线代'],
                },
              },
              {
                id: 'math-linalg-det-cofactor',
                label: '1.2 代数余子式（含异乘变零）',
                color: '#b98c08',
                content: {
                  summary: 'A_ij = (−1)^(i+j) M_ij；展开定理 + 异乘变零；A* 与求逆的桥梁',
                  chain: {
                    problem: '直接展开 n 阶要 n! 项，需要“降阶”：把 n 阶变成 n−1 阶',
                    solution: '按一行展开：|A| = Σ a_ik·A_ik；异乘变零说明用别的行去配得 0',
                    newProblem: 'A_ij 与 a_ij 无关 ⇒ 可以先改元素再展开（抽象题入口），也引出 A* 与 A⁻¹',
                  },
                  tags: ['数学', '线代'],
                },
              },
              {
                id: 'math-linalg-det-special',
                label: '1.3 特殊行列式识别',
                color: '#b98c08',
                content: {
                  summary: '行和相等 / 箭头型 / 三对角递推 / 范德蒙德 / 分块',
                  chain: {
                    problem: '化三角对高阶数值题够用，但对有结构规律的矩阵仍然是浪费',
                    solution: '识别结构直接套：行和相等→全加第1列提k；箭头型→主元消箭杆；三对角→递推；范德蒙德→∏(xⱼ−xᵢ)',
                    newProblem: '识别需要“先看结构再看数”，与化三角的习惯相反 → 时间压力下容易直接硬算超时',
                  },
                  tags: ['数学', '线代'],
                },
              },
            ],
          },
          { id: 'math-linalg-matrix', label: '2 矩阵', color: '#c89810' },
          { id: 'math-linalg-vector', label: '3 向量组', color: '#c89810' },
          { id: 'math-linalg-eq', label: '4 线性方程组', color: '#c89810' },
          { id: 'math-linalg-eigen', label: '5 特征值与特征向量', color: '#c89810' },
          { id: 'math-linalg-quad', label: '6 二次型', color: '#c89810' },
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
