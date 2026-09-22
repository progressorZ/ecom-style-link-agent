import {access,cp,mkdir,readFile} from 'node:fs/promises'
import {dirname,extname,relative,resolve,sep} from 'node:path'
import {projectRoot} from './portable-app.mjs'

const inside=(parent,path)=>path===parent||path.startsWith(parent+sep)
async function resolveLocal(from,specifier){
 const base=resolve(dirname(from),specifier),candidates=extname(base)?[base]:[base+'.mjs',base+'.js',base+'.ts',base+'.tsx',base+'.json',resolve(base,'index.mjs'),resolve(base,'index.ts')]
 for(const candidate of candidates)try{await access(candidate);return candidate}catch{}
 throw new Error(`便携包依赖不存在：${relative(projectRoot,from)} -> ${specifier}`)
}

export async function collectRuntimeFiles(entries){
 const queue=[...entries],seen=new Set(),files=[]
 while(queue.length){
  const path=resolve(queue.shift())
  if(seen.has(path))continue
  if(!inside(projectRoot,path))throw new Error(`便携包依赖越过仓库目录：${path}`)
  seen.add(path);files.push(path)
  if(!/\.(?:mjs|js|ts|tsx)$/.test(path))continue
  const source=await readFile(path,'utf8'),specifiers=new Set()
  for(const pattern of [/(?:from\s*|import\s*)['"](\.{1,2}\/[^'"]+)['"]/g,/new URL\(\s*['"](\.{1,2}\/[^'"]+)['"]\s*,\s*import\.meta\.url\s*\)/g])for(const match of source.matchAll(pattern))specifiers.add(match[1])
  for(const specifier of specifiers)queue.push(await resolveLocal(path,specifier))
 }
 return files
}

export async function copyRuntimeFiles(stage,entries){
 const files=await collectRuntimeFiles(entries)
 for(const source of files){const target=resolve(stage,relative(projectRoot,source));await mkdir(dirname(target),{recursive:true});await cp(source,target)}
 return files.map(path=>relative(projectRoot,path)).sort()
}
