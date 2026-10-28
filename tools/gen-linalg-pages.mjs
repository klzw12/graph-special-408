/**
 * 生成线代 9 个「视频 + 讲义」页
 * ================================
 * 为什么用生成器而不是手写 9 个 HTML：
 *   9 个页面结构相同，手写必然出现路径/样式/导航不一致（PITFALLS 里记录过这类事故）。
 *
 * 数据来源：
 *   - 要点、三问：从 408 仓库 manim 源码的旁白（AST 提取）+ 考研数学笔记归纳
 *   - 视频：已拷到 public/videos/linalg/
 *
 * 用法： node tools/gen-linalg-pages.mjs
 * 产物： public/pages/math/linalg/<id>.html
 *
 * 页面位于 public/pages/math/linalg/ 下 → 到 public/ 是 ../../../，
 * CSS 用 ../../../css/common.css，返回图谱用 ../../../（不写死 "/"，Pages 子路径下才不 404）。
 */

import fs from 'node:fs'
import path from 'node:path'

const OUT = 'public/pages/math/linalg'

const items = [
  {
    id: 'det-geometry',
    chapter: '第 1 章 行列式',
    title: '行列式的几何意义',
    en: 'Determinant as Area / Volume',
    video: '001_det-geometry.mp4',
    brief: '行列式不是运算技巧，而是一个「体积缩放倍数」——它回答：这个线性变换有没有把空间压扁。',
    chain: {
      problem: '要判断一个方阵对应的变换「是否可逆」，需要一个能从矩阵算出来的数作判据',
      solution: '用列向量张成的平行六面体体积（带符号）来定义；绝对值是体积，符号表示朝向是否翻转',
      newProblem: '几何定义算不出 4 阶以上（体积有多少个面），必须换成代数性质与降阶公式',
    },
    points: [
      '2 阶行列式绝对值 = 列向量张成的平行四边形面积；3 阶 = 平行六面体体积',
      '符号 = 朝向：交换两行 ⟺ 交换两个边向量 ⟺ 体积变号，但面积不变',
      '某行乘 $k$ ⟹ 行列式乘 $k$（一条边伸长 k 倍，体积按比例变）',
      '$|A| = 0$ ⟺ 图形退化（压成线/面）⟺ 列向量线性相关 ⟺ 不可逆',
    ],
    questions: [
      '单位正方形被 $\\begin{bmatrix}2&1\\\\0&3\\end{bmatrix}$ 映射成什么图形？面积是多少？',
      '为什么 $|A|=0$ 时一定不可逆？（用「压扁」解释，不许说「公式」）',
      '交换两行后，面积和面积的方向分别怎么样了？',
    ],
  },
  {
    id: 'det-calc',
    chapter: '第 1 章 行列式',
    title: '行列式的性质与计算',
    en: 'Properties & Computation',
    video: '002_det-calc.mp4',
    brief: '定义是 n! 项，4 阶就 24 项，考场不可行——所以真正要掌握的是三条性质和两条计算路线。',
    chain: {
      problem: '按定义要算 $n!$ 项（4 阶 24 项、5 阶 120 项），手算不可行',
      solution: '三条运算性质（交换变号、提公因子、倍加不变）+ 按行列展开降阶 + 化上三角',
      newProblem: '对高阶题化三角仍然慢，必须会「认形状」：行和相等、箭头型、三对角、范德蒙德',
    },
    points: [
      '余子式 $M_{ij}$ 划去第 $i$ 行第 $j$ 列；代数余子式 $A_{ij}=(-1)^{i+j}M_{ij}$',
      '展开定理 $|A|=\\sum_j a_{ij}A_{ij}$；异乘变零 $\\sum_k a_{jk}A_{ik}=0\\ (i\\ne j)$',
      '化上三角：倍加把主对角下方清零，值 = 主对角之积',
      '克拉默法则：$|A|\\ne 0$ 时 $x_i=|A_i|/|A|$；$|A|=0$ 法则失效，改用秩判别',
      '$|AB|=|A||B|$、$|kA|=k^n|A|$、$|A^{-1}|=1/|A|$、$|A^*|=|A|^{n-1}$',
    ],
    questions: [
      '4 阶行列式为什么不能用对角线法则？违反了定义里的哪一条？',
      '已知 $|A|=2$（3 阶），求 $|3A^*|$。',
      '什么形状的题应该先「全加第一列」而不是直接化三角？',
    ],
  },
  {
    id: 'matrix-inverse',
    chapter: '第 2 章 矩阵',
    title: '矩阵运算与逆矩阵',
    en: 'Matrix Algebra & Inverse',
    video: '003_matrix-inverse.mp4',
    brief: '矩阵是线性变换的写法；乘法的「行×列」规则其实是复合变换；逆矩阵就是反变换。',
    chain: {
      problem: '需要一个语言来描述「先做 B、再做 A」这种复合变换',
      solution: '矩阵乘法（行×列）= 复合，次序从右往左；逆矩阵 = 把变换还原回去',
      newProblem: '矩阵不能像数一样移项：$AB\\ne BA$、消去律失效、$AB=0$ 推不出 $A=0$',
    },
    points: [
      '$C_{ij}=\\sum_k A_{ik}B_{kj}$；$AB$ 表示「先作用 $B$，再作用 $A$」',
      '$AB\\ne BA$（一般）；结合律、分配律成立；**消去律失效**：$AB=0 \\nRightarrow A=0$',
      '可逆 $\\iff |A|\\ne 0 \\iff$ 满秩 $\\iff$ 变换不降维',
      '$(AB)^{-1}=B^{-1}A^{-1}$（次序反转）；$(A^{\\mathsf T})^{-1}=(A^{-1})^{\\mathsf T}$',
      '分块：块对角 $|A|=\\prod|A_i|$，$A^{-1}=\\mathrm{diag}(A_i^{-1})$；副对角块求逆要交换',
    ],
    questions: [
      '举两个非零矩阵，使 $AB=0$。这说明消去律为什么失效？',
      '为什么 $(AB)^{-1}$ 要「反过来」？用穿脱衣服解释一次。',
      '副对角分块 $\\begin{bmatrix}O&B\\\\C&O\\end{bmatrix}$ 的逆是什么？',
    ],
  },
  {
    id: 'rank',
    chapter: '第 2 章 矩阵',
    title: '矩阵的秩',
    en: 'Rank',
    video: '004_rank.mp4',
    brief: '秩 = 这个变换「保留了几维信息」。所有关于解、关于相关性的判断，最后都落到秩上。',
    chain: {
      problem: '需要一个数来量化「一个变换丢掉了多少维」',
      solution: '秩 = 行/列向量张成空间的维数 = 行阶梯形的非零行数',
      newProblem: '求出秩容易，但秩的证明（不等式、与 $A^{\\mathsf T}A$ 的关系）需要构造，考试常考',
    },
    points: [
      '三种口径：行秩 = 列秩 = 最高阶非零子式的阶数 = 极大无关组的大小',
      '初等变换不改秩；行变换 = 左乘初等矩阵，列变换 = 右乘',
      '$r(A+B)\\le r(A)+r(B)$；$r(AB)\\le\\min\\{r(A),r(B)\\}$；乘可逆阵不改秩',
      '$r(A^{\\mathsf T}A)=r(A)$；$AX=b$ 有解 $\\iff r(A)=r(A,b)$',
      '方阵满秩 $\\iff |A|\\ne 0\\iff$ 可逆 $\\iff Ax=0$ 只有零解',
    ],
    questions: [
      '$4\\times 3$ 矩阵的秩最大是几？为什么不是 4？',
      '已知 $r(A)=2$，能否断定 $A$ 的任意两行线性无关？给出反例或说明。',
      '为什么 $x\\to Ax$ 的像空间维数等于 $r(A)$？',
    ],
  },
  {
    id: 'dependence',
    chapter: '第 3 章 向量组',
    title: '线性相关与极大无关组',
    en: 'Linear Dependence & Maximal Independent Set',
    video: '005_dependence.mp4',
    brief: '相关的本质是「挤在更低维的空间里」；极大无关组就是这个空间的一组基。',
    chain: {
      problem: '一堆向量里到底有几个是「多余的」，需要一个可判定的标准',
      solution: '拼成矩阵看 $Ax=0$ 有无非零解；秩 = 极大无关组中向量的个数',
      newProblem: '判定容易，但「求出极大无关组、并写出其余向量的表示系数」要回到行最简形，是考点',
    },
    points: [
      '线性相关 = 存在不全为零的系数使组合为零；无关 = 只有零系数',
      '向量个数 **多于** 维数时必线性相关；个数少于维数时可能无关也可能相关',
      '方阵：无关 $\\iff |A|\\ne 0\\iff r(A)=n$',
      '极大无关组不唯一，但**所含向量个数唯一**，等于 $r(A)$',
      '求法：拼成矩阵 → 只做初等**行**变换化行最简形 → **主元所在列**对应的原向量构成极大无关组',
    ],
    questions: [
      '为什么「个数多于维数必相关」，而「个数少于维数」就不能断定？',
      '极大无关组不唯一——那什么是不变的？',
      '把向量组拼成矩阵后，为什么只能做行变换、不能做列变换？',
    ],
  },
  {
    id: 'equations',
    chapter: '第 4 章 线性方程组',
    title: '解的存在性与解的结构',
    en: 'Linear Systems',
    video: '006_equations.mp4',
    brief: '三种情形（无解/唯一/无穷多）只看两个秩；无穷多解的样子由「基础解系」决定。',
    chain: {
      problem: '需要一个统一的判据区分「无解、唯一解、无穷多解」，并描述无穷多解',
      solution: '比较 $r(A)$ 与 $r(A,b)$ 及未知数个数 $n$；齐次组求基础解系；非齐次 = 特解 + 齐次通解',
      newProblem: '结构清楚但计算易错：自由变量个数 $n-r$、基础解系的取法、特解的选择',
    },
    points: [
      '$r(A)\\ne r(A,b)$ 无解；$=n$ 唯一解；$=r<n$ 无穷多解（自由变量 $n-r$ 个）',
      '齐次组解空间维数 $=n-r$，基础解系就是它的基',
      '非齐次通解 = 特解 $\\eta_0$ + 齐次通解；任意两个特解之差是齐次解',
      '求基础解系：化行最简形 → 自由变量轮流取 $1$、其余取 $0$',
      '齐次组：$|A|\\ne 0$ 只有零解；有非零解 $\\iff |A|=0$',
    ],
    questions: [
      '为什么「两个特解之差」一定是齐次组的解？',
      '自由变量为什么恰好是 $n-r$ 个？',
      '基础解系里的向量为什么必须线性无关？',
    ],
  },
  {
    id: 'eigen',
    chapter: '第 5 章 特征值',
    title: '特征值与相似对角化',
    en: 'Eigenvalues & Diagonalization',
    video: '007_eigen.mp4',
    brief: '特征方向是「变换不转向」的方向；沿这些方向，矩阵退化成一次数乘。',
    chain: {
      problem: '矩阵幂、矩阵函数难算；希望能找一个坐标系，让变换只有伸缩没有旋转',
      solution: '$Ax=\\lambda x$；$|\\lambda E-A|=0$ 求 $\\lambda$，$(\\lambda E-A)x=0$ 求向量；$P^{-1}AP=\\Lambda$',
      newProblem: '不是所有矩阵都能对角化（几何重数 < 代数重数时不行）；重根内部还要施密特正交化',
    },
    points: [
      '$|A|=\\prod\\lambda_i$，$\\mathrm{tr}(A)=\\sum\\lambda_i$',
      '不同特征值对应的特征向量必线性无关',
      '可对角化 $\\iff$ 有 $n$ 个线性无关的特征向量 $\\iff$ 每个 $\\lambda$ 的几何重数 = 代数重数',
      '实对称矩阵：特征值全实、不同 $\\lambda$ 的特征向量正交、必可正交对角化',
      '易错：同重根内部不天然正交，必须自己做施密特',
    ],
    questions: [
      '为什么特征向量必须「非零」？零向量会出什么问题？',
      '$A$ 有 3 个不同特征值（3 阶），能否断定可对角化？为什么？',
      '已知 $|A|=6$、$\\mathrm{tr}(A)=6$，特征值是 $1,2,3$ 吗？还缺什么信息？',
    ],
  },
  {
    id: 'quadratic',
    chapter: '第 6 章 二次型',
    title: '二次型、标准形与正定性',
    en: 'Quadratic Forms',
    video: '008_quadratic.mp4',
    brief: '二次型就是「对称矩阵 + 一个坐标系」：换个正交坐标，交叉项消失，形状一眼可见。',
    chain: {
      problem: '二次齐次多项式带交叉项，几何形状看不出来，也判断不了正负',
      solution: '写成 $x^{\\mathsf T}Ax$（$A$ 对称）；正交变换 $x=Qy$ 消交叉项，系数就是特征值',
      newProblem: '正交变换要求特征向量正交，只有实对称矩阵保证；一般矩阵只能配方法/合同变换',
    },
    points: [
      '交叉项系数要**均分**到对称的两个位置（$2bxy \\to b$ 与 $b$）',
      '标准形系数 = 特征值；惯性定理：正负平方项个数 $(p,q)$ 唯一',
      '$p$ = 正特征值个数（正惯性指数），与用什么变换无关',
      '正定三判据：特征值全正 / **各阶**顺序主子式全正 / 存在可逆 $C$ 使 $A=C^{\\mathsf T}C$',
      '等价保秩、相似保特征值、合同保惯性（正定性）',
    ],
    questions: [
      '为什么正定要求「各阶」顺序主子式全正，只验二阶够不够？举例。',
      '合同变换保持什么？相似变换保持什么？两者为什么不同？',
      '二次型 $f=2x_1x_2$ 的矩阵是什么？它的正负惯性指数各是多少？',
    ],
  },
  {
    id: 'orthogonal',
    chapter: '第 3 章 向量组',
    title: '内积与施密特正交化',
    en: 'Inner Product & Gram–Schmidt',
    video: '009_orthogonal.mp4',
    brief: '内积给向量带来「长度和夹角」；施密特把一组无关向量摆正，正交矩阵让求逆变成转置。',
    chain: {
      problem: '只有线性无关还不够，需要一组「互相垂直」的基，才能让坐标计算变简单',
      solution: '内积 → 模长 → 正交；施密特逐次减去在已有方向上的投影；单位化得标准正交组',
      newProblem: '施密特手算繁琐且对舍入敏感；正交矩阵的判定（$A^{\\mathsf T}A=E$）与构造是考点',
    },
    points: [
      '内积三性质：对称、线性、正定；$\\|\\alpha\\|=\\sqrt{(\\alpha,\\alpha)}$',
      '$\\alpha\\perp\\beta \\iff (\\alpha,\\beta)=0$；非零正交组必线性无关',
      '$\\beta_k=\\alpha_k-\\sum_{i<k}\\frac{(\\alpha_k,\\beta_i)}{(\\beta_i,\\beta_i)}\\beta_i$',
      '正交化不改变张成的空间；单位化后得标准正交组',
      '正交矩阵：$A^{\\mathsf T}A=AA^{\\mathsf T}=E$，$A^{-1}=A^{\\mathsf T}$，$|A|=\\pm 1$',
    ],
    questions: [
      '为什么「非零 + 两两正交」就能推出「线性无关」？',
      '施密特过程里为什么要除以 $(\\beta_i,\\beta_i)$ 而不是 $\\|\\beta_i\\|$？',
      '正交矩阵的行列式为什么只能是 $\\pm 1$？',
    ],
  },
]

