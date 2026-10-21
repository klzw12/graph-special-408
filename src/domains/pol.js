/**
 * 🚩 考研政治 · 骨架
 * ==================
 * 这一科的"因果层"是**关系网**（隶属 / 对立 / 发展），不是演进链。
 * 骨架按四门课走，目前无内容。
 */

export default {
  root: {
    id: 'pol',
    label: '政治',
    color: '#ef4444',
    description: '马原 / 毛中特 / 史纲 / 思修与法基',
    children: [
      { id: 'pol-mayuan', label: '马克思主义基本原理', color: '#e03a3a', children: [] },
      { id: 'pol-mao', label: '毛中特', color: '#e03a3a', children: [] },
      { id: 'pol-history', label: '中国近现代史纲要', color: '#e03a3a', children: [] },
      { id: 'pol-ethics', label: '思想道德与法治', color: '#e03a3a', children: [] },
    ],
  },
  relations: [],
}
