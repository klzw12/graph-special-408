/**
 * 📚 先导课 02 · 校验和的两个层面
 * =================================
 * 目的：把上一轮的混乱拆开
 *   ① 开关（Content_Checksum_flag）：写端决定「这帧要不要带指纹」，1 个比特，固定
 *   ② 值（XXH64，4 字节，贴在帧尾）：由数据算出，数据变它就变
 *
 * 验证方法：同一段数据改一个字符，看「值」变化；再看开/关的差别。
 *
 * 运行： node tools/lesson-02-checksum.mjs
 */

import zlib from 'node:zlib'
import { constants as C } from 'node:zlib'

// 开关打开：让压缩器在帧尾追加 4 字节 XXH64
const WITH_SUM = { params: { [C.ZSTD_c_checksumFlag]: 1 } }
// 开关关闭
const NO_SUM = { params: { [C.ZSTD_c_checksumFlag]: 0, [C.ZSTD_c_contentSizeFlag]: 0 } }

function pack(text, opts) {
  const buf = zlib.zstdCompressSync(Buffer.from(text, 'utf8'), opts)
  const fhd = buf[4]
  return {
    bytes: buf.length,
    flag: (fhd >> 5) & 1, // 开关：帧头里的那 1 个比特
    tail: buf.subarray(buf.length - 4).toString('hex'), // 值：帧尾最后 4 字节
    buf,
  }
}

const v1 = '{"cwd":"C:\\\\Users\\\\31783\\\\Desktop\\\\graph-special-408"}\n'
const v2 = '{"cwd":"C:\\\\Users\\\\31783\\\\Desktop\\\\graph-special-409"}\n' // 只改最后一位

console.log('=== 开关打开（flag=1）===')
const a = pack(v1, WITH_SUM)
const b = pack(v2, WITH_SUM)
console.log('数据 A :', a.bytes, '字节  flag=' + a.flag, ' 尾部4字节(值)=' + a.tail)
console.log('数据 B :', b.bytes, '字节  flag=' + b.flag, ' 尾部4字节(值)=' + b.tail, ' ← 只改了一个字符')
console.log('值是否相同 :', a.tail === b.tail, ' ← 不同就说明「值由数据决定」')

console.log('\n=== 开关关闭（flag=0）===')
const c1 = pack(v1, NO_SUM)
console.log('数据 A :', c1.bytes, '字节  flag=' + c1.flag, ' 尾部4字节(值)=' + c1.tail)
console.log('（没有指纹，尾部这 4 字节只是压缩数据的一部分，不是校验和）')

console.log('\n=== 校验和是干什么用的：数据坏一个字节就报错 ===')
const good = a.buf
const bad = Buffer.from(good)
bad[bad.length - 8] ^= 0xff // 翻转压缩体里的一个字节（不动尾部校验和）
try {
  zlib.zstdDecompressSync(bad)
  console.log('坏数据解压结果: 竟然成功了（说明这一位翻转恰好没破坏结构）')
} catch (e) {
  console.log('坏数据解压结果: 报错 →', e.message)
}
