import {spawn} from 'node:child_process'
import {createServer} from 'node:net'
import {access,chmod,mkdir,readFile,readdir,rename,rm} from 'node:fs/promises'
import {resolve,sep} from 'node:path'
import {readStagedApp,releaseRoot} from './portable-app.mjs'

const stage=resolve(process.argv[2]??'')
if(stage!==releaseRoot&&!stage.startsWith(releaseRoot+sep))throw new Error('请传入 release 目录中的便携版目录')
const app=await readStagedApp(stage)
for(const path of ['dist/index.html','scripts/portable-launcher.mjs','scripts/static-server.mjs',app.backendEntry,'node_modules/playwright/package.json','BUILD-INFO.json'])await access(resolve(stage,path))
for(const document of app.packageDocuments??[])await access(resolve(stage,document))
const appReadme=await readFile(resolve(stage,'README-App.md'),'utf8')
for(const document of app.packageDocuments??[])if(appReadme.includes(`../../${document}`))throw new Error(`发行包说明仍引用仓库外文件：${document}`)
const bundles=(await readdir(resolve(stage,'dist/assets'))).filter(name=>name.endsWith('.js'))
const bundleSource=(await Promise.all(bundles.map(name=>readFile(resolve(stage,'dist/assets',name),'utf8')))).join('\n')
if(!bundleSource.includes('data-ecom-app')||!bundleSource.includes(app.id))throw new Error(`发行版前端入口与 ${app.id} 不一致`)
const freePort=()=>new Promise((resolvePort,reject)=>{const server=createServer();server.on('error',reject);server.listen(0,'127.0.0.1',()=>{const address=server.address();server.close(error=>error?reject(error):resolvePort(address.port))})})
const apiPort=await freePort(),staticPort=await freePort(),origin=`http://127.0.0.1:${staticPort}`
const data=resolve(stage,'data'),backupDirectory=resolve(stage,'.data-before-smoke')
await rm(backupDirectory,{recursive:true,force:true});try{await rename(data,backupDirectory)}catch{}await mkdir(data,{recursive:true})

let runtime=process.execPath
if(process.platform==='win32'){const candidate=resolve(stage,'runtime/node.exe');try{await access(candidate);runtime=candidate}catch{}}
if(process.platform==='darwin'){
 const arch=process.arch==='arm64'?'arm64':'x64',candidate=resolve(stage,`runtime/node-${arch}.runtime`)
 try{await access(candidate);await chmod(candidate,0o700);runtime=candidate}catch{}
}
const grouped=process.platform!=='win32'
const child=spawn(runtime,[resolve(stage,'scripts/portable-launcher.mjs')],{cwd:stage,env:{...process.env,ECOM_API_PORT:String(apiPort),ECOM_STATIC_PORT:String(staticPort),ECOM_NO_OPEN:'1'},detached:grouped,stdio:['ignore','pipe','pipe']})
let output='';child.stdout.on('data',chunk=>output+=chunk);child.stderr.on('data',chunk=>output+=chunk)
try{
 const deadline=Date.now()+15000;let state
 while(Date.now()<deadline){try{const response=await fetch(origin+'/api/live/state',{signal:AbortSignal.timeout(500)});if(response.ok){state=await response.json();break}}catch{}await new Promise(done=>setTimeout(done,150))}
 if(state?.appId!==app.id||!['real','board-shoes-draft'].includes(state?.mode))throw new Error('通过发行版网页访问了错误的 App 后台\n'+output)
 const page=await fetch(origin+app.entryPath),html=await page.text()
 if(!page.ok||!html.includes(app.displayName))throw new Error(`发行版网页未按 ${app.id} 独立构建`)
 const generated=await(await fetch(origin+'/api/live/next-product-code',{method:'POST',headers:{origin,'content-type':'application/json'},body:'{}'})).json()
 if(!/^A\d{8}-\d{3}$/.test(generated.productCode??''))throw new Error('发行版 JSON 写入接口未连通：'+JSON.stringify(generated))
 const backup=await(await fetch(origin+'/api/live/backup')).json()
 if(backup.format!=='ecom-workbench-backup'||!Array.isArray(backup.entries))throw new Error('发行版备份接口未连通')
 console.log(`干净环境启动通过：${app.id}；包内运行时 ${runtime===process.execPath?'宿主兼容回退':'已实际执行'}；网页 ${staticPort} → API ${apiPort}`)
}finally{
 try{if(grouped)process.kill(-child.pid,'SIGTERM');else child.kill('SIGTERM')}catch{}
 await Promise.race([new Promise(done=>child.once('exit',done)),new Promise(done=>setTimeout(done,2000))])
 if(child.exitCode===null)try{if(grouped)process.kill(-child.pid,'SIGKILL');else child.kill('SIGKILL')}catch{}
 await rm(data,{recursive:true,force:true});try{await rename(backupDirectory,data)}catch{}
}
