/**
 * 🕸️ Graph3D — InstancedMesh 渲染引擎
 * 
 * 关键特性：
 * - InstancedMesh 批量渲染所有节点（1 个 draw call）
 * - LineSegments + BufferGeometry 批量渲染所有边
 * - 节点颜色 + 大小通过 instanceMatrix / instanceColor 控制
 * - 边颜色渐变（source → target）
 * - 高亮模式通过矩阵/颜色批量更新
 */

import * as THREE from 'three'
import { DOMAIN_COLORS } from './domains/domain-colors.js'

// ─── 常量 ───
const NODE_SEGMENTS = 20    // 球体细分
const EDGE_CURVE_POINTS = 8 // 每条边的曲线采样点
const BASE_RADIUS = 0.8
const LEAF_RADIUS = 0.55
const HOVER_SCALE = 1.35
const SELECT_SCALE = 1.6
const DIM_OPACITY = 0.08

export class Graph3D {
  constructor(scene) {
    this.scene = scene

    // 共享几何体（所有节点共用同一个球体）
    this.sharedGeo = new THREE.SphereGeometry(1, NODE_SEGMENTS, NODE_SEGMENTS)

    // 状态
    this.nodes = []          // 节点数据 [{id, label, color, x, y, z, ...}]
    this.nodeIndexMap = new Map()  // id → index
    this.flatEdges = []      // [{source: node, target: node}]
    this.selectedIdx = -1
    this.hoveredIdx = -1
    this.highlightedSet = new Set() // 搜索高亮
    this.edgeBaseColors = null

    // Three.js 对象
    this.nodesMesh = null
    this.edgesMesh = null
    this.sceneObjects = []

    // 射线
    this.raycaster = new THREE.Raycaster()
    this._mat4 = new THREE.Matrix4()
    this._pos = new THREE.Vector3()
    this._quat = new THREE.Quaternion()
    this._sca = new THREE.Vector3()
    this._col = new THREE.Color()
  }

  // ─── 构建图谱 ───
  build(nodes, edges) {
    this.clearObjects()
    this.nodes = nodes
    this.flatEdges = edges
    this.nodeIndexMap.clear()
    this.selectedIdx = -1
    this.hoveredIdx = -1
    this.highlightedSet.clear()
    this.edgeBaseColors = null

    // 建立 id → index 映射
    nodes.forEach((n, i) => this.nodeIndexMap.set(n.id, i))

    this._buildNodes()
    this._buildEdges()
  }

  // ─── 构建节点 (InstancedMesh) ───
  _buildNodes() {
    const count = this.nodes.length
    if (count === 0) return

    const material = new THREE.MeshBasicMaterial()

    this.nodesMesh = new THREE.InstancedMesh(this.sharedGeo, material, count)
    this.nodesMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    this.nodesMesh.instanceColor = new THREE.InstancedBufferAttribute(
      new Float32Array(count * 3), 3
    )
    this.nodesMesh.castShadow = false
    this.nodesMesh.receiveShadow = false

    // 设置每个实例的矩阵 + 颜色
    for (let i = 0; i < count; i++) {
      this._applyNodeMatrix(i)
    }
    this.nodesMesh.instanceMatrix.needsUpdate = true
    this.nodesMesh.instanceColor.needsUpdate = true

    this.scene.add(this.nodesMesh)
    this.sceneObjects.push(this.nodesMesh)
  }

