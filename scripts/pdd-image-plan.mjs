import {readFile,realpath,stat} from 'node:fs/promises'
import {resolve,extname,basename} from 'node:path'
import {createHash} from 'node:crypto'

// Conservative local policy based on the observed T-shirt carousel hint.
export const carouselPolicy=Object.freeze({maxCount:10,maxBytes:3_000_000,minDimensionExclusive:480})
export function compileImagePlan(input){
  if(input?.scope!=='pdd-tshirt-carousel-v1'||typeof input.productCode!=='string'||!input.productCode.trim()||input.productCode!==input.productCode.trim()||!Array.isArray(input.images)||!input.images.length||input.images.length>carouselPolicy.maxCount)throw new Error('IMAGE_PLAN_INVALID')
  const ids=new Set()
  const images=input.images.map(image=>{
    if(typeof image?.id!=='string'||!image.id.trim()||ids.has(image.id)||typeof image.path!=='string'||!image.path.trim())throw new Error('IMAGE_ID_OR_PATH_INVALID')
    ids.add(image.id)
    if(!['.png','.jpg','.jpeg'].includes(extname(image.path).toLowerCase()))throw new Error('IMAGE_EXTENSION_UNSUPPORTED')
    return Object.freeze({id:image.id,path:image.path})
  })
  return Object.freeze({scope:input.scope,productCode:input.productCode,images:Object.freeze(images)})
}
// Decode happens in a detached browser document, independent of the merchant page.
export async function decodeImageBytes({base64,mime}){
  const bytes=Uint8Array.from(atob(base64),c=>c.charCodeAt(0))
  const bitmap=await createImageBitmap(new Blob([bytes],{type:mime}))
  try{return {width:bitmap.width,height:bitmap.height}}finally{bitmap.close()}
}
export function validateImageDimensions({width,height}){
  if(!Number.isInteger(width)||!Number.isInteger(height)||width<=480||height<=480)throw new Error('IMAGE_DIMENSIONS_TOO_SMALL')
  if(width!==height&&width*4!==height*3)throw new Error('IMAGE_ASPECT_RATIO_UNSUPPORTED')
}
export async function loadImageFiles(input,{baseDir=process.cwd(),allowShared=false}={}){
  const plan=compileImagePlan(input),files=[],paths=new Set(),hashes=new Set()
  for(const image of plan.images){
    const path=await realpath(resolve(baseDir,image.path)),info=await stat(path)
    if(!info.isFile()||info.size<=0||info.size>carouselPolicy.maxBytes)throw new Error('IMAGE_FILE_SIZE_INVALID:'+image.id)
    if(!allowShared&&paths.has(path))throw new Error('IMAGE_DUPLICATE_PATH')
    paths.add(path)
    const buffer=await readFile(path)
    if(buffer.length!==info.size||buffer.length>carouselPolicy.maxBytes)throw new Error('IMAGE_FILE_CHANGED:'+image.id)
    const png=buffer.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))
    const jpeg=buffer[0]===255&&buffer[1]===216&&buffer[2]===255
    const extension=extname(image.path).toLowerCase()
    if((extension==='.png'&&!png)||(extension!=='.png'&&!jpeg))throw new Error('IMAGE_CONTENT_TYPE_MISMATCH:'+image.id)
    const sha256=createHash('sha256').update(buffer).digest('hex')
    if(!allowShared&&hashes.has(sha256))throw new Error('IMAGE_DUPLICATE_CONTENT')
    hashes.add(sha256)
    files.push({id:image.id,path,name:basename(path),mime:png?'image/png':'image/jpeg',bytes:buffer.length,sha256,buffer})
  }
  return {plan,files}
}
export async function prepareImageFiles(input,context,options){
  const loaded=await loadImageFiles(input,options),decoder=await context.newPage()
  try{
    await decoder.route('**/*',route=>route.abort())
    for(const file of loaded.files){
      const dimensions=await decoder.evaluate(decodeImageBytes,{base64:file.buffer.toString('base64'),mime:file.mime})
      validateImageDimensions(dimensions)
      Object.assign(file,dimensions)
    }
    return loaded
  }finally{await decoder.close()}
}
export function imageManifest(files){return files.map(({buffer,...metadata},index)=>({...metadata,position:index+1}))}
