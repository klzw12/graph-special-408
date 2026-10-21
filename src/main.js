/**
 * 🕸️ Knowledge Graph 3D — 入口
 * 
 * 流程：解析数据 → 力导向布局 → InstancedMesh 渲染 → 交互
 */

import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { forceSimulation, forceLink, forceManyBody, forceCenter } from 'd3-force-3d'

import { graphData } from './graph-data.js'
import { DOMAIN_COLORS } from './domains/domain-colors.js'
import { Graph3D } from './Graph3D.js'
import { CameraController } from './CameraController.js'
import { SearchUI } from './SearchUI.js'
import { InfoPanel } from './InfoPanel.js'

// ─── 解析树数据为 flat 节点 + 边 ───
function parseTree(data) {
  const nodes = []
  const treeEdges = []
  const crossEdges = data.relations || []

  const walk = (node, parentId, depth, parentDomain) => {
    const nd = { ...node }
    nd._parentId = parentId
    nd._depth = depth
    nd._children = node.children ? node.children.map(c => c.id) : []
    nd.url = nd.url || nd.src
    // GitHub Pages 子路径适配：用 Vite 注入的 BASE_URL（构建时 --base 决定）
    // 例：本地 '/' → /pages/x.html；Pages '/graph-special-408/' → /graph-special-408/pages/x.html
    if (nd.url && nd.url.startsWith('/')) {
      const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '')
      if (base) nd.url = base + nd.url
    }
    nd.inDegree = 0
    nd.outDegree = 0
    // 标记所属 domain（depth=2 的节点本身就是 domain，其子节点继承）
    nd._parentDomain = DOMAIN_COLORS[node.id]
      ? node.id          // depth=2 的 domain 节点
      : parentDomain     // 子节点继承父 domain
    delete nd.children
    nodes.push(nd)

    if (parentId) {
      treeEdges.push({ source: parentId, target: node.id })
      nd.inDegree++
    }

    if (node.children) {
      node.children.forEach(c => {
        walk(c, node.id, depth + 1, nd._parentDomain)
      })
    }
  }

  walk(data.root, null, 0, null)

  // 合并所有边
  const allEdges = [
    ...treeEdges,
    ...crossEdges.map(r => ({ source: r.source, target: r.target, label: r.label, color: r.color })),
  ]

  // 计算出入度
  for (const e of allEdges) {
    const src = nodes.find(n => n.id === e.source)
    const dst = nodes.find(n => n.id === e.target)
    if (src) src.outDegree++
    if (dst) dst.inDegree++
  }

  // 给节点分配随机初始位置
  for (const n of nodes) {
    n.x = (Math.random() - 0.5) * 20
    n.y = (Math.random() - 0.5) * 10
    n.z = (Math.random() - 0.5) * 20
  }

  return { nodes, edges: allEdges }
}

// ─── 力导向布局 ───
async function runForceLayout(nodes, edges, onProgress) {
  const nodeMap = new Map()
  nodes.forEach((n, i) => nodeMap.set(n.id, i))

  const linkData = edges
    .map(e => ({
      source: nodeMap.get(e.source),
      target: nodeMap.get(e.target),
    }))
    .filter(e => e.source !== undefined && e.target !== undefined)

  const nNodes = nodes.length
  const maxTicks = Math.min(150, Math.max(60, Math.round(5000 / nNodes)))

  return new Promise((resolve) => {
    const sim = forceSimulation(nodes, 3)
      .force('link', forceLink(linkData)
        .id((_, i) => i)
        .distance(25)
        .strength(0.4))
      .force('charge', forceManyBody().strength(-60).theta(0.9))
      .force('center', forceCenter(0, 0, 0))
      .alphaDecay(0.1)
      .stop()

    let tick = 0
    const batchSize = 8

    function step() {
      for (let i = 0; i < batchSize && tick < maxTicks; i++, tick++) {
        sim.tick()
      }
      if (onProgress) onProgress(tick / maxTicks)
      if (tick < maxTicks) {
        setTimeout(step, 0)
      } else {
        // 力模拟后，linkData 的 source/target 已转为节点对象引用
        // 更新原始 edges 使用节点对象
        for (let i = 0; i < edges.length; i++) {
          const link = linkData[i]
          if (link) {
            edges[i].source = link.source
            edges[i].target = link.target
            edges[i]._sourceId = null
            edges[i]._targetId = null
          }
        }
        // 清理：移除 d3 附加字段
        for (const n of nodes) {
          delete n.index
          delete n.vx
          delete n.vy
          delete n.vz
        }
        resolve()
      }
    }
    step()
  })
}

