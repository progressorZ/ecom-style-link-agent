import {spawn} from 'node:child_process'
import {mkdir} from 'node:fs/promises'
import {dirname,resolve} from 'node:path'
import {fileURLToPath} from 'node:url'

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..')
process.chdir(root)
process.env.ECOM_DATA_DIR=resolve(root,'data')
await mkdir(process.env.ECOM_DATA_DIR,{recursive:true})
const children=[]
const apiPort=Number(process.env.ECOM_API_PORT||4318),staticPort=Number(process.env.ECOM_STATIC_PORT||5173)
const alive=async(port,path='/')=>{try{return (await fetch(`http://127.0.0.1:${port}${path}`,{signal:AbortSignal.timeout(800)})).ok}catch{return false}}
for(const [port,file,path] of [[apiPort,'scripts/live-server.mjs','/api/live/state'],[staticPort,'scripts/static-server.mjs','/']]){
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
 console.log('\n工作台已启动。关闭本窗口将停止助手；商家浏览器登录状态保存在 data 目录。')
 const url=`http://127.0.0.1:${staticPort}/`
 if(process.env.ECOM_NO_OPEN!=='1'){
  if(process.platform==='win32')spawn('cmd.exe',['/d','/s','/c',`start "" "${url}"`],{windowsHide:true,detached:true,stdio:'ignore'}).unref()
  else spawn(process.platform==='darwin'?'open':'xdg-open',[url],{detached:true,stdio:'ignore'}).unref()
 }
}
let stopping=false
const stop=()=>{if(stopping)return;stopping=true;for(const child of children)if(child.exitCode===null)child.kill();setTimeout(()=>process.exit(process.exitCode??0),300)}
process.on('SIGINT',stop);process.on('SIGTERM',stop)
for(const child of children)child.on('exit',code=>{if(!stopping&&code){console.error(`\n工作台服务异常退出（${code}）。`);process.exitCode=1;stop()}})
