/**
 * 📚 先导课 04 · 帧 = 分段装包
 * =============================
 * 「帧」不是高深概念：就是把一长串内容**切成一段一段，各自压缩，各自成一个独立包**。
 * 每个包开头有一小段「包头」，说明这包多大、要不要带校验和。
 *
 * 这次实验回答一个问题：为什么不像普通压缩包那样"整个文件压成一大包"？
 *
 * 运行： node tools/lesson-04-frames.mjs
 */

import zlib from 'node:zlib'

const MAGIC = Buffer.from([0x28, 0xb5, 0x2f, 0xfd])

// 造一段"像会话记录"的内容：200 条 JSON 行，彼此有点像又不太一样
const records = []
for (let i = 0; i < 200; i++) {
  records.push(JSON.stringify({ seq: i, type: i % 3 === 0 ? 'user' : 'assistant', text: `第 ${i} 条消息，内容是操作系统内存管理的讲解片段 ${i}` }))
}

const whole = Buffer.from(records.join('\n'), 'utf8')

// 方案 A：整段压成一包
const onePack = zlib.zstdCompressSync(whole)

// 方案 B：一段一个包（模拟会话文件）
const manyPacks = records.map((r) => zlib.zstdCompressSync(Buffer.from(r, 'utf8')))
const manyBuf = Buffer.concat(manyPacks)

// 数包子
function count(buf) {
  let n = 0, i = 0
  while ((i = buf.indexOf(MAGIC, i)) !== -1) { n++; i += 4 }
  return n
}

console.log('原文          :', whole.length, '字节 /', records.length, '条记录')
console.log('')
console.log('A 整段一包    :', onePack.length, '字节  包子数 =', count(onePack))
console.log('B 一条一包    :', manyBuf.length, '字节  包子数 =', count(manyBuf))
console.log('B 比 A 多     :', manyBuf.length - onePack.length, '字节（每个包都要带包头，还要牺牲跨记录重复）')

console.log('\n=== 关键差别：追加一条新记录 ===')
const next = JSON.stringify({ seq: 200, type: 'user', text: '再来一条' })
const nextPack = zlib.zstdCompressSync(Buffer.from(next, 'utf8'))
console.log('A 方案追加 : 必须把 200 条 + 新的一条**重新压缩一遍** →', zlib.zstdCompressSync(Buffer.concat([whole, Buffer.from('\n' + next)])).length, '字节')
console.log('B 方案追加 : 只需把新包**接在末尾** →', nextPack.length, '字节的增量，前面', onePack.length, '→', manyBuf.length, '字节那些包一个字节都不用动')

console.log('\n=== 关键差别：只读开头那一小条 ===')
const firstOnly = zlib.zstdDecompressSync(manyBuf.subarray(0, manyPacks[0].length)).toString('utf8')
console.log('B 方案读第 1 条 :', firstOnly)
console.log('（只解第 1 个包就够——这正是"读端单独解第一帧拿 cwd"能成立的原因）')

console.log('\n=== 代价：一个包坏了 ===')
console.log('A 方案：整包坏 → 全部读不出来')
console.log('B 方案：只有那一包坏 → 其余 199 个包完好，但**读端会直接跳过坏包继续**，不报错')
