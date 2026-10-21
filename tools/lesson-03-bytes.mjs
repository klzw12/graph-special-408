/**
 * 📚 先导课 03 · 字节 / 字符 / 转义：为什么"数一数"不可靠
 * =========================================================
 * 三个数字，同一个路径：
 *   ① 你眼睛在文件里看到的（JSON 文本里的样子）→ 反斜杠是**两个**
 *   ② 程序从文件里读出来、解析之后的（内存里的样子）→ 反斜杠是**一个**
 *   ③ 占多少字节 → 由编码决定，中文一个字 3 字节
 *
 * 运行： node tools/lesson-03-bytes.mjs
 */

// 这就是文件里真正存的文本（JSON），注意反斜杠是两个：
const jsonText = '{"cwd":"C:\\\\Users\\\\31783\\\\Desktop\\\\graph-special-408"}\n'

console.log('=== ① 文件里的样子（JSON 文本）===')
console.log('内容 :', jsonText.trim())
console.log('字符数 (text.length)  :', jsonText.length, '← JS 里每个"可见字符"算 1')
console.log('字节数 (byteLength)   :', Buffer.byteLength(jsonText, 'utf8'))
console.log('里面有几个反斜杠字符  :', (jsonText.match(/\\/g) || []).length, '← 眼睛会以为只有 1 个"反斜杠"意思')

console.log('\n=== ② 解析之后（程序内存里）===')
const parsed = JSON.parse(jsonText)
console.log('cwd 的值 :', parsed.cwd)
console.log('字符数   :', parsed.cwd.length, '← 8 个反斜杠字符还原成 4 个；JSON 的引号花括号也不算了')
console.log('字节数   :', Buffer.byteLength(parsed.cwd, 'utf8'))

console.log('\n=== ③ 中文为什么"看起来短、实际长" ===')
for (const s of ['a', '中', '中文', 'はな']) {
  console.log(
    `"${s}"`.padEnd(10),
    '字符数', String(s.length).padEnd(3),
    'UTF-8 字节数', Buffer.byteLength(s, 'utf8')
  )
}

console.log('\n=== 结论 ===')
console.log('数一数只在"纯英文短串"时勉强可靠；反斜杠和中文都会让你数错。')
console.log('正确做法：让程序报数字，不要肉眼估。')
