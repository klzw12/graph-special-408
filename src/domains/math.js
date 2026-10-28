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
        description: '行列式 / 矩阵 / 向量组 / 方程组 / 特征值 / 二次型',
        children: [
          {
            id: 'math-linalg-det',
            label: '第1章 行列式',
            color: '#c89810',
            description: '方阵的一个数：体积缩放倍数，也是可逆性的判据',
            children: [
            {
              id: 'math-linalg-det-geometry',
              label: '1.1 几何意义',
              color: '#b98c08',
              description: '行列式 = 有向面积 / 有向体积',
              src: '/pages/math/linalg/det-geometry.html',
              content: {
                summary: '行列式 = 有向面积 / 有向体积',
                chain: {
                  problem: '要判断方阵对应的变换是否可逆，需要一个能从矩阵算出来的数作判据',
                  solution: '用列向量张成的平行六面体体积（带符号）定义；绝对值是体积，符号表示朝向翻转',
                  newProblem: '几何定义算不出 4 阶以上，必须换成代数性质与降阶公式',
                },
                tags: ["数学","线代","第一章"],
              },
            },
            {
              id: 'math-linalg-det-calc',
              label: '1.2 性质与计算',
              color: '#b98c08',
              description: '三条性质 + 展开降阶 + 化上三角',
              src: '/pages/math/linalg/det-calc.html',
              content: {
                summary: '三条性质 + 展开降阶 + 化上三角',
                chain: {
                  problem: '按定义要算 n! 项（4 阶 24 项），手算不可行',
                  solution: '三条运算性质（交换变号 / 提公因子 / 倍加不变）+ 按行列展开降阶 + 化上三角',
                  newProblem: '高阶题化三角仍慢，必须会认形状：行和相等、箭头型、三对角、范德蒙德',
                },
                tags: ["数学","线代","第一章"],
              },
            },
            ],
          },
          {
            id: 'math-linalg-matrix',
            label: '第2章 矩阵',
            color: '#c89810',
            description: '矩阵 = 线性变换；乘法 = 复合；秩 = 保留的维数',
            children: [
            {
              id: 'math-linalg-matrix-inverse',
              label: '2.1 运算与逆矩阵',
              color: '#b98c08',
              description: '行乘列 = 复合变换；逆矩阵 = 反变换',
              src: '/pages/math/linalg/matrix-inverse.html',
              content: {
                summary: '行乘列 = 复合变换；逆矩阵 = 反变换',
                chain: {
                  problem: '需要一个语言描述「先做 B、再做 A」这种复合变换',
                  solution: '矩阵乘法按行乘列定义 = 复合（次序从右往左）；逆矩阵把变换还原',
                  newProblem: '矩阵不能像数一样移项：AB≠BA、消去律失效、AB=0 推不出 A=0',
                },
                tags: ["数学","线代","第二章"],
              },
            },
            {
              id: 'math-linalg-matrix-rank',
              label: '2.2 矩阵的秩',
              color: '#b98c08',
              description: '秩 = 张成空间维数 = 行阶梯非零行数',
              src: '/pages/math/linalg/rank.html',
              content: {
                summary: '秩 = 张成空间维数 = 行阶梯非零行数',
                chain: {
                  problem: '需要一个数来量化「一个变换丢掉了多少维」',
                  solution: '秩 = 行/列向量张成空间维数 = 行阶梯形非零行数',
                  newProblem: '求秩容易，但秩的证明（不等式、r(AᵀA)=r(A)）需要构造，是考点',
                },
                tags: ["数学","线代","第二章"],
              },
            },
            ],
          },
          {
            id: 'math-linalg-vector',
            label: '第3章 向量组',
            color: '#c89810',
            description: '相关性 / 极大无关组 / 内积与正交化',
            children: [
            {
              id: 'math-linalg-vector-dependence',
              label: '3.1 线性相关与极大无关组',
              color: '#b98c08',
              description: '相关 = 挤在更低维；极大无关组 = 一组基',
              src: '/pages/math/linalg/dependence.html',
              content: {
                summary: '相关 = 挤在更低维；极大无关组 = 一组基',
                chain: {
                  problem: '一堆向量里到底有几个是多余的，需要可判定的标准',
                  solution: '拼成矩阵看 Ax=0 有无非零解；秩 = 极大无关组中向量个数',
                  newProblem: '判定容易，但求极大无关组与表示系数要回到行最简形（考点）',
                },
                tags: ["数学","线代","第三章"],
              },
            },
            {
              id: 'math-linalg-vector-orthogonal',
              label: '3.2 内积与施密特正交化',
              color: '#b98c08',
              description: '内积 → 模长 → 正交；施密特把基摆正',
              src: '/pages/math/linalg/orthogonal.html',
              content: {
                summary: '内积 → 模长 → 正交；施密特把基摆正',
                chain: {
                  problem: '只有线性无关还不够，需要一组互相垂直的基，坐标计算才简单',
                  solution: '内积定义模长与夹角；施密特逐次减去在已有方向上的投影；单位化得标准正交组',
                  newProblem: '施密特手算繁琐且对舍入敏感；正交矩阵的判定与构造是考点',
                },
                tags: ["数学","线代","第三章"],
              },
            },
            ],
          },
          {
            id: 'math-linalg-eq',
            label: '第4章 线性方程组',
            color: '#c89810',
            description: '三种情形看两个秩；无穷多解由基础解系描述',
            children: [
            {
              id: 'math-linalg-eq-structure',
              label: '4.1 解的存在性与结构',
              color: '#b98c08',
              description: '无解 / 唯一 / 无穷多：只看 r(A) 与 r(A,b)',
              src: '/pages/math/linalg/equations.html',
              content: {
                summary: '无解 / 唯一 / 无穷多：只看 r(A) 与 r(A,b)',
                chain: {
                  problem: '需要统一判据区分无解、唯一解、无穷多解，并描述无穷多解',
                  solution: '比较 r(A) 与 r(A,b) 及未知数个数 n；齐次求基础解系；非齐次 = 特解 + 齐次通解',
                  newProblem: '结构清楚但计算易错：自由变量个数 n−r、基础解系取法、特解选择',
                },
                tags: ["数学","线代","第四章"],
              },
            },
            ],
          },
          {
            id: 'math-linalg-eigen',
            label: '第5章 特征值',
            color: '#c89810',
            description: '方向不变的方向；对角化让矩阵退化成伸缩',
            children: [
            {
              id: 'math-linalg-eigen-diagonal',
              label: '5.1 特征值与相似对角化',
              color: '#b98c08',
              description: 'Ax=λx；|λE−A|=0 求 λ，P⁻¹AP=Λ',
              src: '/pages/math/linalg/eigen.html',
              content: {
                summary: 'Ax=λx；|λE−A|=0 求 λ，P⁻¹AP=Λ',
                chain: {
                  problem: '矩阵幂与矩阵函数难算，希望找一个坐标系让变换只有伸缩没有旋转',
                  solution: 'Ax=λx；|λE−A|=0 求特征值，(λE−A)x=0 求特征向量；P⁻¹AP=Λ',
                  newProblem: '不是所有矩阵可对角化（几何重数<代数重数）；重根内部还要施密特正交化',
                },
                tags: ["数学","线代","第五章"],
              },
            },
            ],
          },
          {
            id: 'math-linalg-quad',
            label: '第6章 二次型',
            color: '#c89810',
            description: '对称矩阵 + 换坐标：消交叉项、判正定',
            children: [
            {
              id: 'math-linalg-quad-form',
              label: '6.1 标准形与正定性',
              color: '#b98c08',
              description: 'xᵀAx；正交变换后系数就是特征值',
              src: '/pages/math/linalg/quadratic.html',
              content: {
                summary: 'xᵀAx；正交变换后系数就是特征值',
                chain: {
                  problem: '二次齐次多项式带交叉项，几何形状看不出，也判断不了正负',
                  solution: '写成 xᵀAx（A 对称）；正交变换 x=Qy 消交叉项，系数即特征值；惯性定理定 (p,q)',
                  newProblem: '正交变换要求特征向量正交，只有实对称矩阵保证；一般矩阵只能配方法/合同',
                },
                tags: ["数学","线代","第六章"],
              },
            },
            ],
          },
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
