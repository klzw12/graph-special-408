/**
 * 🔍 SearchUI — 搜索面板 + 快速 Domain 导航
 */

export class SearchUI {
  /**
   * @param {Array} nodes - 所有节点
   * @param {object} opts - 回调
   * @param {Function} opts.onHighlight - (matchedIds) => void
   * @param {Function} opts.onSelect - (node) => void
   * @param {Function} opts.onDomainSelect - (domainId) => void 点击 domain chip
   * @param {Array} domains - [{id, label, color}] 要显示的 domain 列表
   * @param {HTMLElement} container
   */
  constructor(nodes, opts, domains, searchContainer, domainContainer) {
    this.nodes = nodes
    this._onHighlight = opts.onHighlight
    this._onSelect = opts.onSelect
    this._onDomainSelect = opts.onDomainSelect
    this._domains = domains || []
    this._lastResults = []
    this._activeDomain = null

    this._build(searchContainer, domainContainer)
  }

  _build(searchContainer, domainContainer) {
    this.wrapper = document.createElement('div')
    this.wrapper.id = 'search-wrap'

    // ── 输入栏 ──
    const row = document.createElement('div')
    row.id = 'search-row'
    this.input = document.createElement('input')
    this.input.id = 'search-input'
    this.input.type = 'text'
    this.input.placeholder = '🔍 搜索节点...'
    this.count = document.createElement('span')
    this.count.id = 'search-count'
    this.clear = document.createElement('button')
    this.clear.id = 'search-clear'
    this.clear.textContent = '✕'
    this.clear.style.display = 'none'
    row.appendChild(this.input)
    row.appendChild(this.count)
    row.appendChild(this.clear)
    this.wrapper.appendChild(row)

    // 结果列表
    this.results = document.createElement('div')
    this.results.id = 'search-results'
    this.results.style.display = 'none'
    this.wrapper.appendChild(this.results)

    searchContainer.appendChild(this.wrapper)

    // ── Domain 快速导航（两级） ──
    this.domainBar = document.createElement('div')
    this.domainBar.id = 'domain-bar'

    // L1 列
    this.l1Col = document.createElement('div')
    this.l1Col.id = 'domain-l1'
    for (const d of this._domains) {
      const chip = document.createElement('span')
      chip.className = 'domain-chip l1'
      chip.dataset.domain = d.id
      const arrow = d.children && d.children.length > 0 ? '<span class="d-arrow">▸</span>' : ''
      chip.innerHTML = `<span class="domain-dot" style="background:${d.color}"></span>${d.label}${arrow}`
      chip.addEventListener('click', () => this._selectL1(d))
      this.l1Col.appendChild(chip)
    }
    this.domainBar.appendChild(this.l1Col)

    // L2 列（动态显隐）
    this.l2Col = document.createElement('div')
    this.l2Col.id = 'domain-l2'
    this.l2Col.style.display = 'none'
    this.domainBar.appendChild(this.l2Col)

    domainContainer.appendChild(this.domainBar)

    this._bindEvents()
  }