const page = (it, prev, next) => `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${it.title} — 考研知识图谱</title>
  <link rel="stylesheet" href="../../../vendor/katex/katex.min.css" />
  <script defer src="../../../vendor/katex/katex.min.js"></script>
  <script defer src="../../../vendor/katex/auto-render.min.js"></script>
  <link rel="stylesheet" href="../../../css/common.css" />
  <style>
    .title-area .bar { background:#eab308; }
    .aside-col .callout { border-left-color:#eab308; }
    .aside-col .callout strong { color:#eab308; }
    .video-wrap { margin: 18px 0 26px; border-radius: 10px; overflow: hidden;
                  border: 1px solid rgba(255,255,255,.12); background:#000; }
    .video-wrap video { display:block; width:100%; height:auto; }
    .chain { display:grid; gap:10px; margin:12px 0 4px; }
    .chain .step { border-left:3px solid rgba(255,255,255,.18); padding:6px 12px; }
    .chain .step b { color:#eab308; }
    .pager { display:flex; justify-content:space-between; margin:34px 0 10px; font-size:14px; }
    .pager a { color:#9ad; text-decoration:none; }
  </style>
</head>
<body>
  <a class="back-link" href="../../../">← 🕸️ 返回图谱</a>

  <div class="page">
    <div class="title-area">
      <h1>${it.title}<span class="en">${it.en}</span></h1>
      <div class="bar" style="background:#eab308"></div>
      <p class="brief">${it.brief}</p>
    </div>

    <div class="layout">
      <nav class="nav-col">
        <div class="nav-title">目录</div>
        <a href="#video">🎬 视频</a>
        <a href="#chain">🔗 因果链</a>
        <a href="#points">📌 要点</a>
        <a href="#check">✅ 自检</a>
      </nav>

      <main class="main-col">
        <section id="video">
          <h2>🎬 本节视频（${it.chapter}）</h2>
          <div class="video-wrap">
            <video controls preload="metadata" playsinline src="../../../videos/linalg/${it.video}"></video>
          </div>
        </section>

        <section id="chain">
          <h2>🔗 因果链（为什么必须有它）</h2>
          <div class="chain">
            <div class="step"><b>问题</b>：${it.chain.problem}</div>
            <div class="step"><b>方案</b>：${it.chain.solution}</div>
            <div class="step"><b>新问题</b>：${it.chain.newProblem}</div>
          </div>
        </section>

        <section id="points">
          <h2>📌 要点</h2>
          <ul>
${it.points.map((p) => `            <li>${p}</li>`).join('\n')}
          </ul>
        </section>

        <section id="check">
          <h2>✅ 自检三问（答不出就别往下走）</h2>
          <ol>
${it.questions.map((q) => `            <li>${q}</li>`).join('\n')}
          </ol>
        </section>
      </main>

      <aside class="aside-col">
        <div class="aside-title">着重注意</div>
        <div class="callout">
          <strong>💡 一句话</strong>
          ${it.brief}
        </div>
        <div class="callout warn">
          <strong>⚠️ 易错</strong>
          ${it.chain.newProblem}
        </div>
      </aside>
    </div>

    <div class="pager">
      <span>${prev ? `<a href="./${prev.id}.html">← ${prev.title}</a>` : ''}</span>
      <span>${next ? `<a href="./${next.id}.html">${next.title} →</a>` : ''}</span>
    </div>

    <div class="footer">考研知识图谱 · 数学 · 线性代数 · ${it.title}</div>
  </div>

  <script>
    document.addEventListener('DOMContentLoaded', function () {
      if (typeof renderMathInElement === 'function')
        renderMathInElement(document.body, {delimiters:[{left:'$$',right:'$$',display:true},{left:'$',right:'$',display:false}]});
    });
  </script>
</body>
</html>
`

fs.mkdirSync(OUT, { recursive: true })
items.forEach((it, i) => {
  const html = page(it, items[i - 1], items[i + 1])
  fs.writeFileSync(path.join(OUT, `${it.id}.html`), html, 'utf8')
  console.log(`写出 ${OUT}/${it.id}.html`)
})

console.log(`\n共 ${items.length} 页`)
