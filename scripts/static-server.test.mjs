import test from 'node:test'
import assert from 'node:assert/strict'
import {createServer} from 'node:http'
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {createStaticServer} from './static-server.mjs'

const listen=server=>new Promise(resolve=>server.listen(0,'127.0.0.1',()=>resolve(server.address().port)))
const close=server=>new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()))

test('发行版静态服务器同源转发 API 的读取和 JSON 写入',async()=>{
 const root=await mkdtemp(join(tmpdir(),'ecom-static-'));await mkdir(root,{recursive:true});await writeFile(join(root,'index.html'),'<title>拼多多单款工作台</title>')
 const api=createServer((req,res)=>{let body='';req.on('data',chunk=>body+=chunk);req.on('end',()=>{res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify({method:req.method,url:req.url,origin:req.headers.origin,body:body?JSON.parse(body):null}))})})
 const apiPort=await listen(api),web=createStaticServer({root,apiPort}),webPort=await listen(web),origin=`http://127.0.0.1:${webPort}`
 try{
  const page=await fetch(origin+'/');assert.equal(page.status,200);assert.match(await page.text(),/拼多多单款工作台/)
  const read=await(await fetch(origin+'/api/live/state')).json();assert.equal(read.url,'/api/live/state');assert.equal(read.method,'GET')
  const write=await(await fetch(origin+'/api/live/next-product-code',{method:'POST',headers:{origin,'content-type':'application/json'},body:'{}'})).json();assert.equal(write.method,'POST');assert.equal(write.origin,origin);assert.deepEqual(write.body,{})
 }finally{await close(web);await close(api);await rm(root,{recursive:true,force:true})}
})
