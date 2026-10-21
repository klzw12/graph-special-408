# 🕳️ 3D 知识图谱 · 架构与踩坑笔记

> **来源**：`knowledge-graph-3d` / `knowledge-graph-408` 两个项目的实战经验汇总
> （出自 Hermes 技能库 `threejs-3d-graph`）。
> **给谁看**：本项目后续接手的人 / AI harness。
> **怎么用**：先扫下面「⚡ 五条最要命」和「🧪 改完必做的验证」，再按需往下查长文档。

> ⚠️ 文中提到 `references/xxx.md` 的地方，是原技能库里的配套文件，本项目未必有 —— 按需自行补齐或忽略。

---

## ⚖️ 适用性声明（先看这条，很重要）

**本文档里有几条原则是有适用前提的，别整段照搬。**

- **「Chapter / syllabus nodes ❌ 不属于图」「one concept = one node, never one chapter = one node」**
  —— 这条只管 **跨域联想图**（目的是「概念之间能连线」）。
  如果项目目的是 **「按考纲把因果讲通」**（骨架本身就有意义），
  **结论正好反过来：骨架就该是章节。**
  目的不同 → 规则翻转，**不是谁对谁错**。
- 本文也明确写了：**「408 四门课 → 更适合另开一个图」**
  —— 所以「408 独立成图」本来就是它的建议，不是它反对的事。
- 下面所有 **渲染层 / 性能 / 交互** 的坑
  （fitToGraph、flyTo、InstancedMesh、d3-force-3d、CameraController…）
  是 **与目的无关的硬经验**，可以放心照搬。

---

## ⚡ 五条最要命（先看这个）

**1. 初始视野必须看得见全图**

force layout 跑完一定要调 `fitToGraph(nodes)`，**不要硬编码相机距离**。
用户最常抱怨的就是「只能看到一个节点，得靠搜索才能找到别的」。

**2. flyTo 不能按「当前距离的比例」缩**

```js
// ❌ 点三次就贴脸上了
const dist = currentPos.distanceTo(target) * 0.4

// ✅ 用「焦点节点 + 它的一跳邻居」的包围盒算距离，保持当前 theta/phi 不转
```

否则点几下之后用户只看得到一个球，还以为「图里就一个节点」。

**3. 相机四参数必须联动改**

`maxRadius` / `camera.far` / `fog` / 星空范围 —— 只改一个会出怪象：
视野被悄悄截断、远处被裁掉、星星变空、边缘糊成一片。
典型事故：`fitToGraph` 算出 83，`maxRadius` 却是 50 → 你只看到 60% 的图，
而且**没有任何报错**。

**4. d3-force-3d 会改写 link 对象**

`sim.tick()` 之后 `link.source` / `link.target` 变成**节点对象引用**（不是索引），
而且只改你传给 `forceLink()` 的那个数组。记得把引用**拷回** `edges`，
否则后面 `edge.source.x` 直接崩。

**5. CameraController 的 `onXxx` 公开方法漏写 = 整页白屏**

内部有 `_onDblClick`，就必须有公开的 `onDblClick(cb)`。
少一个 → `main.js` 里调用时抛 `TypeError` → **后面所有初始化代码全不执行**，
画布空白，只剩 DOM 标题和搜索框。

---

## 🧪 改完必做的验证

```bash
node -c src/*.js          # 语法检查（patch 之后尤其要跑）
npm run dev               # 打开浏览器看 console
```

浏览器 console 里应该能看到类似：

```
🕸️ 已加载 N 个大类, 共 M 个节点, K 条交叉关联
```

`M` 不对 = 数据没加载全；有 `ReferenceError` = 模块少 import 了 THREE 之类；
**画布空白但 DOM 还在** = 多半是第 5 条。

---

Patterns for building interactive 3D node-link graphs with Three.js, covering both tree layouts and force-directed graphs.

## Architecture Comparison (Individual vs Batch Rendering)

### ❌ Naive approach (what we started with)
Each node = individual `SphereGeometry` + `Mesh` → `scene.add(mesh)`. Each edge = individual `Line` + `QuadraticBezierCurve3`.
- **Problem**: N draw calls for N nodes, becomes a bottleneck at 200+ nodes
- **Problem**: CSS2DRenderer labels don't scale to hundreds
- **Acceptable for**: <100 nodes, tree-only layouts

### ✅ Performance approach (MeetBlog pattern)
- **Nodes**: Single `InstancedMesh` — all positions via `setMatrixAt()`, colors via `setColorAt()`
- **Edges**: Single `BufferGeometry` with vertex colors — all edge segments in one draw call
- **Glow/Lighting**: `UnrealBloomPass` postprocessing instead of per-node glow meshes
- **Labels**: Only for focused/selected nodes, not always-on

## Layout Strategies

### Tree Layout (manual)
See `~/knowledge-graph-3d/src/Graph3D.js` for the radial tree implementation:
- Root at center, children radiate outward by depth
- `_layoutTree()` computes positions level by level
- Pros: deterministic, no convergence needed
- Cons: dense at deep levels, no cross-edge influence on layout

### Force-Directed (d3-force-3d)
Package: `d3-force-3d` (not `d3-force`, which is 2D only)

```js
import { forceSimulation, forceLink, forceManyBody, forceCenter } from 'd3-force-3d'

const sim = forceSimulation(nodes, 3)
  .force('link', forceLink(edges).id(d => d.id).distance(55).strength(0.25))
  .force('charge', forceManyBody().strength(-180).theta(0.9))
  .force('center', forceCenter(0, 0, 0))
  .alphaDecay(0.06)
  .stop()

// Tick manually in batches
for (let i = 0; i < 120; i++) sim.tick()
```

- Pros: organic layout, auto-handles cross edges, good for dense graphs
- Cons: non-deterministic, needs tuning (charge strength, link distance, alpha decay)

## Rendering Pipeline

### InstancedMesh — Node Setup

#### Material choice: MeshBasicMaterial vs MeshPhysicalMaterial

| Use case | Material | Why |
|----------|----------|-----|
| Dark background, nodes must POP | `MeshBasicMaterial` | No lighting calc, instanceColor outputs directly. With Bloom, nodes look like glowing dots. |
| Natural lighting, 3D depth | `MeshPhysicalMaterial` | Needs lights, shows shading. More realistic but nodes can look dim on dark backgrounds. |

**For dark-theme graphs** (black/dark-blue background), always prefer `MeshBasicMaterial`. The `MeshPhysicalMaterial` with emissive is the second best option, but you'll need high emissive intensity and strong bloom to match the same punch.

```js
// ✅ For dark theme — nodes glow at full color regardless of lighting
const mat = new THREE.MeshBasicMaterial()

// ⚠️ Alternative with physical material (needs stronger lighting + bloom)
const mat = new THREE.MeshPhysicalMaterial({
  color,
  emissive: color,
  emissiveIntensity: 0.15,
  metalness: 0.2, roughness: 0.3,
})
```

**Node size scaling**: For graphs viewed from a distance (fitToGraph overview), increase base sizes significantly. The difference between "can barely see anything" and "see all nodes clearly" is often just 2× radius:

```js
// For graph overview visibility (>50 nodes expected, viewed from OG-fit distance)
const BASE_RADIUS = 0.8    // was 0.35 — too small for overview
const LEAF_RADIUS = 0.55   // was 0.25 — invisible at overview distance
```

**Tuning heuristic**: Load the graph, zoom to fitToGraph overview. If nodes look like faint dots, double the base radius. If they look like properly visible colored spheres, halve it. The goal is "noticeable at a glance" — users should see the graph structure without squinting.

**Bloom parameter tuning**: Three knobs that interact. For dark themes with MeshBasicMaterial, aim for soft halos that make nodes pop without washing out fine detail:

```js
const bloomPass = new UnrealBloomPass(
  size,
  0.3,      // strength — how intense the glow is. 0.3 = subtle, 0.6 = strong
  0.5,      // radius — how far glow spreads from bright pixels. 0.3-0.5 good
  0.1       // threshold — minimum brightness that triggers bloom. 0.1 = most things glow, 0.3 = only brights
)
```

For dark themes with MeshBasicMaterial, start with `strength=0.6, radius=0.4, threshold=0.05` — everything will have a soft glow halo.

```js
const geo = new THREE.SphereGeometry(radius, 20, 20)
const mat = new THREE.MeshBasicMaterial()
const mesh = new THREE.InstancedMesh(geo, mat, nodeCount)
mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
mesh.instanceColor = new THREE.InstancedBufferAttribute(colors, 3)

// Per-node update:
const dummy = new THREE.Object3D()
for (let i = 0; i < nodes.length; i++) {
  dummy.position.set(nodes[i].x, nodes[i].y, nodes[i].z)
  dummy.scale.setScalar(size)
  dummy.updateMatrix()
  mesh.setMatrixAt(i, dummy.matrix)
  mesh.setColorAt(i, new THREE.Color(hexColor))
}
mesh.instanceMatrix.needsUpdate = true
mesh.instanceColor.needsUpdate = true
```

