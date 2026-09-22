import {readFile} from 'node:fs/promises'
import {resolve} from 'node:path'

const tag=process.argv[2],pkg=JSON.parse(await readFile(resolve('package.json'),'utf8')),expected=`v${pkg.version}`
if(tag!==expected){console.error(`发布标签 ${tag} 与仓库版本 ${expected} 不一致`);process.exit(1)}
console.log(`发布版本门禁通过：${tag}`)
