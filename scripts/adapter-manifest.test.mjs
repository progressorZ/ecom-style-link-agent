import test from 'node:test'
import assert from 'node:assert/strict'
import {access,readFile,readdir} from 'node:fs/promises'
import {resolve,join,sep} from 'node:path'
import Ajv2020 from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'

const root=resolve('.')
const schema=JSON.parse(await readFile(resolve(root,'schemas/adapter-manifest.schema.json'),'utf8'))
const appSchema=JSON.parse(await readFile(resolve(root,'schemas/app-manifest.schema.json'),'utf8'))
const ajv=new Ajv2020({allErrors:true,strict:true});addFormats(ajv)
const validate=ajv.compile(schema)
const validateApp=ajv.compile(appSchema)
const adapterIds=[],adaptersById=new Map()

test('all adapter manifests are valid, unique and point to existing evidence and entrypoints',async()=>{
 const dirs=(await readdir(resolve(root,'adapters'),{withFileTypes:true})).filter(entry=>entry.isDirectory())
 assert.ok(dirs.length,'至少登记一个 Adapter')
 const ids=[]
 for(const dir of dirs){
  const path=join(root,'adapters',dir.name,'adapter.json'),manifest=JSON.parse(await readFile(path,'utf8'))
  assert.equal(validate(manifest),true,`${path}: ${ajv.errorsText(validate.errors)}`)
  ids.push(manifest.id);adapterIds.push(manifest.id);adaptersById.set(manifest.id,{manifest,path})
  assert.equal(new Set(manifest.capabilities.map(item=>item.id)).size,manifest.capabilities.length,`${manifest.id} 能力重复`)
  for(const file of [manifest.entrypoints.compiler,manifest.entrypoints.workflow,...manifest.categories.flatMap(category=>category.evidenceDocs)]){
   const target=resolve(root,file)
   assert.ok(target.startsWith(root+sep),`${manifest.id} 路径不能离开仓库`)
   await access(target)
  }
  if(manifest.status==='stable')assert.ok(manifest.maintainers.length,`${manifest.id} stable Adapter 必须有维护者`)
  if(manifest.safety.automaticPublish)assert.ok(['beta','stable'].includes(manifest.capabilities.find(item=>item.id==='publish')?.status),`${manifest.id} 自动发布必须有真实验证状态`)
 }
 assert.equal(new Set(ids).size,ids.length,'Adapter ID 必须全局唯一')
})

test('independent app manifests reference one known adapter and declare both OS packages',async()=>{
 const dirs=(await readdir(resolve(root,'apps'),{withFileTypes:true})).filter(entry=>entry.isDirectory())
 const packageJson=JSON.parse(await readFile(resolve(root,'package.json'),'utf8')),ids=[],namespaces=[]
 for(const dir of dirs){
  const path=join(root,'apps',dir.name,'app.json'),manifest=JSON.parse(await readFile(path,'utf8'))
  assert.equal(validateApp(manifest),true,`${path}: ${ajv.errorsText(validateApp.errors)}`)
  ids.push(manifest.id);namespaces.push(manifest.dataNamespace)
  assert.ok(adapterIds.includes(manifest.adapter.id),`${manifest.id} 引用了未知 Adapter`)
  const adapter=adaptersById.get(manifest.adapter.id)?.manifest
  assert.ok(adapter,`${manifest.id} 引用了未知 Adapter`)
  assert.ok(manifest.adapter.categoryKeys.every(key=>adapter.categories.some(category=>category.key===key)),`${manifest.id} 引用了未知类目 Profile`)
  assert.deepEqual(new Set(manifest.distributions.map(item=>item.target)),new Set(['windows-x64','macos-universal']),`${manifest.id} 必须分别声明 Windows 和 macOS 包`)
  for(const distribution of manifest.distributions)if(distribution.buildCommand){const script=distribution.buildCommand.replace(/^npm run /,'');assert.ok(packageJson.scripts[script],`${manifest.id} 构建命令不存在`) }
 }
 assert.equal(new Set(ids).size,ids.length,'App ID 必须全局唯一')
 assert.equal(new Set(namespaces).size,namespaces.length,'App 数据目录必须隔离')
})
