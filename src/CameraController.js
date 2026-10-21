/**
 * 🎥 CameraController — 球坐标相机控制
 * 
 * 功能：
 * - 球坐标系统的鼠标拖拽旋转/滚轮缩放
 * - flyTo 动画（点击节点平滑移动相机）
 * - 空闲自动旋转（5 秒无操作启动）
 * - 触屏支持
 * - 右键复位视角
 */

import * as THREE from 'three'

const PI = Math.PI
const PI_2 = PI / 2

export class CameraController {
  constructor(camera, domElement) {
    this.camera = camera
    this.dom = domElement

    // 球坐标（初始值会被 fitToGraph 覆盖）
    this.spherical = new THREE.Spherical(20, PI_2, 0)
    this.targetSpherical = this.spherical.clone()
    this.orbitCenter = new THREE.Vector3(0, 0, 0)
    this.targetCenter = new THREE.Vector3(0, 0, 0)

    // 拖拽状态
    this.isDragging = false
    this.mouseDownPos = { x: 0, y: 0 }
    this.lastMouse = { x: 0, y: 0 }

    // 自动旋转
    this.autoOrbit = true
    this.autoOrbitTimeout = null
    this.autoRotateSpeed = 0.04

    // flyTo 动画
    this.isAnimating = false
    this.flyProgress = 0
    this.flyStart = { theta: 0, phi: 0, radius: 0 }
    this.flyEnd = { theta: 0, phi: 0, radius: 0 }
    this.flyCenterStart = new THREE.Vector3()
    this.flyCenterEnd = new THREE.Vector3()
    this.flyStartTime = 0
    this.flyDuration = 0.8
    this.flyCallback = null
    this.flyTargetNode = null // 记住目标节点，供右键复位

    // 边界
    this.minRadius = 3
    this.maxRadius = 200
    this.minPhi = 0.1
    this.maxPhi = PI - 0.1

    // 全景视角参数（右键双击恢复）
    this._defaultRadius = 20
    this._defaultCenter = new THREE.Vector3(0, 0, 0)

    this._bindEvents()
    this._updateCamera()
  }

  _bindEvents() {
    const el = this.dom
    el.addEventListener('mousedown', (e) => this._onMouseDown(e))
    el.addEventListener('mousemove', (e) => this._onMouseMove(e))
    el.addEventListener('mouseup', (e) => this._onMouseUp(e))
    el.addEventListener('wheel', (e) => this._onWheel(e), { passive: false })
    el.addEventListener('contextmenu', (e) => { e.preventDefault(); this.resetFullView() })

    // 触屏
    el.addEventListener('touchstart', (e) => this._onTouchStart(e), { passive: false })
    el.addEventListener('touchmove', (e) => this._onTouchMove(e), { passive: false })
    el.addEventListener('touchend', (e) => this._onTouchEnd(e), { passive: false })
  }

  _onMouseDown(e) {
    // 忽略右键
    if (e.button === 2) return
    this.isDragging = true
    this.mouseDownPos = { x: e.clientX, y: e.clientY }
    this.lastMouse = { x: e.clientX, y: e.clientY }
    this.autoOrbit = false
    this._clearAutoOrbitTimeout()
  }

  _onMouseMove(e) {
    if (this.isDragging) {
      const dx = e.clientX - this.lastMouse.x
      const dy = e.clientY - this.lastMouse.y
      this.lastMouse = { x: e.clientX, y: e.clientY }
      this.targetSpherical.theta -= dx * 0.006
      this.targetSpherical.phi = Math.max(this.minPhi, Math.min(this.maxPhi, this.targetSpherical.phi - dy * 0.006))
    }
  }

  _onMouseUp(e) {
    if (e.button === 2) return
    this.isDragging = false
    const dist = Math.abs(e.clientX - this.mouseDownPos.x) + Math.abs(e.clientY - this.mouseDownPos.y)
    if (dist < 5 && this._onClick) {
      this._onClick(e)
    }
    this._scheduleAutoOrbit()
  }

  _onWheel(e) {
    e.preventDefault()
    const factor = e.deltaY > 0 ? 1.15 : 0.85
    this.targetSpherical.radius = Math.max(this.minRadius, Math.min(this.maxRadius, this.targetSpherical.radius * factor))
    this._scheduleAutoOrbit()
  }

  _onTouchStart(e) {
    e.preventDefault()
    if (e.touches.length === 1) {
      const t = e.touches[0]
      this.isDragging = true
      this.lastMouse = { x: t.clientX, y: t.clientY }
      this.autoOrbit = false
      this._clearAutoOrbitTimeout()
    }
  }

  _onTouchMove(e) {
    e.preventDefault()
    if (e.touches.length === 1 && this.isDragging) {
      const t = e.touches[0]
      const dx = t.clientX - this.lastMouse.x
      const dy = t.clientY - this.lastMouse.y
      this.lastMouse = { x: t.clientX, y: t.clientY }
      this.targetSpherical.theta -= dx * 0.008
      this.targetSpherical.phi = Math.max(this.minPhi, Math.min(this.maxPhi, this.targetSpherical.phi - dy * 0.008))
    } else if (e.touches.length === 2) {
      const t0 = e.touches[0], t1 = e.touches[1]
      const dist = Math.sqrt((t0.clientX - t1.clientX) ** 2 + (t0.clientY - t1.clientY) ** 2)
      if (this._lastTouchDist) {
        const factor = this._lastTouchDist / dist
        this.targetSpherical.radius = Math.max(this.minRadius, Math.min(this.maxRadius, this.targetSpherical.radius * factor))
      }
      this._lastTouchDist = dist
    }
  }

  _onTouchEnd(e) {
    e.preventDefault()
    this.isDragging = false
    this._lastTouchDist = 0
    this._scheduleAutoOrbit()
  }

