/**
 * 📚 先导课 01 · 压缩是什么
 * ==========================
 * 目的：用一个 5 秒就能跑完的例子，看清三件事
 *   1. 压缩 = 换一种「写法」存同样的内容，不是加密
 *   2. 压缩后的字节里，原文的字**一个都搜不到** → 所以"搜索文件内容"这招失效
 *   3. 解压能 100% 还原 → 所以数据没丢，只是换了个存法
 *
 * 运行： node tools/lesson-01-compress.mjs
 */

import zlib from 'node:zlib'
import crypto from 'node:crypto'

// ── 例子 1：一段 JSON 文本（跟这次会话文件里的内容同款）
const text = '{"cwd":"C:\\\\Users\\\\31783\\\\Desktop\\\\graph-special[408]，"cwd_mean":"currentWorkspaceDir?"}\n'
const packed = zlib.zstdCompressSync(Buffer.from(text, 'utf8'))

console.log('=== 例子 1：一段 JSON ===')
console.log('原文            :', text.trim())
console.log('原文字节数      :', Buffer.byteLength(text))
console.log('压缩后字节数    :', packed.length)
console.log('压缩后前 4 字节 :', packed.subarray(0, 4).toString('hex'), '← 这 4 个字节是「格式标记」，zstd 固定是 28b52ffd')
console.log('压缩后「看」起来:', packed.subarray(0, 24).toString('hex'), '...（一串十六进制，不是文字）')
console.log('在里面搜 graph-special :', packed.includes(Buffer.from('graph-special')), '← false 就是"搜不到"')
const back = zlib.zstdDecompressSync(packed).toString('utf8')
console.log('解压后搜 graph-special :', back.includes('graph-special'), '← true')
console.log('解压后 == 原文        :', back === text)

console.log('\n=== 例子 1b：同一段文字，放大 200 倍 ===')
const big = text.repeat(200)
const bigPacked = zlib.zstdCompressSync(Buffer.from(big, 'utf8'))
const findBig = bigPacked.includes(Buffer.from('graph-special'))
console.log('原文字节数      :', Buffer.byteLength(big))
console.log('压缩后字节数    :', bigPacked.length, '← 重复内容被压掉了，缩得很小')
console.log('在里面搜 graph-special :', findBig)
console.log('')
console.log('⚠️ 注意：上面两个例子的答案由脚本**算出来**，不是我写的结论。')
console.log('   压缩器可以选择"压掉"或"原样保留"某段字节，所以"能不能搜到"没有定律。')
console.log('   唯一可靠的做法：对你手上的**真实文件**实测一次。')

// ── 例子 2：压缩不是万能的，有时候反而变大
const repet = Buffer.from('a'.repeat(10000))
const random = crypto.randomBytes(10000)
console.log('\n=== 例子 2：什么样的东西能压小 ===')
console.log('10000 个重复的 a → 压缩后', zlib.zstdCompressSync(repet).length, '字节')
console.log('10000 个随机字节 → 压缩后', zlib.zstdCompressSync(random).length, '字节（比原文还大）')
console.log('规律：有重复才有得压；随机数据压不动，压缩本身还要加一层「包装说明」，所以会变大')
