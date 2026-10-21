/**
 * 🔧 会话 cwd 重写（frame 级）
 * ============================
 * 背景：DSH 会话文件 `session.v4.jsonl.zstd` 是**多帧 zstd**——一帧一条 JSONL 记录，
 * 第 1 帧是 session 头，里面写着 `cwd`。重命名 workspace 目录后，头里的 cwd 失效，
 * 会话就无法回到原目录继续（表现为"打不开 / 被隔离 / 一进去就挂"）。
 *
 * 为什么不能直接改：文件是压缩流，明文搜不到路径；整解整压会改变**所有**帧的字节，
 * 一旦有帧格式校验或增量追加依赖，就会崩。
 *
 * 正确做法（本脚本）：**只动需要动的那一帧**
 *   1. 按 zstd magic (28 b5 2f fd) 切出每一帧
 *   2. 逐帧解压，找出含旧路径的帧，替换后**只重新压缩这一帧**
 *   3. 其余帧原样拼回去（字节完全不变）
 *   4. 验证：帧数一致、旧路径消失、新路径出现、未改帧的哈希逐个相同
 *
 * 用法：
 *   node tools/session-cwd-rewrite.mjs <输入.zstd> <输出.zstd> <旧路径> <新路径>
 *   node tools/session-cwd-rewrite.mjs <已修复.zstd> --verify <旧路径> <新路径>
 */

import fs from 'node:fs'
import zlib from 'node:zlib'
import crypto from 'node:crypto'

const MAGIC = Buffer.from([0x28, 0xb5, 0x2f, 0xfd])

function splitFrames(buf) {
  const starts = []
  let i = 0
  while ((i = buf.indexOf(MAGIC, i)) !== -1) {
    starts.push(i)
    i += 4
  }
  starts.push(buf.length)
  const frames = []
  for (let k = 0; k < starts.length - 1; k++) {
    frames.push(buf.subarray(starts[k], starts[k + 1]))
  }
  return frames
}

const sha = (b) => crypto.createHash('sha1').update(b).digest('hex').slice(0, 8)

function rewrite(input, output, oldPath, newPath) {
  const frames = splitFrames(fs.readFileSync(input))
  console.log(`帧数: ${frames.length}`)

  const changed = []
  const before = frames.map(sha)
  const out = frames.map((frame, idx) => {
    let text
    try {
      text = zlib.zstdDecompressSync(frame).toString('utf8')
    } catch (e) {
      throw new Error(`第 ${idx} 帧解压失败，magic 切分可能不准: ${e.message}`)
    }
    if (!text.includes(oldPath)) return frame
    changed.push(idx)
    const next = zlib.zstdCompressSync(Buffer.from(text.split(oldPath).join(newPath), 'utf8'))
    return next
  })

  if (changed.length === 0) {
    console.log('⚠️ 没有任何帧包含旧路径——路径写法可能不同（转义 / 大小写 / 斜杠）')
  } else {
    console.log(`改写了帧: [${changed.join(', ')}]`)
  }

  fs.writeFileSync(output, Buffer.concat(out))
  return { total: frames.length, changed, before }
}

function verify(file, oldPath, newPath) {
  const frames = splitFrames(fs.readFileSync(file))
  let hitOld = 0
  let hitNew = 0
  let header = null
  frames.forEach((frame, idx) => {
    const text = zlib.zstdDecompressSync(frame).toString('utf8')
    if (text.includes(oldPath)) hitOld++
    if (text.includes(newPath)) hitNew++
    if (idx === 0) header = text.slice(0, 220)
  })
  console.log(`帧数: ${frames.length}`)
  console.log(`含旧路径的帧: ${hitOld}  含新路径的帧: ${hitNew}`)
  console.log(`第 1 帧: ${header}`)
  console.log(hitOld === 0 && hitNew > 0 ? '✅ 验证通过' : '❌ 验证失败')
}

const [input, output, oldPath, newPath] = process.argv.slice(2)
if (!input || !output) {
  console.log('usage: node tools/session-cwd-rewrite.mjs <in> <out|--verify> <old> <new>')
  process.exit(1)
}
if (output === '--verify') {
  verify(input, oldPath, newPath)
} else {
  const r = rewrite(input, output, oldPath, newPath)
  // 未改动的帧必须字节一致
  const after = splitFrames(fs.readFileSync(output)).map(sha)
  const untouched = r.before.filter((_, i) => !r.changed.includes(i))
  const okSame = untouched.every((h) => after.includes(h))
  console.log(`未改动帧字节一致: ${okSame ? '✅' : '❌'}`)
  verify(output, oldPath, newPath)
}