  // ─── 自动适配全图 ───
  fitToGraph(nodes, padding = 0.6) {
    if (nodes.length === 0) return

    // 计算包围盒
    const box = new THREE.Box3()
    for (const n of nodes) {
      box.expandByPoint(new THREE.Vector3(n.x, n.y, n.z))
    }
    const size = box.getSize(new THREE.Vector3())
    const center = box.getCenter(new THREE.Vector3())
    const maxDim = Math.max(size.x, size.y, size.z)

    // 相机距离 = 最大维度 / tan(FOV/2) + padding
    const fov = this.camera.fov * PI / 180
    const radius = (maxDim / 2) / Math.tan(fov / 2) * (1 + padding)

    this._defaultRadius = radius
    this._defaultCenter.copy(center)

    this.targetSpherical.radius = radius
    this.targetSpherical.phi = PI_2 * 0.7  // 略微俯视
    this.targetSpherical.theta = -0.5
    this.targetCenter.copy(center)

    this.spherical.radius = radius
    this.spherical.phi = PI_2 * 0.7
    this.spherical.theta = -0.5
    this.orbitCenter.copy(center)

    this._updateCamera()
  }

  // ─── flyTo 动画（固定距离） ───
  flyToNode(node, callback) {
    if (!node) return
    this.isAnimating = false

    const target = new THREE.Vector3(node.x, node.y, node.z)

    // 固定观察距离（跟图的大小成正比，但最小6最大15）
    const baseRadius = Math.min(15, Math.max(6, this._defaultRadius * 0.35))
    const newSpherical = new THREE.Spherical(baseRadius, PI_2 * 0.6, this.spherical.theta)

    this.flyTargetNode = node
    this.flyCenterStart.copy(this.orbitCenter)
    this.flyCenterEnd.copy(target)
    this.flyStart.theta = this.spherical.theta
    this.flyStart.phi = this.spherical.phi
    this.flyStart.radius = this.spherical.radius
    this.flyEnd.theta = newSpherical.theta
    this.flyEnd.phi = newSpherical.phi
    this.flyEnd.radius = newSpherical.radius

    this.isAnimating = true
    this.flyStartTime = performance.now()
    this.flyCallback = callback || null
    this.autoOrbit = false
    this._clearAutoOrbitTimeout()
  }

  // ─── 复位到全景（右键） ───
  resetFullView() {
    if (this.isAnimating) {
      this.flyCallback = null
      this.isAnimating = false
    }
    // 直接用 fit 的参数飞回去
    this.flyCenterStart.copy(this.orbitCenter)
    this.flyCenterEnd.copy(this._defaultCenter)
    this.flyStart.theta = this.spherical.theta
    this.flyStart.phi = this.spherical.phi
    this.flyStart.radius = this.spherical.radius
    this.flyEnd.theta = -0.5
    this.flyEnd.phi = PI_2 * 0.7
    this.flyEnd.radius = this._defaultRadius

    this.flyTargetNode = null
    this.isAnimating = true
    this.flyStartTime = performance.now()
    this.flyCallback = null
    this.autoOrbit = false
    this._scheduleAutoOrbit()
  }

  _updateFlyAnimation(now) {
    if (!this.isAnimating) return

    const t = Math.min(1, (now - this.flyStartTime) / (this.flyDuration * 1000))
    const ease = 1 - Math.pow(1 - t, 3)

    this.spherical.theta = this.flyStart.theta + (this.flyEnd.theta - this.flyStart.theta) * ease
    this.spherical.phi = this.flyStart.phi + (this.flyEnd.phi - this.flyStart.phi) * ease
    this.spherical.radius = this.flyStart.radius + (this.flyEnd.radius - this.flyStart.radius) * ease
    this.orbitCenter.lerpVectors(this.flyCenterStart, this.flyCenterEnd, ease)

    // 同步 target
    this.targetSpherical.copy(this.spherical)
    this.targetCenter.copy(this.orbitCenter)

    if (t >= 1) {
      this.isAnimating = false
      if (this.flyCallback) {
        this.flyCallback()
        this.flyCallback = null
      }
      this._scheduleAutoOrbit()
    }
  }

  // ─── 自动旋转 ───
  _scheduleAutoOrbit() {
    this._clearAutoOrbitTimeout()
    this.autoOrbitTimeout = setTimeout(() => {
      this.autoOrbit = true
    }, 5000)
  }

  _clearAutoOrbitTimeout() {
    if (this.autoOrbitTimeout) {
      clearTimeout(this.autoOrbitTimeout)
      this.autoOrbitTimeout = null
    }
  }

  // ─── 每帧更新 ───
  update(now) {
    this._updateFlyAnimation(now)

    // 自动旋转
    if (this.autoOrbit && !this.isAnimating) {
      this.targetSpherical.theta += this.autoRotateSpeed * 0.016
    }

    // 平滑插值
    if (!this.isAnimating) {
      this.spherical.theta += (this.targetSpherical.theta - this.spherical.theta) * 0.08
      this.spherical.phi += (this.targetSpherical.phi - this.spherical.phi) * 0.08
      this.spherical.radius += (this.targetSpherical.radius - this.spherical.radius) * 0.1
      this.orbitCenter.lerp(this.targetCenter, 0.08)
    }

    this._updateCamera()
  }

  _updateCamera() {
    const pos = new THREE.Vector3().setFromSpherical(this.spherical)
    pos.add(this.orbitCenter)
    this.camera.position.copy(pos)
    this.camera.lookAt(this.orbitCenter)
  }

  // ─── 事件回调注册 ───
  onClick(cb) { this._onClick = cb }
  onDblClick(cb) { this._onDblClick = cb }

  dispose() {
    this._clearAutoOrbitTimeout()
  }
}
