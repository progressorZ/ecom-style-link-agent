import {spawn} from 'node:child_process'
import {resolve} from 'node:path'
const alive=async port=>{try{return (await fetch(`http://127.0.0.1:${port}/${port===4318?'api/live/state':''}`,{signal:AbortSignal.timeout(1500)})).ok}catch{return false}}
const children=[]
for(const [port,file] of [[4318,'scripts/live-server.mjs'],[5173,'scripts/static-server.mjs']]){
 if(await alive(port)){console.log(`复用已运行的本机服务：${port}`);continue}
 children.push(spawn(process.execPath,[resolve(file)],{stdio:'inherit'}))
}
let stopping=false
function stop(code){if(stopping)return;stopping=true;process.exitCode=code;for(const child of children)if(child.exitCode===null)child.kill('SIGTERM')}
for(const child of children){child.on('error',e=>{console.error(e.message);stop(1)});child.on('exit',code=>stop(code??1))}
process.on('SIGINT',()=>stop(0));process.on('SIGTERM',()=>stop(0))
console.log('单款工作台：http://127.0.0.1:5173/；按Ctrl+C关闭本次启动的服务。')
