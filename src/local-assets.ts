export type LocalAsset={name:string;path:string;assetId?:string;preview?:string;available?:boolean}
type Request=(path:string,body?:unknown)=>Promise<unknown>

async function base64(file:File){return await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=()=>reject(new Error('图片读取失败'));reader.readAsDataURL(file)})}

export async function uploadLocalAssets(files:FileList|File[],request:Request,limit=10):Promise<LocalAsset[]>{
 const selected=Array.from(files)
 if(!selected.length)return []
 if(selected.length>limit)throw new Error(`本次最多选择 ${limit} 张图片`)
 const result:LocalAsset[]=[]
 for(const file of selected){
  if(!['image/jpeg','image/png'].includes(file.type))throw new Error(`${file.name} 不是 JPG 或 PNG 图片`)
  if(file.size>3_000_000)throw new Error(`${file.name} 超过 3MB，请压缩后选择`)
  result.push(await request('assets',{name:file.name,data:await base64(file)}) as LocalAsset)
 }
 return result
}