// ─── 主程序 ───
async function main() {
  const container = document.getElementById('canvas-container')
  const width = container.clientWidth
  const height = container.clientHeight

  // 场景
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x080818)
  scene.fog = new THREE.Fog(0x080818, 60, 120)

  // 相机
  const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 500)

  // 渲染器
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: false,
  })
  renderer.setSize(width, height)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.0
  container.appendChild(renderer.domElement)

  // 后处理（Bloom）
  const composer = new EffectComposer(renderer)
  composer.setSize(width, height)
  const renderPass = new RenderPass(scene, camera)
  composer.addPass(renderPass)

  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(width, height),
    0.6,   // strength
    0.4,   // radius
    0.05   // threshold
  )
  composer.addPass(bloomPass)

  // 灯光
  scene.add(new THREE.AmbientLight(0x222244, 0.5))
  const dl1 = new THREE.DirectionalLight(0xffffff, 1.5)
  dl1.position.set(10, 20, 10)
  scene.add(dl1)
  const dl2 = new THREE.DirectionalLight(0x4488ff, 0.4)
  dl2.position.set(-10, 5, -10)
  scene.add(dl2)

  // 星空背景
  createStars(scene)

  // 相机控制
  const camCtrl = new CameraController(camera, renderer.domElement)

  // 图谱
  const graph = new Graph3D(scene)

  // 信息面板
  const panel = new InfoPanel()

  // ─── 加载数据 ───
  const { nodes, edges } = parseTree(graphData)
  panel.setRelations(graphData.relations)

  // 更新统计
  document.getElementById('stats-nodes').textContent = nodes.length
  document.getElementById('stats-edges').textContent = edges.length

  // 力导向布局
  await runForceLayout(nodes, edges, (progress) => {
    const pct = Math.round(progress * 100)
    const el = document.getElementById('layout-progress')
    if (el) el.textContent = `布局中 ${pct}%`
  })

  // 构建图谱
  graph.build(nodes, edges)

  // 适配相机到全图
  camCtrl.fitToGraph(nodes)

  // 构建节点全量 Map（供 InfoPanel 使用）
  const allNodes = new Map()
  for (const n of nodes) {
    allNodes.set(n.id, n)
  }
  panel.setNodeMap(allNodes)

  // 隐藏 loading
  document.getElementById('layout-progress')?.remove()
  document.getElementById('start-hint')?.classList.add('visible')

  // ─── 搜索 ───
  // 领域导航从 graphData 推导，避免和 domains/ 里的结构漂移
  const DOMAINS = (graphData.root.children || []).map((c) => ({
    id: c.id,
    label: c.label,
    color: c.color,
    children: (c.children || []).map((s) => ({ id: s.id, label: s.label })),
  }))

  const searchUI = new SearchUI(
    nodes,
    {
      onHighlight: (matchedIds) => {
        if (matchedIds.length > 0) {
          graph.setSearchHighlight(matchedIds)
        } else {
          graph.clearHighlight()
          graph.selectNode(-1)
        }
      },
      onSelect: (node) => {
        const idx = nodes.findIndex(n => n.id === node.id)
        if (idx >= 0) {
          graph.selectNode(idx)
          panel.show(node)
          camCtrl.flyToNode(node)
        }
      },
      onDomainSelect: (domainId) => {
        if (!domainId) {
          graph.clearHighlight()
          graph.selectNode(-1)
          camCtrl.resetFullView()
          return
        }
        // 找到该 domain 根节点，飞过去
        const domainNode = nodes.find(n => n.id === domainId)
        if (domainNode) {
          const idx = nodes.findIndex(n => n.id === domainId)
          graph.selectNode(idx)
          panel.show(domainNode)
          camCtrl.flyToNode(domainNode)
        }
      },
    },
    DOMAINS,
    document.getElementById('top-bar'),
    document.getElementById('app')
  )

  // ─── 交互 ───
  // 悬停
  camCtrl._onNodeHover = null // 简化：在 click 中处理 raycaster

  // 点击检测
  const raycaster = new THREE.Raycaster()
  const pointer = new THREE.Vector2()

  function getNodeAtCursor(clientX, clientY) {
    const rect = renderer.domElement.getBoundingClientRect()
    pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1
    pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1
    raycaster.setFromCamera(pointer, camera)

    const mesh = graph.getNodeMesh()
    if (!mesh) return null
    const hits = raycaster.intersectObject(mesh)
    if (hits.length > 0 && hits[0].instanceId !== undefined) {
      return graph.getNode(hits[0].instanceId)
    }
    return null
  }

  camCtrl.onClick((e) => {
    const node = getNodeAtCursor(e.clientX, e.clientY)
    if (node) {
      const idx = nodes.findIndex(n => n.id === node.id)
      graph.selectNode(idx)
      panel.show(node)
      camCtrl.flyToNode(node)
    } else {
      graph.selectNode(-1)
      panel.hide()
    }
  })

  camCtrl.onDblClick((e) => {
    const node = getNodeAtCursor(e.clientX, e.clientY)
    if (node && node.url) {
      window.open(node.url, '_blank', 'noopener,noreferrer')
    }
  })

  // 悬停
  renderer.domElement.addEventListener('mousemove', (e) => {
    const node = getNodeAtCursor(e.clientX, e.clientY)
    if (node) {
      const idx = nodes.findIndex(n => n.id === node.id)
      graph.setHovered(idx)
      renderer.domElement.style.cursor = 'pointer'
      document.getElementById('breadcrumb').textContent = `📍 ${node.label}`
      document.getElementById('breadcrumb').style.opacity = '1'
    } else {
      graph.setHovered(-1)
      renderer.domElement.style.cursor = 'default'
      document.getElementById('breadcrumb').style.opacity = '0'
    }
  })

  // ESC
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      graph.selectNode(-1)
      panel.hide()
      searchUI.clearSearch()
      camCtrl.resetFullView()
    }
  })

  // 焦点事件
  document.addEventListener('kg:focus', (e) => {
    const { nodeId } = e.detail
    const node = allNodes.get(nodeId)
    if (node) {
      const idx = nodes.findIndex(n => n.id === nodeId)
      graph.selectNode(idx)
      panel.show(node)
      camCtrl.flyToNode(node)
    }
  })

  // ─── 窗口缩放 ───
  window.addEventListener('resize', () => {
    const w = container.clientWidth
    const h = container.clientHeight
    camera.aspect = w / h
    camera.updateProjectionMatrix()
    renderer.setSize(w, h)
    composer.setSize(w, h)
  })

  // ─── 动画循环 ───
  function animate(time) {
    requestAnimationFrame(animate)
    camCtrl.update(time)
    composer.render()
  }

  animate(0)

  console.log('🕸️ Knowledge Graph 3D v2 已启动！')
  console.log(`📊 ${nodes.length} 节点, ${edges.length} 关联`)
}

// ─── 星空 ───
function createStars(scene) {
  const count = 3000
  const positions = new Float32Array(count * 3)
  const sizes = new Float32Array(count)
  const colors = new Float32Array(count * 3)

  const palette = [
    new THREE.Color(0xffffff),
    new THREE.Color(0xaaaaff),
    new THREE.Color(0xffdd88),
    new THREE.Color(0x88ccff),
  ]

  for (let i = 0; i < count; i++) {
    const r = 50 + Math.random() * 200
    const theta = Math.random() * Math.PI * 2
    const phi = Math.acos(2 * Math.random() - 1)
    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta)
    positions[i * 3 + 1] = r * Math.cos(phi)
    positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta)
    sizes[i] = 0.5 + Math.random() * 1.5

    const c = palette[Math.floor(Math.random() * palette.length)]
    colors[i * 3] = c.r
    colors[i * 3 + 1] = c.g
    colors[i * 3 + 2] = c.b
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1))
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))

  const mat = new THREE.PointsMaterial({
    size: 0.15,
    vertexColors: true,
    transparent: true,
    opacity: 0.8,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true,
  })

  const stars = new THREE.Points(geo, mat)
  scene.add(stars)
}

// ─── 启动 ───
main().catch(console.error)
