import {readFile,writeFile,mkdir} from 'node:fs/promises'
import {resolve,dirname} from 'node:path'
import {compileProductPackage} from './pdd-package-plan.mjs'
const [input,output,profilesPath,...extra]=process.argv.slice(2)
if(!input||!output||extra.length)throw new Error('用法：npm run pdd:compile-package -- <商品.json> <计划输出.json> [物流配置.json]；仅编译，不操作浏览器')
const freightProfiles=profilesPath?JSON.parse(await readFile(resolve(profilesPath),'utf8')):[]
const plan=compileProductPackage(JSON.parse(await readFile(resolve(input),'utf8')),{freightProfiles})
await mkdir(dirname(resolve(output)),{recursive:true});await writeFile(resolve(output),JSON.stringify(plan,null,2))
console.log(JSON.stringify({output:resolve(output),steps:plan.steps.map(s=>s.id),blockers:plan.blockers,executable:plan.executable},null,2))
