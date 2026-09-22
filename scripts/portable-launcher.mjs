import {spawn} from 'node:child_process'
import {createServer} from 'node:net'
import {mkdir,readFile,rm,writeFile} from 'node:fs/promises'
import {dirname,resolve,sep} from 'node:path'
import {fileURLToPath} from 'node:url'

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..')
process.chdir(root)
process.env.ECOM_DATA_DIR=resolve(root,'data')
const runtimeStatePath=resolve(process.env.ECOM_DATA_DIR,'workbench-runtime.json')
const app=JSON.parse(await readFile(resolve(root,'app/app.json'),'utf8'))
const scriptsRoot=resolve(root,'scripts'),backendEntry=resolve(root,String(app.backendEntry??'')),entryUrl=new URL(String(app.entryPath??''),'http://127.0.0.1')
if(!backendEntry.startsWith(scriptsRoot+sep)||!backendEntry.endsWith('.mjs')||entryUrl.origin!=='http://127.0.0.1'||entryUrl.username||entryUrl.password||entryUrl.hash)throw new Error('便携包 App 入口无效，请重新获取完整压缩包')
await mkdir(process.env.ECOM_DATA_DIR,{recursive:true})
const children=[]
const freePort=()=>new Promise((done,reject)=>{const server=createServer();server.on('error',reject);server.listen(0,'127.0.0.1',()=>{const address=server.address();server.close(error=>error?reject(error):done(address.port))})})
const apiPort=process.env.ECOM_API_PORT?Number(process.env.ECOM_API_PORT):await freePort()
let staticPort=process.env.ECOM_STATIC_PORT?Number(process.env.ECOM_STATIC_PORT):await freePort()
while(!process.env.ECOM_STATIC_PORT&&staticPort===apiPort)staticPort=await freePort()
if(!Number.isInteger(apiPort)||!Number.isInteger(staticPort)||apiPort<1||staticPort<1||apiPort>65535||staticPort>65535||apiPort===staticPort)throw new Error('本机端口配置无效')
process.env.ECOM_API_PORT=String(apiPort);process.env.ECOM_STATIC_PORT=String(staticPort)
const alive=async(port,path='/')=>{try{return (await fetch(`http://127.0.0.1:${port}${path}`,{signal:AbortSignal.timeout(800)})).ok}catch{return false}}
for(const [port,file,path] of [[apiPort,backendEntry,'/api/live/state'],[staticPort,resolve(root,'scripts/static-server.mjs'),'/']]){
 if(await alive(port,path))continue
 const child=spawn(process.execPath,[resolve(file)],{cwd:root,env:process.env,stdio:'inherit'})
 children.push(child)
 child.on('error',error=>console.error('启动失败：'+error.message))
}
const deadline=Date.now()+15000
let ready=false
while(Date.now()<deadline){if(await alive(apiPort,'/api/live/state')&&await alive(staticPort)&&await alive(staticPort,'/api/live/state')){ready=true;break}await new Promise(done=>setTimeout(done,250))}
if(!ready){
 console.error('\n工作台未能启动。请双击“Diagnose-PDD-Assistant.cmd”查看原因。')
 for(const child of children)if(child.exitCode===null)child.kill()
 await new Promise(done=>setTimeout(done,300))
 process.exit(1)
}
else{
 await writeFile(runtimeStatePath,JSON.stringify({appId:app.id,apiPort,staticPort,pid:process.pid,startedAt:new Date().toISOString()},null,2),{mode:0o600})
 console.log('\n工作台已启动。关闭本窗口将停止助手；商家浏览器登录状态保存在 data 目录。')
 const url=`http://127.0.0.1:${staticPort}${entryUrl.pathname}${entryUrl.search}`
 if(process.env.ECOM_NO_OPEN!=='1'){
  if(process.platform==='win32')spawn('cmd.exe',['/d','/s','/c',`start "" "${url}"`],{windowsHide:true,detached:true,stdio:'ignore'}).unref()
  else spawn(process.platform==='darwin'?'open':'xdg-open',[url],{detached:true,stdio:'ignore'}).unref()
 }
}
let stopping=false
const stop=()=>{if(stopping)return;stopping=true;for(const child of children)if(child.exitCode===null)child.kill();setTimeout(()=>{rm(runtimeStatePath,{force:true}).finally(()=>process.exit(process.exitCode??0))},300)}
process.on('SIGINT',stop);process.on('SIGTERM',stop)
for(const child of children)child.on('exit',code=>{if(!stopping&&code){console.error(`\n工作台服务异常退出（${code}）。`);process.exitCode=1;stop()}})
