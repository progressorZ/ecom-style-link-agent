import test from 'node:test'
import assert from 'node:assert/strict'
import {spawn} from 'node:child_process'
import {mkdtemp,readFile,readdir,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'

const root=resolve('.')
const apps=[
 {id:'pdd-womenswear-tshirt',other:'pdd-board-shoes'},
 {id:'pdd-board-shoes',other:'pdd-womenswear-tshirt'},
]

const run=(command,args,options={})=>new Promise((done,reject)=>{
 const child=spawn(command,args,{...options,stdio:['ignore','pipe','pipe']})
 let output=''
 child.stdout.on('data',chunk=>output+=chunk)
 child.stderr.on('data',chunk=>output+=chunk)
 child.on('error',reject)
 child.on('exit',code=>code===0?done(output):reject(new Error(`${command} 退出码 ${code}\n${output}`)))
})

test('each App production build contains only its own frontend entry',async()=>{
 const temporary=await mkdtemp(join(tmpdir(),'ecom-app-builds-'))
 try{
  for(const app of apps){
   const manifest=JSON.parse(await readFile(resolve(root,'apps',app.id,'app.json'),'utf8')),outDir=resolve(temporary,app.id)
   await run(process.execPath,[resolve(root,'node_modules/vite/bin/vite.js'),'build','--outDir',outDir,'--emptyOutDir'],{cwd:root,env:{...process.env,ECOM_APP_ID:app.id}})
   const html=await readFile(resolve(outDir,'index.html'),'utf8')
   assert.match(html,new RegExp(`<title>${manifest.displayName.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}</title>`))
   const scripts=(await readdir(resolve(outDir,'assets'))).filter(name=>name.endsWith('.js'))
   const source=(await Promise.all(scripts.map(name=>readFile(resolve(outDir,'assets',name),'utf8')))).join('\n')
   assert.match(source,new RegExp(`data-ecom-app.{0,40}${app.id}`),`${app.id} 未加载自己的前端入口`)
   assert.doesNotMatch(source,new RegExp(`data-ecom-app.{0,40}${app.other}`),`${app.id} 混入了 ${app.other} 前端入口`)
  }
 }finally{await rm(temporary,{recursive:true,force:true})}
})
