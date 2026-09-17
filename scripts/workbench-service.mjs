import {spawn} from 'node:child_process'
import {mkdir,open,readFile,writeFile,unlink} from 'node:fs/promises'
import {resolve} from 'node:path'
const dataRoot=resolve(process.env.ECOM_DATA_DIR||'.'),root=resolve(dataRoot,'.runtime/workbench-service'),pidFile=resolve(root,'pid.json')
await mkdir(root,{recursive:true})
const command=process.argv[2]??'status'
const running=pid=>{try{process.kill(pid,0);return true}catch{return false}}
const portLive=async()=>{try{const r=await fetch('http://127.0.0.1:4318/api/live/state',{signal:AbortSignal.timeout(1000)});return r.ok&&(await r.json()).mode==='real'}catch{return false}}
const frontLive=async()=>{try{const r=await fetch('http://127.0.0.1:5173/',{signal:AbortSignal.timeout(1000)});return r.ok&&(await r.text()).includes('拼多多单款工作台')}catch{return false}}
const ready=async()=>{const [api,web]=await Promise.all([portLive(),frontLive()]);return {api,web}}
const reportReady=async()=>{const s=await ready();if(s.api&&s.web){console.log('工作台已就绪：http://127.0.0.1:5173/');return true}console.error(`工作台尚未就绪：后台${s.api?'正常':'未响应'}，网页${s.web?'正常':'未响应'}。运行 npm run workbench:doctor 查看原因。`);return false}
let record;try{record=JSON.parse(await readFile(pidFile,'utf8'))}catch{}
if(command==='status'){
 process.exitCode=await reportReady()?0:1
}else if(command==='stop'){
 if(record&&running(record.pid))process.kill(record.pid,'SIGTERM')
 await unlink(pidFile).catch(()=>{});console.log('已停止本项目登记的工作台进程')
}else if(command==='start'){
 if(record&&running(record.pid)){process.exitCode=await reportReady()?0:1;process.exit(process.exitCode)}
 const existing=await ready();if(existing.api&&existing.web){console.log('复用已运行的工作台：http://127.0.0.1:5173/');process.exit(0)}
 const log=await open(resolve(root,'service.log'),'a',0o600)
 const child=spawn(process.execPath,[resolve('scripts/start-workbench.mjs')],{cwd:process.cwd(),detached:true,stdio:['ignore',log.fd,log.fd]})
 child.unref();await log.close()
 await writeFile(pidFile,JSON.stringify({pid:child.pid,startedAt:new Date().toISOString()}),{mode:0o600})
 const deadline=Date.now()+12000
 while(Date.now()<deadline){const s=await ready();if(s.api&&s.web)break;if(!running(child.pid))break;await new Promise(r=>setTimeout(r,250))}
 process.exitCode=await reportReady()?0:1
 if(process.exitCode)console.error('启动日志：'+resolve(root,'service.log'))
}else throw new Error('使用 start / stop / status')
