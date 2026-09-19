import {spawn} from 'node:child_process'
import {createServer} from 'node:net'
import {access,mkdir,rename,rm} from 'node:fs/promises'
import {resolve,basename} from 'node:path'

const stage=resolve(process.argv[2]??'')
if(!basename(stage).startsWith('pdd-womenswear-tshirt-v')||!stage.includes('/release/'))throw new Error('请传入 release 下的女装发行版目录')
for(const path of ['dist/index.html','scripts/portable-launcher.mjs','scripts/live-server.mjs','scripts/static-server.mjs','node_modules/playwright/package.json'])await access(resolve(stage,path))
const freePort=()=>new Promise((resolvePort,reject)=>{const server=createServer();server.on('error',reject);server.listen(0,'127.0.0.1',()=>{const port=server.address().port;server.close(error=>error?reject(error):resolvePort(port))})})
const apiPort=await freePort(),staticPort=await freePort(),origin=`http://127.0.0.1:${staticPort}`
const data=resolve(stage,'data'),backup=resolve(stage,'.data-before-smoke')
await rm(backup,{recursive:true,force:true});try{await rename(data,backup)}catch{}await mkdir(data,{recursive:true})
const grouped=process.platform!=='win32'
const child=spawn(process.execPath,[resolve(stage,'scripts/portable-launcher.mjs')],{cwd:stage,env:{...process.env,ECOM_API_PORT:String(apiPort),ECOM_STATIC_PORT:String(staticPort),ECOM_NO_OPEN:'1'},detached:grouped,stdio:['ignore','pipe','pipe']})
let output='';child.stdout.on('data',chunk=>output+=chunk);child.stderr.on('data',chunk=>output+=chunk)
try{
 const deadline=Date.now()+15000;let state
 while(Date.now()<deadline){try{const response=await fetch(origin+'/api/live/state',{signal:AbortSignal.timeout(500)});if(response.ok){state=await response.json();break}}catch{}await new Promise(done=>setTimeout(done,150))}
 if(state?.mode!=='real')throw new Error('通过发行版网页访问后台失败\n'+output)
 const page=await fetch(origin+'/');if(!page.ok||!(await page.text()).includes('拼多多单款工作台'))throw new Error('发行版网页未正确加载')
 const generated=await(await fetch(origin+'/api/live/next-product-code',{method:'POST',headers:{origin,'content-type':'application/json'},body:'{}'})).json()
 if(!/^A\d{8}-\d{3}$/.test(generated.productCode??''))throw new Error('发行版 JSON 写入接口未连通：'+JSON.stringify(generated))
 const backup=await(await fetch(origin+'/api/live/backup')).json()
 if(backup.format!=='ecom-workbench-backup'||!Array.isArray(backup.entries))throw new Error('发行版备份接口未连通')
 console.log(`干净环境启动通过：网页 ${staticPort} → API ${apiPort}；生成货号 ${generated.productCode}`)
}finally{
 try{if(grouped)process.kill(-child.pid,'SIGTERM');else child.kill('SIGTERM')}catch{}
 await Promise.race([new Promise(done=>child.once('exit',done)),new Promise(done=>setTimeout(done,2000))])
 if(child.exitCode===null)try{if(grouped)process.kill(-child.pid,'SIGKILL');else child.kill('SIGKILL')}catch{}
 await rm(data,{recursive:true,force:true});try{await rename(backup,data)}catch{}
}
