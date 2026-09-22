import {access,readFile,readdir} from 'node:fs/promises'
import {dirname,resolve,sep} from 'node:path'
import {fileURLToPath} from 'node:url'

export const projectRoot=resolve(dirname(fileURLToPath(import.meta.url)),'..')
export const releaseRoot=resolve(projectRoot,'release')
const appIdPattern=/^[a-z0-9]+(?:[.-][a-z0-9]+)*$/
const targets=new Set(['windows-x64','macos-universal'])

const inside=(parent,path)=>path===parent||path.startsWith(parent+sep)

export function portableEntryPath(app){
 const raw=String(app?.entryPath??'')
 if(!raw.startsWith('/')||raw.startsWith('//'))throw new Error(`${app?.id??'App'} entryPath 必须是本机工作台内的绝对路径`)
 const url=new URL(raw,'http://127.0.0.1')
 if(url.origin!=='http://127.0.0.1'||url.username||url.password||url.hash)throw new Error(`${app.id} entryPath 不安全`)
 return url.pathname+url.search
}

export async function loadPortableApp(appId,target){
 if(!appIdPattern.test(appId??''))throw new Error('App ID 格式不正确')
 if(!targets.has(target))throw new Error(`不支持的便携包目标：${target}`)
 const appDirectory=resolve(projectRoot,'apps',appId)
 if(!inside(resolve(projectRoot,'apps'),appDirectory))throw new Error('App 路径越界')
 const app=JSON.parse(await readFile(resolve(appDirectory,'app.json'),'utf8'))
 if(app.id!==appId)throw new Error(`App 目录与 manifest ID 不一致：${appId}`)
 const distribution=app.distributions?.find(item=>item.target===target)
 if(!distribution||!distribution.buildCommand||distribution.status==='planned')throw new Error(`${appId} 尚未启用 ${target} 便携包`)
 portableEntryPath(app)
 const frontendEntry=resolve(projectRoot,String(app.frontendEntry??''))
 if(!inside(resolve(projectRoot,'src'),frontendEntry))throw new Error(`${appId} frontendEntry 必须位于 src 目录`)
 await access(frontendEntry)
 const backendEntry=resolve(projectRoot,String(app.backendEntry??''))
 if(!inside(resolve(projectRoot,'scripts'),backendEntry))throw new Error(`${appId} backendEntry 必须位于 scripts 目录`)
 await access(backendEntry)
 const packageDocuments=[]
 for(const item of app.packageDocuments??[]){
  const document=resolve(projectRoot,String(item))
  if(!inside(projectRoot,document)||document===projectRoot)throw new Error(`${appId} packageDocuments 路径越界`)
  await access(document);packageDocuments.push({source:document,target:String(item)})
 }
 let adapterDirectory=null
 for(const entry of await readdir(resolve(projectRoot,'adapters'),{withFileTypes:true})){
  if(!entry.isDirectory())continue
  const directory=resolve(projectRoot,'adapters',entry.name)
  try{const manifest=JSON.parse(await readFile(resolve(directory,'adapter.json'),'utf8'));if(manifest.id===app.adapter.id){adapterDirectory=directory;break}}catch{}
 }
 if(!adapterDirectory)throw new Error(`${appId} 引用的 Adapter 不存在：${app.adapter.id}`)
 return {app,appDirectory,adapterDirectory,distribution,frontendEntry,backendEntry,packageDocuments,target}
}

export async function readStagedApp(stage){
 const app=JSON.parse(await readFile(resolve(stage,'app/app.json'),'utf8'))
 if(!appIdPattern.test(app.id??''))throw new Error('发行目录中的 App manifest 无效')
 portableEntryPath(app)
 return app
}