### Edges — Batch BufferGeometry
```js
const positions = []
const colors = []
edges.forEach(e => {
  const s = nodes[e.source], t = nodes[e.target]
  // 2 points per edge
  positions.push(s.x, s.y, s.z, t.x, t.y, t.z)
  colors.push(r1, g1, b1, r2, g2, b2)
})
const geo = new THREE.BufferGeometry()
geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
const mat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true })
const line = new THREE.LineSegments(geo, mat)
```

## Interactive Details

### Camera — Custom Spherical Orbit
Use `THREE.Spherical` for camera position: `radius, phi, theta`. Lerp between current and target for smooth animation. Idle auto-orbit: increment `theta += dt * 0.06`, reset timer on user interaction. FlyTo: Tween camera position + lookAt target simultaneously.

#### ⚠️ Pitfall: flyTo proportional zoom death

**Never** make flyTo distance proportional to current camera distance.

```js
// ❌ WRONG — each click halves the distance, 3 clicks = eyeball on node
const dist = currentPos.distanceTo(target) * 0.4
flyEnd.radius = dist

// ✅ CORRECT — fixed distance based on graph bounds
const baseRadius = Math.min(15, Math.max(6, graphRadius * 0.35))
flyEnd.radius = baseRadius
```

Proportional zoom creates a death spiral: user clicks node, camera moves closer. User clicks another node, camera moves EVEN CLOSER. After 3-4 clicks, camera is <1 unit from the node and the user can only see one sphere. They can't intuitively recover without explicit "reset to full view" action.

**Fix**: Compute flyTo distance as a function of the entire graph's bounding box, not the current camera position.

#### ✅ Refined fix (2026-09): flyToBounds — frame the node's *neighborhood*, not a fixed distance