  _bindEvents() {
    let debounceTimer = null
    this.input.addEventListener('input', () => {
      clearTimeout(debounceTimer)
      debounceTimer = setTimeout(() => this._search(), 120)
    })
    this.input.addEventListener('focus', () => {
      if (this._lastResults.length > 0) this.results.style.display = 'block'
    })
    document.addEventListener('click', (e) => {
      if (!this.wrapper.contains(e.target)) this.results.style.display = 'none'
    })
    this.input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { this.clearSearch(); this.results.style.display = 'none'; return }
      if (e.key === 'Enter') {
        this.results.style.display = 'none'
        const firstId = this._lastResults[0]
        if (firstId) {
          const node = this.nodes.find(n => n.id === firstId)
          if (node && this._onSelect) this._onSelect(node)
        }
      }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        const items = this.results.querySelectorAll('.search-result-item')
        if (!items.length) return
        const active = this.results.querySelector('.search-result-item.active')
        let idx = Array.from(items).indexOf(active)
        idx = e.key === 'ArrowDown' ? Math.min(idx + 1, items.length - 1) : Math.max(idx - 1, 0)
        items.forEach(el => el.classList.remove('active'))
        items[idx].classList.add('active')
        items[idx].scrollIntoView({ block: 'nearest' })
      }
    })
    this.clear.addEventListener('click', () => this.clearSearch())
  }

  _selectL1(domain) {
    // toggle: 再次点击同个 L1 取消
    if (this._activeL1 === domain.id) {
      this._clearDomains()
      return
    }
    this._activeL1 = domain.id
    this._activeL2 = null

    // L1 高亮
    this.l1Col.querySelectorAll('.domain-chip').forEach(c => c.classList.remove('active'))
    this.l1Col.querySelector(`[data-domain="${domain.id}"]`)?.classList.add('active')

    // L2 列
    this.l2Col.innerHTML = ''
    if (domain.children && domain.children.length > 0) {
      for (const sub of domain.children) {
        const chip = document.createElement('span')
        chip.className = 'domain-chip l2'
        chip.dataset.domain = sub.id
        chip.innerHTML = `<span class="domain-dot" style="background:${domain.color}"></span>${sub.label}`
        chip.addEventListener('click', (e) => {
          e.stopPropagation()
          this._selectL2(sub.id, domain)
        })
        this.l2Col.appendChild(chip)
      }
      this.l2Col.style.display = 'flex'
    } else {
      this.l2Col.style.display = 'none'
    }

    // 高亮该 domain 所有节点
    const matched = this.nodes.filter(n => n._parentDomain === domain.id || n.id === domain.id)
    if (this._onHighlight) this._onHighlight(matched.map(n => n.id))
    if (this._onDomainSelect) this._onDomainSelect(domain.id)
  }

  _selectL2(subId, parent) {
    if (this._activeL2 === subId) return
    this._activeL2 = subId

    this.l2Col.querySelectorAll('.domain-chip').forEach(c => c.classList.remove('active'))
    this.l2Col.querySelector(`[data-domain="${subId}"]`)?.classList.add('active')

    const matched = this.nodes.filter(n => n._parentDomain === subId || n.id === subId)
    if (this._onHighlight) this._onHighlight(matched.map(n => n.id))
    if (this._onDomainSelect) this._onDomainSelect(subId)
  }

  _clearDomains() {
    this._activeL1 = null
    this._activeL2 = null
    this.l1Col.querySelectorAll('.domain-chip').forEach(c => c.classList.remove('active'))
    this.l2Col.innerHTML = ''
    this.l2Col.style.display = 'none'
    if (this._onHighlight) this._onHighlight([])
    if (this._onDomainSelect) this._onDomainSelect(null)
  }

  _search() {
    const q = this.input.value.trim().toLowerCase()
    if (!q) { this._clearResults(); return }

    const results = this.nodes.filter(n => {
      const label = (n.label || '').toLowerCase()
      const desc = (n.description || '').toLowerCase()
      const id = (n.id || '').toLowerCase()
      return label.includes(q) || desc.includes(q) || id.includes(q)
    })
    this._lastResults = results.map(n => n.id)
    this.count.textContent = ` ${results.length} 个`
    this.count.style.display = results.length > 0 ? 'inline' : 'none'
    this.clear.style.display = 'inline'

    if (this._onHighlight) this._onHighlight(this._lastResults)
    this._renderResults(results, q)
  }

  _renderResults(results, query) {
    this.results.innerHTML = ''
    if (results.length === 0) { this.results.style.display = 'none'; return }

    const shown = results.slice(0, 20)
    for (const node of shown) {
      const item = document.createElement('div')
      item.className = 'search-result-item'
      const label = node.label || node.id
      const idx = label.toLowerCase().indexOf(query)
      let displayLabel = label
      if (idx >= 0) {
        displayLabel = label.slice(0, idx) +
          '<mark>' + label.slice(idx, idx + query.length) + '</mark>' +
          label.slice(idx + query.length)
      }
      const depth = node._depth || 0
      const icon = depth === 0 ? '🌳' : (node._children?.length > 0 ? '📂' : '📄')
      item.innerHTML = `
        <span class="sri-icon">${icon}</span>
        <span class="sri-label">${displayLabel}</span>
        <span class="sri-path" style="color:${node.color}">●</span>
      `
      item.addEventListener('click', () => { this.results.style.display = 'none'; if (this._onSelect) this._onSelect(node) })
      item.addEventListener('mouseenter', () => {
        this.results.querySelectorAll('.search-result-item.active').forEach(el => el.classList.remove('active'))
        item.classList.add('active')
      })
      this.results.appendChild(item)
    }
    if (results.length > 20) {
      const more = document.createElement('div')
      more.className = 'search-result-more'
      more.textContent = `⋯ 还有 ${results.length - 20} 个匹配`
      this.results.appendChild(more)
    }
    const first = this.results.querySelector('.search-result-item')
    if (first) first.classList.add('active')
    this.results.style.display = 'block'
  }

  _clearResults() {
    this.count.textContent = ''
    this.count.style.display = 'none'
    this.clear.style.display = 'none'
    this.results.innerHTML = ''
    this.results.style.display = 'none'
    this._lastResults = []
    if (this._onHighlight) this._onHighlight([])
  }

  clearSearch() {
    this.input.value = ''
    this._clearResults()
    this._clearDomains()
    this.input.focus()
  }

  clearDomainFilter() {
    this._clearDomains()
  }

  setNodes(nodes) { this.nodes = nodes }
  focus() { this.input.focus() }
}
