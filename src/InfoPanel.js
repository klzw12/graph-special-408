/**
 * 节点详情面板 — 显示节点信息、子节点、交叉关联
 */
export class InfoPanel {
  constructor() {
    this.panel = document.getElementById('info-panel')
    this.label = document.getElementById('info-panel-label')
    this.desc = document.getElementById('info-panel-description')
    this.content = document.getElementById('info-panel-content')
    this.connections = document.getElementById('info-panel-connections')
    this.urlLink = document.getElementById('info-panel-url')
    this.closeBtn = document.getElementById('info-panel-close')
    this.closeBtn.addEventListener('click', () => this.hide())
    this._relations = [] // set from outside
    this._allNodes = new Map()
  }

  setRelations(relations) { this._relations = relations || [] }
  setNodeMap(m) { this._allNodes = m }

  show(nodeData) {
    if (!nodeData) { this.hide(); return }

    const icon = nodeData._depth === 0 ? '🌳' : (!nodeData._children || nodeData._children.length === 0) ? '📄' : '📂'
    this.label.textContent = `${icon} ${nodeData.label}`
    this.desc.textContent = nodeData.description || ''

    // Content
    this.content.innerHTML = ''
    if (nodeData.content) {
      const p = document.createElement('p')
      p.className = 'info-summary'
      p.textContent = nodeData.content.summary || ''
      this.content.appendChild(p)
      if (nodeData.content.tags) {
        const tags = document.createElement('div')
        tags.className = 'info-tags'
        nodeData.content.tags.forEach(t => {
          const s = document.createElement('span')
          s.className = 'info-tag'
          s.textContent = t
          tags.appendChild(s)
        })
        this.content.appendChild(tags)
      }
    }

    // Connections section
    this.connections.innerHTML = ''

    // Tree children
    if (nodeData._children && nodeData._children.length > 0) {
      const title = document.createElement('div')
      title.className = 'info-subtitle'
      title.textContent = `📂 子节点 (${nodeData._children.length})`
      this.connections.appendChild(title)
      const list = document.createElement('div')
      list.className = 'info-conn-list'
      nodeData._children.forEach(cid => {
        const child = this._allNodes.get(cid)
        if (!child) return
        const item = document.createElement('a')
        item.className = 'info-conn-link'
        item.href = '#'
        item.innerHTML = `<span class="conn-dot" style="background:${child.color}"></span><span class="conn-label">${child.label}</span>`
        item.addEventListener('click', (e) => { e.preventDefault()
          document.dispatchEvent(new CustomEvent('kg:focus', { detail: { nodeId: cid } })) })
        list.appendChild(item)
      })
      this.connections.appendChild(list)
    }

    // Cross relations
    const crossRels = this._relations.filter(r => r.source === nodeData.id || r.target === nodeData.id)
    if (crossRels.length > 0) {
      const title = document.createElement('div')
      title.className = 'info-subtitle'
      title.innerHTML = `🔗 交叉关联 (${crossRels.length}) <span class="info-badge">跨域</span>`
      this.connections.appendChild(title)
      const list = document.createElement('div')
      list.className = 'info-conn-list'
      crossRels.forEach(r => {
        const otherId = r.source === nodeData.id ? r.target : r.source
        const other = this._allNodes.get(otherId)
        if (!other) return
        const dir = r.source === nodeData.id ? '→' : '←'
        const item = document.createElement('a')
        item.className = 'info-conn-link cross'
        item.href = '#'
        item.innerHTML = `
          <span class="conn-dot" style="background:${other.color}"></span>
          <span class="conn-label">${other.label}</span>
          <span class="conn-relation">${dir} ${r.label || '—'}</span>
        `
        item.addEventListener('click', (e) => { e.preventDefault()
          document.dispatchEvent(new CustomEvent('kg:focus', { detail: { nodeId: otherId } })) })
        list.appendChild(item)
      })
      this.connections.appendChild(list)
    }

    // Parent
    if (nodeData._parentId) {
      const parent = this._allNodes.get(nodeData._parentId)
      if (parent) {
        const title = document.createElement('div')
        title.className = 'info-subtitle'
        title.textContent = '⬆ 所属'
        this.connections.appendChild(title)
        const item = document.createElement('a')
        item.className = 'info-conn-link'
        item.href = '#'
        item.innerHTML = `<span class="conn-dot" style="background:${parent.color}"></span><span class="conn-label">${parent.label}</span>`
        item.addEventListener('click', (e) => { e.preventDefault()
          document.dispatchEvent(new CustomEvent('kg:focus', { detail: { nodeId: parent.id } })) })
        this.connections.appendChild(item)
      }
    }

    // If no connections at all
    if (!nodeData._children && crossRels.length === 0 && !nodeData._parentId) {
      const empty = document.createElement('div')
      empty.className = 'info-subtitle'
      empty.textContent = '暂无关联'
      this.connections.appendChild(empty)
    }

    // URL
    if (nodeData.url) {
      this.urlLink.href = nodeData.url
      this.urlLink.classList.remove('hidden')
    } else {
      this.urlLink.classList.add('hidden')
    }

    this.panel.classList.remove('hidden')
  }

  hide() {
    this.panel.classList.add('hidden')
  }
}
