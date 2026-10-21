/**
 * 🧠 操作系统 · 内存管理（MVP 第一条链）
 * ======================================
 * 节点 id 与 408/index.json 的章号一一对应：
 *   3.1.2 连续分配 → 033_PartitionAlloc / 034_FitAlgo
 *   3.1.3 基本分页 → 035_Paging / 036_TLB
 *   3.2.1 虚拟内存 → 038_VMConcept
 *   3.2.2 请求分页 → 039_ReqPaging
 *   3.2.4 页面置换 → 041_Replacement
 *
 * 每个节点必须填满 content.chain 三段：
 *   problem    它解决的具体缺陷（必须是上一节留下的）
 *   solution   一句话说清怎么做（谁负责、靠什么零件）
 *   newProblem 本方案独有的新问题（不能是上一节也有的）
 * 填不满的节点不要建 —— 空节点就是假因果的入口。
 */

export default {
  root: {
    id: '408-os',
    label: '操作系统',
    color: '#2f7ed8',
    description: '资源管理：处理机 / 内存 / 文件 / 设备',
    children: [
      {
        id: '408-os-mem',
        label: '第 3 章 内存管理',
        color: '#3a8ee6',
        description: '3.1 基础与连续分配 → 3.2 虚拟内存',
        children: [
          {
            id: '408-os-mem-partition',
            label: '3.1.2 连续分配',
            color: '#4d96ff',
            description: '把内存切成块，整块分给进程',
            content: {
              summary:
                'Contiguous Allocation — 进程占一段连续物理内存；动态分区按需切块。',
              chain: {
                problem: '内存要被多个进程共享，但进程事先不知道自己需要多少；整块分配又省掉了地址翻译',
                solution: '把内存切成分区，按进程大小找一个足够大的空闲洞给它；地址 = 起始地址 + 偏移',
                newProblem:
                  '空闲区被切成小洞：总量够、连续块不够（外部碎片），任何分配算法都救不了',
              },
              tags: ['OS', '3.1'],
            },
          },
          {
            id: '408-os-mem-basic-paging',
            label: '3.1.3 基本分页',
            color: '#5aa2ff',
            description: '物理内存切页框，进程切页，页表负责映射',
            content: {
              summary:
                'Basic Paging — 把连续分配换成离散分配 + 页表，用逻辑连续掩盖物理离散。',
              chain: {
                problem: '连续分配留下外部碎片：空闲 20KB（两段各 10KB），一个要 15KB 的进程装不进去',
                solution:
                  '物理内存切成固定大小的页框、进程切成同样大小的页；页可散落在任意空闲页框，页表把"离散"翻译成"连续"',
                newProblem:
                  '每次访存都要查一次页表 → 访存次数翻倍；且单级页表在 32 位地址空间下过大 → 多级页表 + 快表',
              },
              tags: ['OS', '3.1'],
            },
          },
          {
            id: '408-os-mem-vm',
            label: '3.2.1 虚拟内存',
            color: '#4a9eff',
            description: '给进程一个"独享大内存"的假象',
            content: {
              summary:
                'Virtual Memory — 只把当前用到的部分放内存，其余留在磁盘，进程看到连续的地址空间。',
              chain: {
                problem:
                  '基本分页要求进程全部装入内存；程序比物理内存大时根本跑不起来，多道程序也挤不下',
                solution:
                  '给每个进程一个独立的地址空间，只把当前用到的页放在内存，其余留在磁盘上——按需在两者间搬运',
                newProblem:
                  '这只是一个"能做到"的目标，还没有机制：谁来发现某页不在内存？谁负责把它搬进来、把别的页搬出去？',
              },
              tags: ['OS', '3.2'],
            },
          },
          {
            id: '408-os-mem-demand-paging',
            label: '3.2.2 请求分页',
            color: '#3f95f5',
            description: '部分装入 + 缺页中断：访问到才调入',
            content: {
              summary:
                'Demand Paging — 虚拟内存的实现手段：有效位负责"发现"，缺页中断负责"取回"。',
              chain: {
                problem:
                  '基本分页要求进程全部装入内存；大量页运行中访问极少却长期占位；进程大于物理内存时根本装不进来',
                solution:
                  '部分装入：访问到某页时才调入。页表项的有效位负责"发现"这一页不在内存，缺页中断负责去磁盘取回',
                newProblem:
                  '内存终会满：调入新页前必须先淘汰一页。淘汰谁没有天然依据，选错会让刚淘汰的页立刻又被访问，反复缺页',
              },
              tags: ['OS', '3.2'],
            },
          },
          {
            id: '408-os-mem-replacement',
            label: '3.2.4 页面置换',
            color: '#3588e0',
            description: 'OPT / FIFO / LRU / Clock —— 内存满时换谁出去',
            content: {
              summary:
                'Page Replacement — 淘汰依据有三类：看未来（OPT）、看过去（LRU）、看进入顺序（FIFO）。',
              chain: {
                problem: '内存满时调入新页必须先淘汰一页；没有依据地换，会把正在用的页换出去',
                solution:
                  '用可观测的替代信息估算"未来最不可能再用"：OPT 看未来（不可实现，作为下界）、LRU 看最近使用、FIFO 看进入时间、Clock 用访问位近似 LRU',
                newProblem:
                  '置换策略再好也挡不住"驻留页框太少"：分配给进程的页框数小于它真正的工作集时，缺页率会飙升（抖动）',
              },
              tags: ['OS', '3.2'],
            },
          },
        ],
      },
    ],
  },

  relations: [
    {
      source: '408-os-mem-partition',
      target: '408-os-mem-basic-paging',
      label: '外部碎片·装不进 → 离散分配',
      color: '#ff9f43',
    },
    {
      source: '408-os-mem-basic-paging',
      target: '408-os-mem-vm',
      label: '必须全部装入 → 部分装入',
      color: '#ff9f43',
    },
    {
      source: '408-os-mem-vm',
      target: '408-os-mem-demand-paging',
      label: '只有目标·缺机制 → 调页+缺页中断',
      color: '#ff9f43',
    },
    {
      source: '408-os-mem-demand-paging',
      target: '408-os-mem-replacement',
      label: '内存满·淘汰谁 → 置换算法',
      color: '#ff9f43',
    },
  ],
}
