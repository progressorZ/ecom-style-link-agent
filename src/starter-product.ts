import sample from '../examples/product-package-mvp-sample.json'
import {blankForm,rebuildRows,type Picture,type FormData} from './mvp-form.ts'
export function starterProduct(identity:{id:string;productCode:string},images:{main:Picture[];detail:Picture[];sku:Picture}):FormData{
 const form=blankForm(identity.id)
 Object.assign(form,{productCode:identity.productCode,sample:true,title:'示例勿发布圆领短袖女装T恤',brand:sample.product.brand,colors:'白色,黑色',sizes:'S,M,L',referencePrice:'199',discount:'9.5',sizeKind:'garment',sizeFields:['shoulder','chest','waist','hip'],rangeFields:[],sizeModes:{garment:{fields:['shoulder','chest','waist','hip'],ranges:[]},body_recommendation:{fields:['height','weight'],ranges:['height','weight']}},shipping:'48h_handover',nearbySameDay:false,authenticityPromise:false})
 form.attributes=Object.fromEntries(Object.entries(sample.product.attributes).map(([key,value])=>[key,Array.isArray(value)?value.join(','):value]))
 form.rows=rebuildRows(form).map((row,i)=>({...row,groupPrice:'99',singlePrice:'109',stock:String([20,30,20,15,25,15][i])}))
 form.measurements={
 S:{shoulder:'37',chest:'86',waist:'80',hip:'88',length:'60',sleeve:'18',height:'155-160',weight:'40-50'},
 M:{shoulder:'38',chest:'90',waist:'84',hip:'92',length:'62',sleeve:'19',height:'160-165',weight:'50-60'},
 L:{shoulder:'39',chest:'94',waist:'88',hip:'96',length:'64',sleeve:'20',height:'165-170',weight:'60-70'},
 }
 form.main=structuredClone(images.main);form.detail=structuredClone(images.detail);form.skuImages={'白色':structuredClone(images.sku),'黑色':structuredClone(images.sku)}
 return form
}
