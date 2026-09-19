import {spawnSync} from 'node:child_process'
import {dirname,resolve} from 'node:path'
import {fileURLToPath} from 'node:url'
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..')
const steps=[
 ['MVP 输入、接口与人工审核回归',['--test','scripts/mvp-entry.test.mjs','scripts/live-server.test.mjs','scripts/pdd-review.test.mjs']],
 ['前端领域检查',['node_modules/vitest/vitest.mjs','run','src']],
 ['TypeScript 检查',['node_modules/typescript/bin/tsc','-b']],
 ['生产构建',['node_modules/vite/bin/vite.js','build']]
]
for(const [label,args] of steps){
 console.log(`\n开始：${label}`)
 const result=spawnSync(process.execPath,args,{cwd:root,stdio:'inherit'})
 if(result.error||result.status!==0){console.error(`${label}未通过，停止后续检查。`);process.exit(result.status||1)}
}
console.log('\nMVP 本地检查通过。未访问拼多多；实店验收仍单独记录。')