  // ─── 构建边 (LineSegments) ───
  _buildEdges() {
    const edgeCount = this.flatEdges.length
    if (edgeCount === 0) return

    // 每条边：bezier 曲线采样 EDGE_CURVE_POINTS 个点
    // LineSegments 需要成对顶点：(p0,p1), (p1,p2), ... 
    // EDGE_CURVE_POINTS 个点 = EDGE_CURVE_POINTS-1 条线段 = (EDGE_CURVE_POINTS-1)*2 个顶点
    const SEGMENTS = EDGE_CURVE_POINTS - 1
    const VERTS_PER_EDGE = SEGMENTS * 2
    const totalVerts = edgeCount * VERTS_PER_EDGE

    const positions = new Float32Array(totalVerts * 3)
    const colors = new Float32Array(totalVerts * 3)
    this.edgeBaseColors = new Float32Array(totalVerts * 3)

    for (let ei = 0; ei < edgeCount; ei++) {
      const edge = this.flatEdges[ei]
      const src = edge.source
      const dst = edge.target
      if (!src || !dst) continue

      const sx = src.x, sy = src.y, sz = src.z
      const dx = dst.x, dy = dst.y, dz = dst.z

      // 确定 domain 颜色（统一色，非渐变）
      const domain = src._parentDomain || dst._parentDomain || 'tools'
      const domainColor = new THREE.Color(DOMAIN_COLORS[domain] || '#8888aa')
      const mx = (sx + dx) / 2
      const my = (sy + dy) / 2
      const mz = (sz + dz) / 2
      const dist = Math.sqrt((dx - sx) ** 2 + (dy - sy) ** 2 + (dz - sz) ** 2) || 1
      const offset = dist * 0.15
      const cx = mx + (Math.random() - 0.5) * offset * 0.3
      const cy = my + offset * 0.6
      const cz = mz + (Math.random() - 0.5) * offset * 0.3

      // 采样曲线点
      const pts = []
      for (let t = 0; t < EDGE_CURVE_POINTS; t++) {
        const u = t / (EDGE_CURVE_POINTS - 1)
        // 二次贝塞尔: (1-u)²·P0 + 2(1-u)u·P1 + u²·P2
        const u1 = 1 - u
        const x = u1 * u1 * sx + 2 * u1 * u * cx + u * u * dx
        const y = u1 * u1 * sy + 2 * u1 * u * cy + u * u * dy
        const z = u1 * u1 * sz + 2 * u1 * u * cz + u * u * dz
        pts.push({ x, y, z })
      }

      // 写入 LineSegments 顶点（成对）
      const srcCol = new THREE.Color(src.color)
      const dstCol = new THREE.Color(dst.color)
      const baseOffset = ei * VERTS_PER_EDGE * 3

      for (let si = 0; si < SEGMENTS; si++) {
        const p0 = pts[si]
        const p1 = pts[si + 1]
        const vi = baseOffset + si * 6

        // p0
        positions[vi + 0] = p0.x
        positions[vi + 1] = p0.y
        positions[vi + 2] = p0.z
        // p1
        positions[vi + 3] = p1.x
        positions[vi + 4] = p1.y
        positions[vi + 5] = p1.z

        // 颜色用 domain 统一色
        colors[vi + 0] = domainColor.r
        colors[vi + 1] = domainColor.g
        colors[vi + 2] = domainColor.b
        colors[vi + 3] = domainColor.r
        colors[vi + 4] = domainColor.g
        colors[vi + 5] = domainColor.b

        // 保存基础颜色（用于高亮恢复）
        this.edgeBaseColors[vi + 0] = domainColor.r
        this.edgeBaseColors[vi + 1] = domainColor.g
        this.edgeBaseColors[vi + 2] = domainColor.b
        this.edgeBaseColors[vi + 3] = domainColor.r
        this.edgeBaseColors[vi + 4] = domainColor.g
        this.edgeBaseColors[vi + 5] = domainColor.b
      }
    }

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))

    const mat = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.7,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })

    this.edgesMesh = new THREE.LineSegments(geo, mat)
    this.scene.add(this.edgesMesh)
    this.sceneObjects.push(this.edgesMesh)
  }

  // ─── 更新单个节点的矩阵 + 颜色 ───
  _applyNodeMatrix(index) {
    if (index < 0 || index >= this.nodes.length || !this.nodesMesh) return
    const node = this.nodes[index]
    if (!node) return

    // 大小：根据关联度
    const degree = (node.inDegree || 0) + (node.outDegree || 0) + (node._children?.length || 0)
    const size = LEAF_RADIUS + (BASE_RADIUS - LEAF_RADIUS) * Math.min(1, degree / 5)

    // 基础缩放
    let scale = size
    if (index === this.selectedIdx) {
      scale *= SELECT_SCALE
    } else if (index === this.hoveredIdx) {
      scale *= HOVER_SCALE
    } else if (this.highlightedSet.has(node.id)) {
      scale *= 1.3
    }

    // 矩阵
    this._pos.set(node.x, node.y, node.z)
    this._sca.setScalar(scale)
    this._mat4.compose(this._pos, this._quat, this._sca)
    this.nodesMesh.setMatrixAt(index, this._mat4)

    // 颜色
    this._col.set(node.color)
    const isDimmed = (this.selectedIdx >= 0 || this.highlightedSet.size > 0) &&
      index !== this.selectedIdx &&
      !this.highlightedSet.has(node.id)
    if (isDimmed) {
      this._col.multiplyScalar(DIM_OPACITY)
    } else if (index === this.selectedIdx) {
      this._col.multiplyScalar(1.8)
    } else if (this.highlightedSet.has(node.id)) {
      this._col.multiplyScalar(1.5)
    } else if (index === this.hoveredIdx) {
      this._col.multiplyScalar(1.3)
    }

    this.nodesMesh.setColorAt(index, this._col)
  }

  // ─── 批量更新所有矩阵 ───
  _applyAllMatrices() {
    for (let i = 0; i < this.nodes.length; i++) {
      this._applyNodeMatrix(i)
    }
    if (this.nodesMesh) {
      this.nodesMesh.instanceMatrix.needsUpdate = true
      this.nodesMesh.instanceColor.needsUpdate = true
    }
  }

  // ─── 选中 ───
  selectNode(index) {
    if (this.selectedIdx === index) return
    const prev = this.selectedIdx
    this.selectedIdx = index
    this._applyNodeMatrix(prev)
    this._applyNodeMatrix(index)
    this._applyEdgeHighlight()
  }

  // ─── 悬停 ───
  setHovered(index) {
    if (this.hoveredIdx === index) return
    const prev = this.hoveredIdx
    this.hoveredIdx = index
    this._applyNodeMatrix(prev)
    this._applyNodeMatrix(index)
  }

  // ─── 搜索高亮 ───
  setSearchHighlight(nodeIds) {
    this.highlightedSet.clear()
    for (const id of nodeIds) {
      const idx = this.nodeIndexMap.get(id)
      if (idx !== undefined) this.highlightedSet.add(id)
    }
    this._applyAllMatrices()
    this._applyEdgeHighlight()
  }

  clearHighlight() {
    if (this.highlightedSet.size === 0) return
    this.highlightedSet.clear()
    this._applyAllMatrices()
    this._applyEdgeHighlight()
  }

  // ─── 边高亮 ───
  _applyEdgeHighlight() {
    if (!this.edgesMesh || !this.edgeBaseColors) return

    const colorAttr = this.edgesMesh.geometry.getAttribute('color')
    const arr = colorAttr.array
    const hasSelection = this.selectedIdx >= 0 || this.highlightedSet.size > 0

    if (!hasSelection) {
      // 恢复
      arr.set(this.edgeBaseColors)
      colorAttr.needsUpdate = true
      return
    }

    // 获取选中/高亮节点关联的边索引
    const activeIds = new Set()
    if (this.selectedIdx >= 0) {
      activeIds.add(this.nodes[this.selectedIdx]?.id)
    }
    for (const id of this.highlightedSet) {
      activeIds.add(id)
    }

    const SEGMENTS = EDGE_CURVE_POINTS - 1
    const VERTS_PER_EDGE = SEGMENTS * 2

    for (let ei = 0; ei < this.flatEdges.length; ei++) {
      const edge = this.flatEdges[ei]
      const isConnected = activeIds.has(edge.source.id) || activeIds.has(edge.target.id)
      const offset = ei * VERTS_PER_EDGE * 3

      if (isConnected) {
        // 恢复或加亮
        for (let vi = 0; vi < VERTS_PER_EDGE * 3; vi++) {
          arr[offset + vi] = Math.min(1, this.edgeBaseColors[offset + vi] * 2)
        }
      } else {
        // 变暗
        for (let vi = 0; vi < VERTS_PER_EDGE * 3; vi++) {
          arr[offset + vi] = this.edgeBaseColors[offset + vi] * DIM_OPACITY
        }
      }
    }
    colorAttr.needsUpdate = true
  }

  // ─── 通用 ───
  getNode(index) {
    return this.nodes[index] || null
  }

  getNodeMesh() {
    return this.nodesMesh
  }

  getNodeCount() {
    return this.nodes.length
  }

  clearObjects() {
    for (const obj of this.sceneObjects) {
      this.scene.remove(obj)
      if (obj.geometry) obj.geometry.dispose()
      if (obj.material) obj.material.dispose()
    }
    this.sceneObjects = []
    this.nodesMesh = null
    this.edgesMesh = null
  }

  dispose() {
    this.clearObjects()
    this.sharedGeo.dispose()
  }
}
