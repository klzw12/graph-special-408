/**
 * 🕸️ Knowledge Graph 数据入口
 * ============================
 * 
 * 数据已按领域拆分到 src/domains/ 目录下：
 *   domains/
 *   ├── index.js         ← 自动合并所有领域
 *   ├── ml.js            ← 机器学习
 *   ├── dl.js            ← 深度学习
 *   ├── rl.js            ← 强化学习
 *   ├── nlp.js           ← 自然语言处理
 *   ├── cv.js            ← 计算机视觉
 *   ├── foundation.js    ← 数学基础
 *   ├── tools.js         ← 工具与语言
 *   └── systems.js       ← 推荐系统 & 知识图谱
 * 
 * 📝 新增领域：
 *   1. 在 domains/ 下新建文件，导出 root + relations
 *   2. 在 domains/index.js 里 import + 加入 domains 数组
 *   搞定！
 */

export { graphData } from './domains/index.js'
