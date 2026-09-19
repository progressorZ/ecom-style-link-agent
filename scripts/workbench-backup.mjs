import {createHash,randomUUID} from 'node:crypto'
import {mkdir,readdir,readFile,rename,rm,stat,writeFile} from 'node:fs/promises'
import {dirname,join,relative,resolve,sep} from 'node:path'

const sha256=value=>createHash('sha256').update(value).digest('hex')
const safeRelative=value=>typeof value==='string'&&value.length>0&&!value.includes('\\')&&!value.split('/').some(part=>!part||part==='.'||part==='..')

async function files(root,current=root,result=[]){for(const entry of await readdir(current,{withFileTypes:true})){if(entry.name.endsWith('.tmp'))continue;const path=join(current,entry.name);if(entry.isDirectory())await files(root,path,result);else if(entry.isFile())result.push(path)}return result}
export async function createWorkbenchBackup(root){
 await mkdir(root,{recursive:true});const paths=await files(root);if(paths.length>2000)throw new Error('数据文件过多，请先清理旧任务报告')
 const entries=[];let total=0
 for(const path of paths){const info=await stat(path);total+=info.size;if(total>120_000_000)throw new Error('业务资料超过120MB，请先删除不再使用的图片或任务报告');const bytes=await readFile(path);entries.push({path:relative(root,path).split(sep).join('/'),size:bytes.length,sha256:sha256(bytes),data:bytes.toString('base64')})}
 return {format:'ecom-workbench-backup',version:1,createdAt:new Date().toISOString(),scope:'business-data-without-browser-login',entries}
}
export async function restoreWorkbenchBackup(root,backup){
 if(backup?.format!=='ecom-workbench-backup'||backup.version!==1||!Array.isArray(backup.entries))throw new Error('备份文件格式不正确')
 if(backup.entries.length>2000)throw new Error('备份文件数量异常')
 const staging=resolve(dirname(root),`.restore-${randomUUID()}`),previous=resolve(dirname(root),`.before-restore-${randomUUID()}`);let total=0
 await mkdir(staging,{recursive:true})
 try{
  for(const entry of backup.entries){if(!safeRelative(entry.path)||typeof entry.data!=='string'||typeof entry.sha256!=='string')throw new Error('备份包含不安全的文件路径');const bytes=Buffer.from(entry.data,'base64');total+=bytes.length;if(total>120_000_000||bytes.length!==entry.size||sha256(bytes)!==entry.sha256)throw new Error('备份文件校验失败或容量过大');const destination=resolve(staging,entry.path);if(!destination.startsWith(staging+sep))throw new Error('备份文件路径越界');await mkdir(dirname(destination),{recursive:true});await writeFile(destination,bytes,{mode:0o600})}
  try{await rename(root,previous)}catch(error){if(error.code!=='ENOENT')throw error}await rename(staging,root);await rm(previous,{recursive:true,force:true});return {restored:true,restartRequired:true,files:backup.entries.length}
 }catch(error){await rm(staging,{recursive:true,force:true});throw error}
}
