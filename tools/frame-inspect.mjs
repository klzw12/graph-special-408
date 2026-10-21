/**
 * 🔬 会话文件帧结构探测器（排查用）
 * ==================================
 * 目的：不猜、不整解整压，先用**消费方的规则**把文件看清楚。
 *
 * zstd 帧头（RFC 8878 §3.1.1）：
 *   magic(4) | FHD(1) | [Window_Descriptor(1) 若单段标志=0] | [Dictionary_ID] | [Frame_Content_Size]
 *
 * FHD 位（从低到高）：
 *   bit0-1  Frame_Content_Size_flag
 *   bit2    Single_Segment_flag
 *   bit3    Unused
 *   bit4    Reserved
 *   bit5    Content_Checksum_flag   ← DSH 读端校验 XXH64，这里必须为 1
 *   bit6    Dictionary_ID_flag
 *
 * 用法：node tools/frame-inspect.mjs <file.zstd>
 */

import fs from 'node:fs'
import zlib from 'node:zlib'

const MAGIC = Buffer.from([0x28, 0xb5, 0x2f, 0xfd])

function splitFrames(buf) {
  const starts = []
  let i = 0
  while ((i = buf.indexOf(MAGIC, i)) !== -1) {
    starts.push(i)
    i += 4
  }
  starts.push(buf.length)
  return starts.slice(0, -1).map((s, k) => ({ offset: s, buf: buf.subarray(s, starts[k + 1]) }))
}

const file = process.argv[2]
if (!file) {
  console.log('usage: node tools/frame-inspect.mjs <file.zstd>')
  process.exit(1)
}

const raw = fs.readFileSync(file)
const frames = splitFrames(raw)
console.log(`文件: ${file}`)
console.log(`大小: ${raw.length} bytes`)
console.log(`帧数: ${frames.length}`)
console.log('')
console.log('idx  offset   bytes  checksum  singleSeg  contentSizeFlag')
frames.slice(0, 5).forEach((f, i) => {
  const fhd = f.buf[4]
  const checksum = (fhd >> 5) & 1
  const singleSeg = (fhd >> 2) & 1
  const csFlag = fhd & 3
  console.log(
    String(i).padEnd(4),
    String(f.offset).padEnd(8),
    String(f.buf.length).padEnd(6),
    String(checksum).padEnd(9),
    String(singleSeg).padEnd(10),
    csFlag
  )
})

// 第 1 帧的三条硬性约定（DSH 读端假设）
const f0 = zlib.zstdDecompressSync(frames[0].buf).toString('utf8')
const lines = f0.split('\n')
console.log('')
console.log('=== 第 1 帧（header）体检 ===')
console.log(`解压后字节: ${Buffer.byteLength(f0)}`)
console.log(`行数(按 \\n 切): ${lines.length}${lines[lines.length - 1] === '' ? '（末行为空，即恰好以换行结尾）' : '（末行非空，没有结尾换行）'}`)
console.log(`内容长度: ${f0.trimEnd().length} 字符`)
console.log(`checksum 标志: ${((frames[0].buf[4] >> 5) & 1) ? '✅ 有（XXH64）' : '❌ 无 → 读端可能整帧拒收'}`)
console.log(`首 160 字符: ${f0.slice(0, 160)}`)

// 统计所有帧是否都带 checksum
const noChecksum = frames.filter((f) => !((f.buf[4] >> 5) & 1)).length
console.log('')
console.log(`全文件中缺 checksum 的帧: ${noChecksum} / ${frames.length}`)