The fixed-distance rule (min 6 / max 15 above) still feels wrong on dense graphs: click a leaf whose 1-hop neighborhood spans 40 units and the camera lands too close to see the context. Best practice from the `knowledge-graph-408` implementation: **compute a Box3 over the focused node + its direct neighbors, and set the flight distance from THAT bounding box** (keeps current theta/phi so the view doesn't spin):

```js
flyToBounds(nodes, padding = 0.45, callback) {
  const box = new THREE.Box3()
  for (const n of nodes) box.expandByPoint(new THREE.Vector3(n.x, n.y, n.z))
  const size = box.getSize(new THREE.Vector3())
  const center = box.getCenter(new THREE.Vector3())
  const maxDim = Math.max(size.x, size.y, size.z)
  const fov = camera.fov * Math.PI / 180
  let radius = (maxDim / 2) / Math.tan(fov / 2) * (1 + padding)
  radius = Math.max(minRadius * 2, Math.min(maxRadius, radius))  // floor: don't kiss the node
  // fly centerStart→center, radius→radius; KEEP this.spherical.theta/phi unchanged
}
```

Click handler pairs this with a `focusNode(idx)` that highlights node + 1-hop neighbors (walk the edge list collecting `source.id===id || target.id===id`), returns `{node, nodes, highlightedIds}`, and only dims everything outside that set. One click = "show me this concept and its immediate context".

#### Design: fitToGraph — Auto-framing on load

After the force layout completes and nodes have final positions, compute the bounding box and set the camera to show the entire graph:

```js
fitToGraph(nodes, padding = 1.2) {      // ← 1.2 = generous padding for overview
  const box = new THREE.Box3()
  for (const n of nodes) box.expandByPoint(new THREE.Vector3(n.x, n.y, n.z))
  const size = box.getSize(new THREE.Vector3())
  const center = box.getCenter(new THREE.Vector3())
  const maxDim = Math.max(size.x, size.y, size.z)
  const fov = camera.fov * Math.PI / 180
  const radius = (maxDim / 2) / Math.tan(fov / 2) * (1 + padding)
  this.spherical.radius = radius
  this.spherical.phi = PI_2 * 0.7
  this.spherical.theta = -0.5
  this.orbitCenter.copy(center)
}
```

#### Design: Right-click / ESC reset to full view

Users get disoriented after flyTo zoom-ins. Provide two escape hatches:

- **Right-click**: Immediate reset to full graph view (no selection change)
- **ESC**: Reset selection + clear search + reset to full view

```js
domElement.addEventListener('contextmenu', (e) => {
  e.preventDefault()
  resetFullView()
})

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    graph.selectNode(-1)
    panel.hide()
    searchUI.clearSearch()
    camCtrl.resetFullView()
  }
})
```

### Hover Detection on InstancedMesh
Raycaster works with `InstancedMesh` — `intersectObject()` returns `instanceId`:
```js
const hits = raycaster.intersectObject(mesh)
if (hits.length > 0) {
  const idx = hits[0].instanceId  // → nodes[idx]
}
```

### Highlight States
Use `setColorAt()` / `setMatrixAt()` with scale multiplier for hover/select — no need to create new materials per state.

## Curved Edges with Batch Rendering (Bezier Baking)

Instead of per-edge `THREE.Line` + `QuadraticBezierCurve3` objects, bake curved edges into a single `LineSegments` buffer by subdividing each edge into segments:

```js
const SEGMENTS_PER_EDGE = 6

function bakeCurvedEdges(edges, nodes) {
  const positions = new Float32Array(edges.length * SEGMENTS_PER_EDGE * 6)
  const colors = new Float32Array(edges.length * SEGMENTS_PER_EDGE * 6)
  
  edges.forEach((e, i) => {
    const s = nodes[e.source], t = nodes[e.target]
    // Midpoint with perpendicular lift for arc
    const mx = (s.x + t.x) / 2, dx = t.x - s.x, dy = t.y - s.y, dz = t.z - s.z
    const len = Math.sqrt(dx*dx + dy*dy + dz*dz) || 1
    const lift = len * 0.18
    const bx = mx + (-dz / len) * lift, by = my + dy * 0.04, bz = mz + (dx / len) * lift
    
    for (let seg = 0; seg < SEGMENTS_PER_EDGE; seg++) {
      const t0 = seg / SEGMENTS_PER_EDGE, t1 = (seg + 1) / SEGMENTS_PER_EDGE
      const T = 1 - t0
      // Quadratic bezier: (1-t)²·s + 2t(1-t)·c + t²·t
      // Colors interpolated between source and target
    }
  })
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  return new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ vertexColors: true }))
}
```

**Trade-off**: More vertices (6×) than straight lines, but still 1 draw call vs N. Good for <5000 edges.

## Force Simulation Parameter Tuning Guide

| Parameter | Effect | Typical Range | Notes |
|-----------|--------|---------------|-------|
| `link.distance` | Edge resting length | 30-100 | Smaller = tighter clusters |
| `link.strength` | Edge spring tension | 0.1-0.5 | Higher = more rigid structure |
| `charge.strength` | Node repulsion | -500 to -50 | More negative = more spread out |
| `charge.theta` | Barnes-Hut approx | 0.8-1.0 | Lower = more accurate but slower |
| `alphaDecay` | Convergence speed | 0.02-0.1 | Higher = faster settle but less exploration |
| `velocityDecay` | Damping | 0.2-0.4 | Higher = less oscillation |

For knowledge graphs (hundreds to low thousands of nodes), start with: `distance=55, strength=0.25, charge=-180, theta=0.9, alphaDecay=0.06`.

**Compact variant** (for smaller graphs where nodes should stay tightly grouped): `distance=25, strength=0.4, charge=-60, alphaDecay=0.1`. This produces a tighter cluster where all nodes are visible at once without scrolling/zooming.

## Node Granularity Rule: When to Create Children

Not every book/section needs child nodes in the 3D graph. The graph is a **navigation aid**, not a full TOC mirror. Two-tier test:

| Level | Create children? | Example |
|-------|----------------|---------|
| Each section has **genuine independent depth** | ✅ Yes | 孙子兵法13篇 (each chapter has distinct strategy framework) |
| All sections are **anchor-jumps within one page**, content is brief/shallow | ❌ No | 墨菲定律34节 (all on `murphy.html`, just `#anchors`) |

### Concrete failure signal

When 主公 said: "没必要搞节点出来，因为34乃至38都是在一个页面" — this is the signal. If all children point to the same HTML page with anchor links and the content is brief, just keep the book node.

### Asking the user vs searching online

When you don't know section/chapter names for a book the user is reading, **ask the user directly** rather than spending time searching the browser. 主公 confirmed: "这些小众的你去浏览器不如直接问我" — the user has the physical book in hand; scraping Chinese sites for obscure TOC data is inefficient and often blocked by CAPTCHAs.

### Pre-push consistency check

Before pushing any structural change (adding/removing nodes, renaming, re-categorizing), **always check if the same issue exists elsewhere in the project**:

```bash
# Before git push, scan for similar patterns
grep -E "children:\s*\[" src/domains/*.js src/domains/**/*.js
```

主公 confirmed this rule: "不要push，先看看其他的是否有同样问题" — the first action when fixing a structural issue is to audit the entire project for the same pattern, then push all fixes in one commit.

When to check:
- Adding child nodes to a book → does the same pattern exist for other books?
- Renaming/removing a node → are there stale references elsewhere?
- Changing a convention (like `children` vs no-children) → is the whole project consistent?

## What Belongs in the Graph — Concept-Oriented Design Principle

The knowledge graph is a tool for **inter-domain thinking and connection**, not a syllabus tracker. Two distinct types of content exist:

| Type | Belongs in graph? | Reasoning |
|------|:-----------------:|-----------|
| **Concept nodes** — standalone ideas with cross-domain connections | ✅ Yes | 行列式↔特征值, 辩证法↔道德经, 伯努利概型↔分类问题 — these generate meaningful edges |
| **Chapter/syllabus nodes** — exam chapter markers, textbook section listings | ❌ No | "计组第一章", "政治毛中特第九章" — these are curriculum artifacts, not knowledge concepts |

### Litmus test for any proposed node

Ask: **"Can this node form at least one meaningful cross-domain or within-domain edge?"**

- If the only edges it would have are `→下一章` or `→上一节`, it's a syllabus node → **don't add**
- If it connects to other concepts via logical relationships (depends on, extends, contrasts with) → **add as a concept node**

### What to do with exam content (408, 考研数学, 考研政治)

Content that IS genuinely conceptual (马原: 唯物论/辩证法/剩余价值) should be added as **individual concept nodes** with their own logical chain edges, not as "马原第一章" chapter nodes.

Content that is purely exam-oriented with few cross-domain connections (408四门课, 考研数学解题技巧) is better served by:
- A **separate 3D knowledge graph** (different entry point, same codebase)
- Or a **non-graph tool** (brain map, knowledge tree,刷题 tracker)

The core principle: one concept = one node. Never one chapter = one node.

## Domain-Colored Edges (中央色彩配置文件模式)

### Motivation

Source→target color gradient looks pretty but doesn't help the viewer **visually segment** the graph into domains. With domain-colored edges, all edges belonging to the same domain share one color, letting users instantly see which nodes belong to which group even when zoomed out.

### Architecture

Three parts work together:

```
domain-colors.js  ← ① Central color config
parseTree()      ← ② Annotate each node with its _parentDomain
_buildEdges()    ← ③ Use domain color instead of gradient
```

### ① Central Color Config (`src/domains/domain-colors.js`)

```js
export const DOMAIN_COLORS = {
  ai:         '#ff6b6b',    // 人工智能 — red
  ml:         '#ffaa3a',    // 机器学习 — orange
  dl:         '#a855f7',    // 深度学习 — purple
  rl:         '#22c55e',    // 强化学习 — green
  nlp:        '#06b6d4',    // 自然语言处理 — cyan
  cv:         '#f97316',    // 计算机视觉 — orange
  systems:    '#ec4899',    // 推荐系统 — pink
  math:       '#eab308',    // 数学基础 — yellow (was 'foundation')
  languages:  '#8b5cf6',    // 语言与框架 — violet (was 'tools')
}
```

**Convention**: Keys are domain `id`s (depth-2 in the tree). Colors should be perceptually distinct — avoid two similar hues next to each other.

### ② Node Domain Annotation (in `parseTree`)

During tree flattening, each node records its domain (the first ancestor whose `id` exists in `DOMAIN_COLORS`):

```js
function parseTree(data) {
  const walk = (node, parentId, depth, parentDomain) => {
    const nd = { ...node }
    nd._parentDomain = DOMAIN_COLORS[node.id]
      ? node.id          // This IS a domain node (depth 2)
      : parentDomain     // Children inherit parent's domain
    // ...rest of parsing
  }
  walk(data.root, null, 0, null)
}
```

This produces `node._parentDomain` for every node, which the edge renderer consumes.

### ③ Edge Rendering with Domain Color

Replace source→target gradient with a single domain color:

```js
// In _buildEdges(), for each edge:
const domain = src._parentDomain || dst._parentDomain || 'tools'
const domainColor = new THREE.Color(DOMAIN_COLORS[domain] || '#8888aa')

// Write domainColor.r/g/b to ALL segments of this edge (no gradient)
for (let seg = 0; seg < SEGMENTS_PER_EDGE; seg++) {
  colors[vi + 0] = domainColor.r
  colors[vi + 1] = domainColor.g
  colors[vi + 2] = domainColor.b
  // Same color for both endpoints of each segment
}
```

**Edge highlight interaction**: When a node is selected/hovered, connected edges should still use domain color but at increased brightness (×1.5-2) rather than changing hue.

### Visual Result

At overview zoom level, you see colored "neighborhoods":
- 🔴 Red web = AI domain
- 🟡 Yellow web = Math foundation  
- 🟣 Violet web = Tools

Users can immediately spot which parts of the graph are densely connected within a domain vs. cross-domain bridges (which stand out as different-colored edges between color zones).

### When NOT to use domain coloring

- If edges represent many different relationship types (not just "belongs to same domain")
- If individual edge meaning (e.g., "depends on", "influences") is more important than group identity
- For <10 nodes total — gradient or single color is fine

## Color & Size Systems

Instead of hardcoded colors, map node visual properties from data attributes:
- **Color**: gradient based on degree/importance percentile + per-node hash jitter for variation
- **Size**: power function `base + pow(degree / maxDegree, gamma) * range` — gamma < 1 amplifies small differences

See `references/meetblog-architecture.md` for the exact gradient implementation with 6 stops.

## Practical Implementation Pitfalls

### `patch` Tool: Multi-Line Replacement Syntax Risk

When patching JS data files with multi-line replacements using the `patch` tool, the fuzzy matching can misalign indentation, creating syntax errors. Always run `node -c <file>` after patching JS files.

### d3-force-3d: Link Reference Resolution

**Critical**: After `simulation.tick()`, d3-force modifies link objects in-place — `link.source` and `link.target` become **node object references** instead of the original indices. But only the objects passed to `forceLink()` get modified, NOT the original edges array.

```js
// ❌ WRONG: linkData is a SEPARATE array from edges
const linkData = edges.map(e => ({ source: idxOf(e.source), target: idxOf(e.target) }))
sim.force('link', forceLink(linkData))
while (tick < maxTicks) sim.tick()
// edges still has string IDs! linkData has node refs. Graph3D crashes on edge.source.x

// ✅ FIXED: copy references back after simulation
for (let i = 0; i < edges.length; i++) {
  edges[i].source = linkData[i].source
  edges[i].target = linkData[i].target
}
```

### InstancedMesh: Batch Update Pattern

When changing multiple instance properties:

```js
// Update all instances one by one
for (let i = 0; i < nodes.length; i++) {
  mesh.setMatrixAt(i, matrix)
  mesh.setColorAt(i, color)
}
// THEN signal a single batch update — setting needsUpdate per-iteration is wasteful
mesh.instanceMatrix.needsUpdate = true
mesh.instanceColor.needsUpdate = true
```

### InstancedMesh: InstanceColor Initialization

`instanceColor` must be set as an `InstancedBufferAttribute` before use; `setColorAt()` silently does nothing if it's `null`:

```js
// ✅ CORRECT: allocate upfront
mesh.instanceColor = new THREE.InstancedBufferAttribute(
  new Float32Array(nodeCount * 3), 3
)
// Then use setColorAt() freely
```

### Force Layout: Tick Budget Scaling

Number of ticks should scale inversely with node count (more nodes = more diffusive force, needs fewer ticks for approximate layout):

```js
const maxTicks = Math.min(150, Math.max(60, Math.round(5000 / nodes.length)))
```

### CameraController: Missing Callback Registration

**Bug pattern**: Defining an internal `_onXxx` handler but forgetting to expose a public `onXxx()` registration method. The handler checks `this._onXxx && this._onXxx(args)` so it silently does nothing if no callback was set. Meanwhile, main.js calls `camCtrl.onXxx(callback)` which throws `TypeError: camCtrl.onXxx is not a function`, crashing the entire initialization.

```js
// ❌ CameraController defines the private handler but not the public method:
class CameraController {
  constructor() {
    el.addEventListener('dblclick', (e) => this._onDblClick && this._onDblClick(e))
  }
  // onDblClick(cb) { this._onDblClick = cb }  ← NEVER FORGET THIS
  onClick(cb) { this._onClick = cb }
}

// ❌ main.js calls it:
camCtrl.onDblClick((e) => { ... })  // TypeError! Nothing renders after this.
```

**Impact**: This error prevents ALL code after the call site from executing — the scene, render loop, and animation never start. The user sees a blank canvas with only the DOM overlays (title, search UI) that were set up earlier in the initialization.

**Prevention**: For every `_onMouseDown`, `_onMouseUp`, `_onClick`, `_onDblClick`, `_onWheel`, `_onTouchStart` etc., verify there's a matching `onClick(cb)`, `onDblClick(cb)`, etc. public method. The One-to-One Rule makes this easy:

_For each internal `_onXxx` handler, there must be a public `onXxx(cb)` method. Nothing else._

```js
// ✅ Complete set
onClick(cb) { this._onClick = cb }
onDblClick(cb) { this._onDblClick = cb }
// Add in pairs with the addEventListener calls
```

### EffectComposer + InstancedMesh

`UnrealBloomPass` works well with `InstancedMesh` — no special handling needed. But `MeshPhysicalMaterial` with `emissive` property makes nodes bloom more intensely:

```js
new THREE.MeshPhysicalMaterial({
  color: 0xff6b6b,
  emissive: 0xff6b6b,
  emissiveIntensity: 0.15,
})
```

### User Experience: Camera must show the full graph

**Critical UX rule**: A 3D graph that doesn't show all nodes on initial load is broken. Users must immediately see the overall structure to understand relationships.

Common failure mode — the camera starts at a hardcoded position (e.g., `radius=8`) that's too close for the graph's actual spread. The force layout distributes nodes over ±15 units, the camera at radius 8 only shows a fraction, and the user concludes "only one node exists, must use search".

**Fix**: Always call `fitToGraph(nodes)` after the force layout finishes. Never hardcode camera distance. The graph's bounding box should drive the camera position.

This is the single biggest UX issue in 3D graph visualization and the most frequent source of user frustration.

#### ⚠️ Pitfall: fitToGraph radius silently clamped by maxRadius（四参数联动）

When `fitToGraph()` computes a radius of, say, 83.7 (for a graph spanning ±30 units), but `maxRadius` is set to 50, the radius gets **silently clamped** without any warning or error. The user sees only part of the graph even when fully zoomed out, and has no indication why.

```js
// ❌ WRONG: maxRadius=50, fitToGraph computes 83.7 → silently clamped to 50
this.maxRadius = 50
// → User can see only ~60% of graph at max zoom

// ✅ CORRECT: generous maxRadius that accommodates any reasonable graph size
this.maxRadius = 200
```

**Fix**: All four of these must move together — camera far plane, fog distances, star range, and maxRadius:

```js
new THREE.PerspectiveCamera(50, aspect, 0.1, 500)    // ① far plane: 500
scene.fog = new THREE.Fog(0x080818, 60, 120)          // ② fog: 60-120
cameraCtrl.maxRadius = 200                             // ③ maxR: 200
// Stars at 50-250 radius to fill the larger visible area ④
```

If any one of these is left at its default while the others increase, you get a visible artifact: clamped view (maxRadius too small), clipping (far plane too short), star-less void (stars too close), or fogged-out periphery (fog too aggressive). Always check all four.

Also, `fitToGraph` padding matters:
- `padding = 0.3` → fits exactly, no breathing room → user only sees nodes, no context
- `padding = 0.6` → 1.6× base radius → shows graph with modest breathing room, not too much empty space
- `padding = 1.2` → too much white space, users felt the view was "too zoomed out" and couldn't see nodes clearly. The sweet spot depends on graph density: sparse graphs need more padding, dense graphs need less.
- Tuning rule: if most nodes are perceptually small/thin at default view, reduce padding. If the graph looks cramped at the edges of the viewport, increase padding.
- Match MeetBlog's approach: start wide, let users zoom in

### Virtual Root + Category Grouping Pattern

Rather than a flat tree or single domain as root, use a **virtual root** with **peer-level categories**:

```
root (virtual, white label, no visible graph presence)
  ├── 🤖 人工智能 (category)
  │   ├── 机器学习 (domain)
  │   │   ├── 监督学习 (subdomain)
  │   │   └── ...
  │   ├── 深度学习
  │   ├── ...
  ├── 📐 数学基础 (category)
  │   ├── 线性代数
  │   ├── 微积分
  │   └── ...
  └── 🔧 语言与框架 (category)
      ├── Python
      ├── PyTorch
      └── ...
```

Categories are peers under the root — no artificial nesting. This avoids the "feels wrong" problem where math or tools are forced under "computer" when the user thinks of them as separate domains.

**⚠️ Physical vs Logical hierarchy**: A domain's data file may live physically under another domain's directory (e.g. `src/domains/computer/foundation.js`), but the HTML pages and `src` paths must follow the **logical** hierarchy. If foundation is a peer to computer in `domains/index.js`, its page goes at `pages/foundation.html`, NOT `pages/computer/foundation.html`. The `src` field and all internal links must use the logical path.

Implementation in `domains/index.js`:

```js
import ai from './computer/ai.js'
import foundation from './computer/foundation.js'
import languages from './computer/languages.js'

const categories = [
  ai,
  foundation,
  languages,
]

export const graphData = {
  root: {
    id: 'root', label: '知识图谱', color: '#ffffff',
    children: categories.map(c => c.root),
  },
  relations: categories.flatMap(c => c.relations || []),
}
```

### Domain File Convention

Each domain file is a self-contained ES module:

```js
export default {
  root: { id, label, color, description, content, children: [...] },
  relations: [{ source: 'node-id', target: 'other-id', label: '关系', color: '#ffaa00' }],
}
```

- `id` must be globally unique across all domains
- `relations` can reference nodes in ANY domain (cross-domain edges)
- `children` is the hierarchical tree structure
- Leaf nodes have no `children` key
- **Chapter-hub nodes** (e.g., `prob-ch1`) have `children` plus their own `src` detail page — the hub page covers all children topics comprehensively

#### `src` field — Node detail pages (all levels, not just leaves)

Any node can have a `src` field pointing to a local HTML detail page:

```js
// ✅ CORRECT — path mirrors data file hierarchy under src/domains/
// src/domains/computer/ai/algo-base/common-ml.js → node linear-reg
{ id: 'linear-reg', label: '线性回归', src: '/pages/computer/ai/algo-base/common-ml/linear-reg.html' }

// ✅ Root node (index.js) gets the template
{ id: 'root', label: '知识图谱', src: '/_template.html' }

// ✅ Top-level domain nodes (computer.js, foundation.js) also have hub pages
{ id: 'computer', label: '计算机科学', src: '/pages/computer.html' }
{ id: 'math', label: '数学', src: '/pages/foundation.html' }  // peer to computer, not child
```

- Path is relative to `public/` (Vite copies `public/` contents to `dist/` root)
- **HTML path mirrors `src/domains/` directory structure exactly**: `pages/computer/ai/algo-base/common-ml/linear-reg.html` ↔ `src/domains/computer/ai/algo-base/common-ml.js` → child node `linear-reg`
- **Base template**: `public/_template.html` (must be inside `public/` for Vite to serve it; project-root won't work)
- **⚠️ Template must be in `public/`**: `_template.html` at the project root won't be served by Vite. Always put it in `public/_template.html`.
- **Double-click opens in new tab**: The graph's `onDblClick` handler uses `window.open(node.url, '_blank', 'noopener,noreferrer')` — this avoids re-rendering the 3D graph when returning from a detail page
- **src→url mapping**: `parseTree()` in `main.js` maps `nd.url = nd.url || nd.src` — so data files can use either field. `src` is preferred for project-internal HTML pages, `url` for external links. The InfoPanel's `<a id="info-panel-url" target="_blank">` also reads `nodeData.url`, giving users a clickable link in the side panel in addition to double-click.
- **有论文/无论文统一处理**: All nodes get an HTML page regardless. If the algorithm has a canonical paper, the HTML includes an arxiv link in the paper line. If not (e.g. linear regression, K-Means), the HTML just documents the method — definition, Loss function, formulas. The `src` mechanism is uniform.
- **参考来源选择策略（引用区分）**: 不要一味用课程替代论文，也不要一味只引用论文。按以下原则区分：
  - **深度模型/机制复杂**（概述不足以完整表达观点）→ 引用**原始论文** 📄。例如 Ridge→Hoerl &amp; Kennard 1970, Lasso→Tibshirani 1996, ElasticNet→Zou &amp; Hastie 2005
  - **简单扩展/概念直观**（课程概述足够）→ 保留课程引用 📘 或不引用。例如多项式回归（加高次项而已）→ Google 课程即可
  - **核心判断**: 如果一篇论文的引言和方法论是理解该模型为什么这样设计的必要条件 → 论文。如果只看概念和公式就能理解 → 课程足够
  - 详情页的 paper-line 块、右侧 📚 参考 callout、以及 footer 三处引用需要联动保持一致
- **在线课程替代论文引用**: For algorithms without a single canonical paper (or where a course provides better structured exposition), use online courses as the reference source instead of arxiv/nature. Replace the paper-line with a link to the course page. Example: `linear-reg.html` uses [Google ML Crash Course](https://developers.google.cn/machine-learning/crash-course/linear-regression) — the structured sub-pages (Definition, Loss, Gradient Descent, Hyperparameters) map naturally to the template sections. See `references/google-ml-crash-course-linear-reg.md` for the full content mapping pattern.
- Some nodes (Transformer, YOLO) may add custom sections beyond the template (architecture diagrams, version comparisons) — treat the template as a starting point

#### Detail page template structure

Template at `public/_template.html` serves as the reference. Four mandatory zones in order:

1. **Title area**: Chinese name + English in `.en` span, color bar, brief description
2. **Paper line** (optional): One-line arxiv/paper link in a styled anchor. Delete the whole block if no canonical paper exists
3. **Three-column layout** (sticky side columns + scrollable main):
   - **⚠️ 导航侧栏（左列）必须能独立滚动**: 当目录条目超过视口高度时，用户需要能滚动左侧导航区而正文不动。给 `.nav-col` 或 `.left-column` 加 `overflow-y: auto` + `max-height: calc(100vh - <header-height>)`。否则深层级页面的目录条目会被截断且无法访问，用户看不到后半部分的导航链接。
   - **Left (nav)**: Sticky table of contents, links to section IDs via `href="#section-id"`
   - **Center (main)**: Scrollable content — sections for definition, math (KaTeX formulas via CDN), key concepts, related methods
   - **Right (aside)**: Sticky callout blocks — 💡 要点 (key insight), ⚠️ 局限 (limitations), 🔧 实践 (engineering tips). Color variants via `.callout.tip` / `.callout.warn` CSS classes
4. **Footer**: Uniform closing line (`知识图谱 3D · &lt;domain&gt; · &lt;node-label&gt;`)

**CSS strategy**: Shared styles live in `public/css/common.css` (layout, typography, tables, formulas, code blocks, evolution tree structure, responsive breakpoints). Each page links it once:\n```html\n&lt;link rel=&quot;stylesheet&quot; href=&quot;../../../../../css/common.css&quot; /&gt;\n```\n\n**⚠️ Path depth depends on page location**:\n* Pages at `public/pages/computer/ai/algo-base/common-ml/*.html` → **5 levels up**: `../../../../../css/common.css`\n* Hub pages at `public/pages/*.html` → **2 levels up**: `../../css/common.css`\n* Template at `public/_template.html` → **0 levels up** (same dir): `css/common.css`\n* **Never hardcode wrong depth**. Verify by counting `/../` from file to `public/css/`.\n\nOnly page-specific overrides stay inline (~10 lines):
```html
&lt;style&gt;
  .title-area .bar { background:#4d96ff; }
  .aside-col .callout { border-left-color:#4d96ff; }
  .aside-col .callout strong { color:#4d96ff; }
  .evo-root{background:rgba(77,150,255,.1);border:1px solid rgba(77,150,255,.25);color:rgba(255,255,255,.85)}
  .evo-note{color:rgba(77,150,255,.6)}
&lt;/style&gt;
```
**Never duplicate common.css content inline** -- update common.css if a new shared pattern emerges. This keeps each page slim (~240 lines instead of ~600).

The header area (title + paper line) sits **above** the three-column layout, not inside it. This keeps the top-level info visible regardless of scroll position.

On mobile (<800px), columns collapse to a vertical stack: nav becomes horizontal pills, aside moves below main content.

#### ⚠️ Back-link: always use absolute `/`

Every detail page's back-link must use `href="/"`, not `href="../"`:

```html
<!-- ✅ CORRECT — always goes back to the graph root -->
<a class="back-link" href="/">← 🕸️ 返回图谱</a>

<!-- ❌ WRONG — relative path breaks at different depths -->
<a class="back-link" href="../">← 🕸️ 返回图谱</a>
```

**Why**: Detail pages live at varying directory depths (`/pages/computer.html`, `/pages/computer/ai/algo-base/common-ml/linear-reg.html`). Relative `../` from a deep page goes to a directory path (`/pages/computer/ai/algo-base/common-ml/`), not the graph root. Vite's SPA fallback may serve `index.html` at that wrong URL, causing subsequent node clicks to generate `pages/pages/...` path overlaps.

#### Evolution tree (子星图) — variant display for base nodes

Base algorithm nodes (e.g. 线性回归, 决策树) that have spawned multiple variants should include an **evolution tree section** in their detail page. This acts as a sub-star map within the page — variants live here, not as separate nodes in the main graph.

**Variant detail pages**: Each variant in the evolution tree that needs its own detail page follows the `references/evolution-variant-pages.md` pattern — consistent structure, theme color, and parallel delegate_task creation workflow.

```js
// Main graph — only base + milestone nodes
{ id: 'linear-reg', label: '线性回归', src: '...' }
// No separate nodes for Ridge, Lasso, ElasticNet, etc.

// Detail page for 线性回归 — evolution tree section shows:
// 线性回归 ─┬─ 岭回归 (Ridge)
//           ├─ Lasso
//           ├─ 弹性网络 (ElasticNet)
//           ├─ 多项式回归
//           ├─ 贝叶斯线性回归
//           └─ ⭐ 逻辑回归 (范式跃迁: 回归→分类)
```

Design: Use CSS borders and pseudo-elements to create a horizontal tree diagram. Root connects to a vertical list of children via a connector line. Mark milestone transitions (e.g. 线性回归→逻辑回归) with ⭐ and a note. Place the section between the math and key-concepts sections. Add a nav entry and an aside callout about the evolution direction.

Decision tree also gets an evolution tree with two branches: Bagging (→随机森林) and Boosting (→AdaBoost→GBDT→XGBoost). The tree is a visual design pattern, not an interactive 3D sub-graph.

KaTeX is loaded via CDN with auto-render. **Formula format rules**:
- Display math: `$$...$$` only
- Inline math: `$...$` only
- **⚠️ Do NOT use `\(...\)` or `\\[...\\]`** — the auto-render config only recognizes `$` delimiters. The `\(...\)` format silently fails to render (no error, just raw text).
- **Common error when generating via subagent**: Subagents writing HTML may use `\(...\)` for inline math because LaTeX natively uses that syntax. Always verify after batch generation: run `grep -r '\\\\\\\\(' public/pages/` to catch non-rendering formulas. Fix with Python: `content = content.replace('\\\\(', '$').replace('\\\\)', '$')`.

#### ⚠️ Pitfall: Patch tool double-escapes LaTeX backslashes

When using the `patch` tool to update HTML with KaTeX formulas, backslashes in LaTeX commands (`\neq`, `\text`, `\iff`, `\alpha`) get **automatically double-escaped** to `\\neq`, `\\text`, etc. The written file ends up with two backslashes where KaTeX expects one, breaking rendering silently (no error, just raw `\neq` visible).

**Detection**: After patching, grep for `\\\\[a-z]` patterns:
```bash
grep -rn '\\\\\\\\[a-z]' public/pages/foundation/linear-algebra/determinant.html
```

**Fix** — use Python `re.sub` on the patched file:
```python
import re
with open('file.html', 'r') as f: content = f.read()
content = re.sub(r'\\([a-zA-Z]{2,})', r'\\1', content)
with open('file.html', 'w') as f: f.write(content)
```

**Prevention**: For new HTML pages, use `write_file` instead of `patch` to avoid escaping issues entirely. Reserve `patch` for small text-only edits without LaTeX. **Formula format rules**:
- Display math: `$$...$$` only
- Inline math: `$...$` only
- **⚠️ Do NOT use `\(...\)` or `\[...\]`** — the auto-render config only recognizes `$` delimiters. The `\(...\)` format silently fails to render (no error, just raw text).
- **Common error when generating via subagent**: Subagents writing HTML may use `\(...\)` for inline math because LaTeX natively uses that syntax. Always verify after batch generation: run `grep -r '\\\\(' public/pages/` to catch non-rendering formulas. Fix with Python: `content = content.replace('\\(', '$').replace('\\)', '$')`.

#### English terminology convention

Add English alongside Chinese in `content.summary`, not in `label`:

```js
// ✅ CORRECT
{ id: 'supervised', label: '监督学习', content: { summary: 'Supervised Learning — 通过标注数据学习输入到输出的映射关系' } }

// ❌ WRONG — label should stay concise
{ id: 'supervised', label: '监督学习 (Supervised Learning)' }
```

This keeps the 3D node labels clean and short, while the English appears in hover tooltips or detail pages.

#### Discuss-first workflow

Per user preference: discuss structural changes (description wording, data format conventions, field additions) **before** editing files. Making one commit per small fix creates too many git commits. Discuss → reach consensus → batch edit all files at once.

#### ⚠️ Batch-commit convention

When weaving content from multiple sources (e.g., uploading chapters one by one), **never commit intermediate states**. The user expects a single clean commit per complete batch:

```bash
# ❌ WRONG — committing after each chapter creates noise
git commit -m "feat: 第一章"
git commit -m "feat: 第二章"
# → User will say "不要提交git，8个一起提"

# ✅ CORRECT — wait until ALL content is in, then one commit
git add -A && git commit -m "feat(book): 织入全部8篇内容" && git push
```

This applies to any multi-part content ingestion: book chapters, paper sections, batch-generated detail pages. Accumulate all changes locally, build once, then single commit + push.

### Branch-First Content Consolidation (from fragmented learning material)

**Signal:** When the user says the source material is "太碎了" (too fragmented), calls it only useful as an outline ("只适合当大纲"), or explicitly says "禁止push，提倡开个分支" — this is an instruction to **reorganize on a branch before merging into main**, not to stack directly onto main.

**Workflow (verified in 2026-07-09 Japanese grammar session):**

1. **User identifies fragmentation** — source material (MOOC, tutorial notes) is scattered, needs restructuring
2. **User proposes branch** — "禁止push，提倡开个分支" / "开分支之后合并，不往主线main堆" / "有助于整理零碎"
3. **Preserve existing WIP** — if the file already has uncommitted changes (user's own edits), use stash flow:
   ```bash
   git stash                              # save user's WIP
   git checkout -b feat/<descriptive-name> # create branch from clean main
   git stash pop                          # restore user's edits onto the branch
   ```
4. **Reorganize** — take the scattered points the user listed and structure them into well-organized sections (tables, comparisons, examples, practical tips)
5. **Commit on branch** — single commit describing what was added, not how many lines
6. **Ready for merge** — branch sits until user says to merge

**Key behaviors:**
- Do NOT push to main — the branch is the staging area for consolidation
- Preserve any user WIP with stash/pop rather than discarding it
- The branch name should describe the content class, not the session date (e.g., `feat/japanese-grammar-sys` not `feat/2026-07-09-jp`)
- For HTML content in the graph project: use the same card/section style as existing pages (dark theme, card borders, section-label divs, .child-card wrappers) so the reorganized content blends seamlessly with the existing page when merged

#### ⚠️ Don't assume content structure — trust the user's count

When the user says "X篇" (X sections), **believe them even if the raw text looks different**. Count carefully:

- The user says "第一章有6篇" — trust that number over your own paragraph-counting
- Markdown formatting loss (no bullet nested display) can make chapter intros look like standalone sections — the intro paragraph is NOT a section
- When in doubt, repeat the count back: "所以第一章6篇，第二章XX篇" before proceeding
- Correcting the user about their own content structure wastes tokens and frustrates them

### Hierarchical Directory Organization

For projects with many domains (10+), a **hierarchical file structure** that mirrors the visual tree keeps data discoverable:

```
domains/
├── index.js              ← Entry: import categories, build root
├── computer.js           ← Category merge: imports children
└── computer/
    ├── ai.js             ← Sub-category merge
    ├── ai/
    │   ├── ml.js         ← Leaf data files
    │   ├── dl.js
    │   └── ...
    ├── foundation.js     ← Leaf
    └── tools.js          ← Leaf
```

Each level imports its children and re-exports a combined domain object. This provides:
- **Spatial locality**: Path tells you the exact category
- **Editor search**: `ml.js` returns 1 result
- **Git history**: Changes to one leaf don't conflict with unrelated domains
- **Extensibility**: New category = `mkdir` + merge file + add to `index.js`

Full pattern documentation: `references/hierarchical-domains.md`

### Two-Level Domain Nav (expandable L1→L2)

Full reference: `references/two-level-domain-nav.md` — DOM, CSS, interaction logic, keyboard integration.

### When NOT to use a backend

For single-user knowledge graphs with <5000 nodes, a **purely static architecture** (JS files + Git) is superior:

| Concern | Static (JS files) | Backend (MySQL/API) |
|---------|------------------|-------------------|
| Deployment | GitHub Pages / nginx / any static host | Server needed |
| Data editing | Edit file → git push | Admin panel needed |
| Version history | Built-in via Git | Requires migration tooling |
| Performance | Zero network calls | API latency |
| Multi-user | ❌ | ✅ |
| Dynamic updates | ❌ | ✅ |

### Search with Clickable Results Dropdown

For better UX, search results should be displayed as a clickable dropdown list below the search bar, not just highlighted in the 3D scene. This provides an **explicit way to navigate** to a specific node.

#### ⚠️ Pitfall: Container Separation — Search vs Domain Bar

**SearchUI creates its own `#search-wrap` wrapper** via `createElement('div')`. Don't also define an empty `<div id="search-wrap">` in the static HTML — you'll get **two** elements with the same ID and the search box silently appears outside your intended layout.

**The domain bar also needs a separate container** — search belongs in the top-bar (flex row with title), but the domain navigation bar belongs at the left edge of `#app`. Pass two containers:

```js
// In main.js:
const searchUI = new SearchUI(
  nodes, opts, domains,
  document.getElementById('top-bar'),  // ← search wrapper goes here (flex row with title)
  document.getElementById('app')        // ← domain bar goes here (left edge)
)
```

```js
// In SearchUI.js:
constructor(nodes, opts, domains, searchContainer, domainContainer) {
  // ...setup...
  this._build(searchContainer, domainContainer)
}

_build(searchContainer, domainContainer) {
  this.wrapper = document.createElement('div')
  this.wrapper.id = 'search-wrap'
  // ...build search row + results...
  searchContainer.appendChild(this.wrapper) // ← to top-bar

  this.domainBar = document.createElement('div')
  this.domainBar.id = 'domain-bar'
  // ...build L1/L2 chips...
  domainContainer.appendChild(this.domainBar) // ← to #app
}
```

**Layout goal**: title + search in a single flex row at the top center, domain nav as a sidebar:

```css
#top-bar {
  position: absolute; top: 20px; left: 50%; transform: translateX(-50%);
  display: flex; align-items: center; gap: 20px;
  z-index: 10; pointer-events: none;
}
#search-wrap {
  pointer-events: auto; min-width: 280px; max-width: 400px; flex: 1;
}
```

Keep the top-bar sparse — no subtitle text, no hint text below the title. The cleaner it is, the more the graph scene shines.

```js
class SearchUI {
  constructor(nodes, onHighlight, onSelect, container) {
    this._build(container)
  }

  _build(container) {
    // Search bar row (input + count + clear button)
    this.wrapper = document.createElement('div')
    this.results = document.createElement('div') // dropdown list

    this.input.addEventListener('input', debounce(() => this._search(), 120))
    this.input.addEventListener('focus', () => {
      if (this._lastResults.length > 0) this.results.style.display = 'block'
    })
    document.addEventListener('click', (e) => {
      if (!this.wrapper.contains(e.target)) this.results.style.display = 'none'
    })
  }

  _search() {
    const q = this.input.value.toLowerCase()
    if (!q) return this._clearResults()
    const results = nodes.filter(n =>
      (n.label + n.description + n.id).toLowerCase().includes(q)
    )
    this._lastResults = results.map(n => n.id)
    onHighlight(this._lastResults)
    this._renderResults(results.slice(0, 20), q)
  }

  _renderResults(results, query) {
    this.results.innerHTML = ''
    for (const node of results) {
      const item = document.createElement('div')
      item.className = 'search-result-item'
      // Highlight matching substring in label
      item.innerHTML = `<span>${highlightedLabel(node, query)}</span>`
      item.addEventListener('click', () => {
        this.results.style.display = 'none'
        onSelect(node)  // triggers flyTo + select + show panel
      })
      this.results.appendChild(item)
    }
    this.results.style.display = 'block'
  }

  clearSearch() {
    this.input.value = ''
    this._clearResults()
    onHighlight([])
  }
}
```

**CSS for the dropdown** — use a blur-background panel that matches the dark theme:

```css
/* Search row: horizontal flex with input + count + clear */
#search-row {
  display: flex; align-items: center; gap: 6px;
  background: rgba(15,15,40,.7); backdrop-filter: blur(12px);
  border: 1px solid rgba(255,255,255,.08); border-radius: 24px;
  padding: 4px 6px 4px 18px;
}

/* Dropdown: appears below the search row */
#search-results {
  margin-top: 6px;
  background: rgba(15,15,45,.9); backdrop-filter: blur(16px);
  border: 1px solid rgba(255,255,255,.08); border-radius: 12px;
  max-height: 300px; overflow-y: auto;
  box-shadow: 0 8px 32px rgba(0,0,0,.4);
}
.search-result-item {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 14px; cursor: pointer;
  color: rgba(255,255,255,.65); font-size: 13px;
  transition: all .1s;
  border-bottom: 1px solid rgba(255,255,255,.04);
}
.search-result-item:hover,
.search-result-item.active {
  background: rgba(255,255,255,.06); color: #fff;
}
.sri-label mark {
  background: rgba(255,200,50,.25); color: #ffd93d;
  border-radius: 2px; padding: 0 2px;
}
```

Clean separation between UI (DOM) and highlight (3D scene):

```js
class SearchUI {
  constructor(nodes, onHighlight, onSelect, container) {
    this.input.addEventListener('input', () => {
      debounce(() => {
        const q = this.input.value.toLowerCase()
        const results = nodes.filter(n => n.label.includes(q) || n.id.includes(q))
        onHighlight(results.map(n => n.id))  // ← calls graph.setSearchHighlight()
      }, 150)
    })
    this.input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.clearSearch()
      if (e.key === 'Enter') onSelect(results[0])  // first match
    })
  }
  clearSearch() {
    this.input.value = ''
    onHighlight([])  // ← calls graph.clearHighlight()
  }
}
```

On the Graph3D side:

```js
setSearchHighlight(matchedIds) {
  this.highlightedSet.clear()
  for (const id of matchedIds) this.highlightedSet.add(id)
  this._applyAllMatrices()  // dim non-highlighted, brighten highlighted
  this._applyEdgeHighlight()  // dim non-connected edges
}
```

### Domain Quick-Navigation (Vertical Sidebar)

Beyond text search, provide **one-click navigation to top-level domains** via a vertical sidebar on the left edge of the screen.

#### ⚠️ Pitfall: Hardcoded DOMAINS array gets stale when new domains are added

Never hardcode the `DOMAINS` array passed to SearchUI — it will silently miss new domains added to `index.js`:

```js
// ❌ WRONG — hardcoded, must update manually for every new domain
const DOMAINS = [
  { id: 'computer', label: '计算机科学', color: '#4d96ff', children: [...] },
  { id: 'math', label: '数学', color: '#eab308', children: [] },
]
```

**Fix**: Derive `DOMAINS` dynamically from `graphData.root.children`, which already has the full domain tree:

```js
// ✅ CORRECT — auto-generates from index.js categories, zero maintenance
const DOMAINS = (graphData.root.children || []).map(child => ({
  id: child.id,
  label: child.label,
  color: child.color,
  children: (child.children || []).map(c => ({ id: c.id, label: c.label })),
}))
```

This also auto-discovers L2 sub-domains (e.g. `linear-algebra`, `calculus` under `math`). Every domain added to `index.js` → `categories` array instantly appears in the navigation bar.

**Why left sidebar, not horizontal below search**: A horizontal bar sits in the center of the screen (since the search box is center-aligned) and blocks nodes/edges underneath. The left edge is natural navigation territory — users look there for menus, and nodes rarely cluster at the far-left of the viewport (cameras orbit around center). Vertical layout also scales: adding more domains extends the list downward, not off-screen horizontally.

**CSS** — slim pills with blurred glass background, no z-index war with the 3D canvas:

```css
#domain-bar {
  position: absolute; top: 50%; left: 12px; transform: translateY(-50%);
  display: flex; flex-direction: column; gap: 6px;
  z-index: 12; pointer-events: auto;
}
.domain-chip {
  display: flex; align-items: center; gap: 6px;
  padding: 6px 10px; border-radius: 10px;
  font-size: 11px; color: rgba(255,255,255,.4);
  background: rgba(15,15,40,.5); backdrop-filter: blur(8px);
  border: 1px solid rgba(255,255,255,.06);
  cursor: pointer; user-select: none;
  transition: all .2s;
}
.domain-chip:hover {
  background: rgba(255,255,255,.1);
  color: rgba(255,255,255,.8);
}
.domain-chip.active {
  color: #fff; border-color: currentColor;
  background: rgba(255,255,255,.12);
}
.domain-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
```

**Data flow**: The sidebar is built from a static domain list passed to SearchUI. Each chip toggles a `_parentDomain` filter:

```
Click chip → searchUI._selectDomain(domainId)
  → onHighlight() → graph.setSearchHighlight(all nodes matching _parentDomain)
  → onDomainSelect() → camCtrl.flyToNode(domain root node)
  → Click again → clear filter + resetFullView()
```

The domain bar is constructed as a separate DOM element (not inside the search wrapper), positioned absolutely on the left edge:

```js
// In _build(), after appending search wrapper to container:
this.domainBar = document.createElement('div')
this.domainBar.id = 'domain-bar'
for (const d of this._domains) {
  const chip = document.createElement('span')
  chip.className = 'domain-chip'
  chip.dataset.domain = d.id
  chip.innerHTML = `<span class="domain-dot" style="background:${d.color}"></span>${d.label}`
  chip.addEventListener('click', () => this._selectDomain(d.id))
  this.domainBar.appendChild(chip)
}
container.appendChild(this.domainBar)  // appended to #app, not #search-wrap
```

```js
class SearchUI {
  constructor(nodes, onHighlight, onSelect, container) {
    this._build(container)
  }

  _build(container) {
    // Search bar row (input + count + clear button)
    this.wrapper = document.createElement('div')
    this.results = document.createElement('div') // dropdown list

    this.input.addEventListener('input', debounce(() => this._search(), 120))
    this.input.addEventListener('focus', () => {
      if (this._lastResults.length > 0) this.results.style.display = 'block'
    })
    document.addEventListener('click', (e) => {
      if (!this.wrapper.contains(e.target)) this.results.style.display = 'none'
    })
  }

  _search() {
    const q = this.input.value.toLowerCase()
    if (!q) return this._clearResults()
    const results = nodes.filter(n =>
      (n.label + n.description + n.id).toLowerCase().includes(q)
    )
    this._lastResults = results.map(n => n.id)
    onHighlight(this._lastResults)
    this._renderResults(results.slice(0, 20), q)
  }

  _renderResults(results, query) {
    this.results.innerHTML = ''
    for (const node of results) {
      const item = document.createElement('div')
      item.className = 'search-result-item'
      // Highlight matching substring in label
      item.innerHTML = `<span>${highlightedLabel(node, query)}</span>`
      item.addEventListener('click', () => {
        this.results.style.display = 'none'
        onSelect(node)  // triggers flyTo + select + show panel
      })
      this.results.appendChild(item)
    }
    this.results.style.display = 'block'
  }

  clearSearch() {
    this.input.value = ''
    this._clearResults()
    onHighlight([])
  }
}
```

**CSS for the dropdown** — use a blur-background panel that matches the dark theme:

```css
/* Search row: horizontal flex with input + count + clear */
#search-row {
  display: flex; align-items: center; gap: 6px;
  background: rgba(15,15,40,.7); backdrop-filter: blur(12px);
  border: 1px solid rgba(255,255,255,.08); border-radius: 24px;
  padding: 4px 6px 4px 18px;
}

/* Dropdown: appears below the search row */
#search-results {
  margin-top: 6px;
  background: rgba(15,15,45,.9); backdrop-filter: blur(16px);
  border: 1px solid rgba(255,255,255,.08); border-radius: 12px;
  max-height: 300px; overflow-y: auto;
  box-shadow: 0 8px 32px rgba(0,0,0,.4);
}
.search-result-item {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 14px; cursor: pointer;
  color: rgba(255,255,255,.65); font-size: 13px;
  transition: all .1s;
  border-bottom: 1px solid rgba(255,255,255,.04);
}
.search-result-item:hover,
.search-result-item.active {
  background: rgba(255,255,255,.06); color: #fff;
}
.sri-label mark {
  background: rgba(255,200,50,.25); color: #ffd93d;
  border-radius: 2px; padding: 0 2px;
}
```

Clean separation between UI (DOM) and highlight (3D scene):

```js
class SearchUI {
  constructor(nodes, onHighlight, onSelect, container) {
    this.input.addEventListener('input', () => {
      debounce(() => {
        const q = this.input.value.toLowerCase()
        const results = nodes.filter(n => n.label.includes(q) || n.id.includes(q))
        onHighlight(results.map(n => n.id))  // ← calls graph.setSearchHighlight()
      }, 150)
    })
    this.input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.clearSearch()
      if (e.key === 'Enter') onSelect(results[0])  // first match
    })
  }
  clearSearch() {
    this.input.value = ''
    onHighlight([])  // ← calls graph.clearHighlight()
  }
}
```

On the Graph3D side:

```js
setSearchHighlight(matchedIds) {
  this.highlightedSet.clear()
  for (const id of matchedIds) this.highlightedSet.add(id)
  this._applyAllMatrices()  // dim non-highlighted, brighten highlighted
  this._applyEdgeHighlight()  // dim non-connected edges
}
```

## Sibling Repo Bootstrap (new graph from existing skeleton)

**Trigger**: 主公 creates a new GitHub repo and says "我建好了，你可以拉取并操作"; or when content rules say a topic deserves its own graph (e.g. 408 exam content → `knowledge-graph-408`, per the "separate graph, same codebase" principle above).

**Workflow**: clone empty remote → rsync skeleton (exclude `.git`/`dist`/`public/pages`/`node_modules`) → delete old domain data files → write new top-level domain shells → fix repo-specific configs → fresh `npm install` → build → preview+browser verify → single commit+push. Full verified recipe with commands: `references/repo-bootstrap.md`.

**Repo-specific config checklist** (every one is per-repo and easy to forget):
1. `.github/workflows/deploy.yml` — hardcoded `--base=/<repo-name>/` (was `/knowledge-graph-3d/` for the original)
2. `package.json` — `name` field
3. `index.html` — `<title>` + `#logo` text
4. `README.md` — domain table, repo links, deploy URL
5. `src/domains/` — replace data files entirely; keep `domain-colors.js` as the color registry
6. `src/graph-data.js` / `index.html` doc comments referencing old domains

**Pitfalls (all hit on 2026-09-03)**:
- ⚠️ **Never reuse rsync'd `node_modules`** — the copy breaks (`ERR_MODULE_NOT_FOUND` pointing into `node_modules/vite/dist/node/cli.js`). In the new repo: `rm -rf node_modules && npm install`.
- ⚠️ **Fresh clone has no git identity** on this host — commit fails with "无法自动探测邮件地址" unless you set per-repo `git config user.name klzw12 && git config user.email klzw12@users.noreply.github.com` first.
- ⚠️ **Every domain root AND subject-root id must be registered in `domain-colors.js`** — `main.js` `parseTree()` uses `DOMAIN_COLORS[node.id] ? node.id : parentDomain` to assign each node its `_parentDomain`. An unregistered subject root makes all its children inherit the wrong domain (edge coloring / domain filter break). Add one line per top-level subject, not just per top-level domain.
- ⚠️ **The copied deploy.yml (v4 actions, node 20) fails on a fresh repo** — upgrade during bootstrap to checkout@v5 / setup-node@v5 (node-version: **24**, not 20 — runner warns "too low") / configure-pages@v5 with `enablement: true` / upload-pages-artifact@v4 / deploy-pages@v5. 主公 may fix versions on the web UI himself → always `git pull` before reading deploy.yml. Deploy status via Actions API; job logs need admin rights (anonymous gets 403).
- Deploy workflow only triggers on `main` branch push — push with `git push -u origin main`.

**Skeleton-phase user preference (empty shells, no pre-fill)**: the bootstrap commit contains domain/subject shells ONLY — no `children`, no pre-filled `relations` (leave `relations: []` with commented examples). Each subject's placeholder aggregation mainline goes in its `description` (e.g. OS = 资源管理主线). Data files carry rich header comments explaining how to extend. Real content enters only after 主公敲板 (approves the aggregation draft). This mirrors the "don't pre-fill hub content" rule at repo scale.

**Verify before push** (主公 has high UX standards): `npm run build` → `npm run preview -- --port 4173 --strictPort` → browser check console: expect `🕸️ 已加载 N 个大类, 共 M 个节点` log, `js_errors: []`, and node count = root + domains + subjects (e.g. 13 nodes / 12 tree edges for 1 root + 3 domains + 9 subjects). `fitToGraph` auto-frames so all nodes must be visible at load. Then kill preview, commit, push, confirm via `git ls-remote` + GitHub API (`private: false`).

## Color Modes + Canvas-Sprite Labels + Info Stats (化用 cbm, 2026-09-08)

Implemented in `knowledge-graph-408` after studying DeusData/codebase-memory-mcp (see `references/codebase-memory-mcp-design-notes.md`). Verified patterns for adding these to a Three.js graph:

### Color modes (domain / heat / status) with runtime switching

Central module `src/colorModes.js` exports per-mode color functions + a legend helper; Graph3D keeps `this.colorMode` and one helper decides node color:

```js
export function nodeColorForMode(node, mode) {
  if (mode === 'heat') return heatColorForDegree(node._degree)   // stellar bands by degree
  if (mode === 'status') {
    const c = statusColor(node.status)   // mastered/learning/weak/todo
    if (c) return c
  }
  return node.color   // 'domain' default, and any mode falls back when data lacks fields
}
```

- `_degree` must be precomputed (inDegree+outDegree+children count) — see degree double-count pitfall below.
- **Edges must be re-colored too**: store `edgeBaseColors` at build time; on `setColorMode()` reblend every edge as `lerp(endpointColorA, endpointColorB, 0.5)` and rewrite the attribute array + `needsUpdate`, then re-apply edge highlight. Don't let edges stay domain-colored while nodes switch modes.
- Bottom-center UI: 3 mode buttons + a legend bar (`legendForMode(mode)` returns swatch+label rows). Legend hidden in domain mode, shown in heat (stellar bands) / status (✅🟡🟠🔴).

### Canvas-texture sprite labels (hierarchical visibility)

Always-on DOM/CSS2D labels don't scale; per-node `THREE.Sprite` with a CanvasTexture does. Key implementation points from `src/NodeLabels.js`:

- One shared canvas + 2D ctx; per label: measure + ellipsis-fit text, `strokeText` dark outline then `fillText` white (readable over any node color), `CanvasTexture` with `LinearFilter`, no mipmaps, `SRGBColorSpace`.
- Sprite material: `transparent, depthWrite:false, sizeAttenuation:true`; `renderOrder` above nodes; scale = worldHeight (constant, e.g. 2.4 in 50-unit graphs) × canvas aspect.
- **Visibility tiers** (the whole point): no focus → show top-N by `_degree`; focus/highlight active → show only highlighted + selected + hovered; hover/selected always shown even if lazy-created on the spot.
- Keep a `Map<id,{sprite,texture}>`; toggle `.visible` rather than recreating. Dispose textures on clear.

### ⚠️ Label-layer pitfalls (all hit live)

1. **Separate label module MUST `import * as THREE from 'three'`** — build succeeds but browser throws `ReferenceError: THREE is not defined` at runtime (esbuild doesn't catch it).
2. **Sprites created with `visible=false` stay invisible forever if the create path never flips it** — after lazy-create inside `update()`, explicitly set `entry.sprite.visible = true`.
3. **In-degree double count**: if `parseTree`/walk increments `inDegree` when pushing tree edges AND a later global edge loop increments again, every non-root node reports inDegree one too high (stats read 2 for a single parent edge). Count in ONE place only — the global edge loop is enough.

### InfoPanel stats + directed relation groups

Header stats row (关联/引出/引入/层级) from `inDegree/outDegree/_depth`; split relations into two labeled groups — `↗ 引出` (this node is `source`) and `↖ 引入` (this node is `target`) — each row clickable to re-focus that neighbor. Mirrors cbm's NodeDetailPanel inbound/outbound split and doubles as the "what references this" navigator.

## Alternative Architecture: vasturiano/3d-force-graph

A well-maintained library with a different architecture trade-off:
- Uses **individual** `SphereGeometry` per node (not InstancedMesh) — trades some performance for API simplicity
- Internal: `three-forcegraph` + `three-render-objects` composed via kapsule pattern
- Config-driven API: all properties through accessor functions
- Supports dagMode, directional arrows, link particles
- Built-in DragControls for node dragging
- **Better for**: <2000 nodes, needs out-of-box interactivity
- **Worse for**: high node counts, custom rendering pipeline

## Reference
- `references/codebase-memory-mcp-design-notes.md` — 主公建议研究的 AI 代码图谱（DeusData/codebase-memory-mcp）设计优点摘要：恒星光谱着色/节点状态分类/语义化边类型/路径查询/多星系分簇/标签分级/密度自适应/入出连接分组/目录树聚合/邻域聚焦相机，映射到考研图谱的可行方案与待敲板决策（2026-09-08，含 graph-ui 源码级深读）
- `references/repo-bootstrap.md` — Verified recipe for spawning a sibling graph repo from an existing skeleton (clone empty remote → rsync → swap domains → repo-specific configs → install/build/verify/push). Covers pitfalls: broken rsync'd node_modules, missing git identity, domain-colors registry completeness, deploy base path per repo.
- `references/meetblog-architecture.md` — Full deep-dive of a production 3D blog galaxy: rendering pipeline, camera system, interaction details, color/size mapping
- `references/v2-architecture.md` — Complete V2 rewrite of the knowledge-graph-3d project: file map, component responsibilities, force layout tuning, highlight system, edge curving params
- `references/hierarchical-domains.md` — Hierarchical directory structure for organizing domain data files, with merge-file pattern explained in detail
- `references/static-pages-architecture.md` — Hub vs Detail page classification for knowledge graph static pages: which nodes get which template, layout designs, generation flow, and key design principles (don't pre-fill hub content, children determine hub status)
- `references/evolution-variant-pages.md` — Creating detail pages for evolution tree variant algorithms (Ridge/Lasso/ElasticNet etc.): color theme convention, variant-specific sections, parallel delegate_task workflow, pitfalls
- `references/content-extraction-workflow.md` — Extracting knowledge nodes from reference repos (e.g. exam/study materials) and weaving them into the knowledge graph: from clone to node creation to cross-domain relations, with conventions for batch commits and math content
- `references/book-weaving-pattern.md` — Book content weaving pattern specific to the user's 9.9元/6本 series (羊皮卷, 人性的弱点 etc.): chapter structure, ambiguous formatting pitfalls, section counting conventions, and domain setup steps
- `references/content-structuring-rules.md` — Content page structure decision framework: when to use one-page vs multi-page for a knowledge domain. Distinguishes independent collections, single-work systems, and multi-work syntheses — with audit history showing which humanities pages pass/fail, plus the **推演链条 (reasoning chain) pattern** for type C multi-page content.
- `references/two-level-domain-nav.md` — Two-level domain navigation for search UI: expandable L1→L2 chips in the sidebar.
- `references/threejs-interactive-tree.md` — 3D interactive tree pattern (individual nodes with expand/collapse, star field background, info panel, CSS2D labels). Companion to the batch-rendered approach documented above — use for smaller trees where per-node richness matters.
- `references/hybrid-tree-graph-pattern.md` — Hybrid tree+relations data architecture: maintain a clear tree hierarchy for easy editing, plus a `relations[]` array for arbitrary cross-domain connections. Includes layout strategy (radial tree for structure, cross edges as overlays), interaction model, and detail panel design.
