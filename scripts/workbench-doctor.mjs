import {access,readFile} from 'node:fs/promises'
import {constants} from 'node:fs'
import {createRequire} from 'node:module'
import {fileURLToPath} from 'node:url'
import {dirname,resolve} from 'node:path'
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..')
process.chdir(root)
const dataRoot=resolve(process.env.ECOM_DATA_DIR||root)
const require=createRequire(import.meta.url)
let problems=0
function check(ok,label,advice=''){console.log(`${ok?'通过':'待处理'}：${label}${!ok&&advice?'；'+advice:''}`);if(!ok)problems++}
const version=process.versions.node.split('.').map(Number)
check(version[0]>24||(version[0]===24&&version[1]>=15),`Node.js ${process.versions.node}`,'需要 Node.js 24.15 或以上版本')
for(const name of ['playwright','ajv','ajv-formats']){
 try{require.resolve(name);check(true,`${name} 已安装`)}catch{check(false,`${name} 未安装`,'请重新解压完整便携包')}
}
try{await access(root,constants.R_OK|constants.W_OK);check(true,'项目目录可读写')}catch{check(false,'项目目录不可读写','检查当前用户的文件权限')}
try{
 const bundle=JSON.parse(await readFile(resolve(dataRoot,'output/live-workbench/bundle.json'),'utf8'))
 const {compileProductPackage}=await import('./pdd-package-plan.mjs')
 const plan=compileProductPackage(bundle.input,bundle.options)
 check(Boolean(plan.bindings.shopBinding&&plan.bindings.freightProfile),'已载入商品及店铺配置结构有效','在工作台补充店铺与运费配置')
 let missing=0;for(const a of bundle.input.assets){try{await access(resolve(root,a.sourcePath),constants.R_OK)}catch{missing++}}
 check(missing===0,`当前商品图片文件可读取（缺失 ${missing} 个）`,'重新选择图片并载入')
}catch(e){if(e.code==='ENOENT')console.log('提示：尚无已载入商品，首次使用在网页录入即可。');else check(false,'已载入资料无法校验','请在工作台重新校验载入；此检查不会修改原资料')}
for(const [url,label] of [['http://127.0.0.1:4318/api/live/state','本机后台'],['http://127.0.0.1:5173/','网页工作台']]){
 try{const r=await fetch(url,{signal:AbortSignal.timeout(1500)});const ok=label==='本机后台'?r.ok&&(await r.json()).mode==='real':r.ok&&(await r.text()).includes('拼多多单款工作台');check(ok,`${label}可访问`,'运行 npm run workbench:start，或查看 .runtime/workbench-service/service.log')}
 catch{check(false,`${label}未响应`,'运行 npm run workbench:start')}
}
console.log('\n只检查本机环境与资料；不会连接商家浏览器、提交商品或判断平台验收通过。')
console.log(problems?`发现 ${problems} 项待处理，请按提示处理。`:'本机检查通过。打开 http://127.0.0.1:5173/ 使用。')
process.exitCode=problems?1:0
