import {spawnSync} from 'node:child_process'
import {readdirSync} from 'node:fs'
import {dirname,resolve} from 'node:path'
import {fileURLToPath} from 'node:url'

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..')
const files=readdirSync(resolve(root,'scripts'))
 .filter(name=>name.endsWith('.test.mjs'))
 .sort()
 .map(name=>`scripts/${name}`)

if(!files.length)throw new Error('没有找到 scripts/*.test.mjs')

console.log(`运行 ${files.length} 个 scripts 测试文件。`)
const result=spawnSync(process.execPath,['--test','--test-concurrency=2',...files],{
 cwd:root,
 stdio:'inherit',
 env:process.env,
})

if(result.error)throw result.error
process.exit(result.status??1)
