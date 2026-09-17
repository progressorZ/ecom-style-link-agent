import {resolveShopBinding} from './pdd-shop-identity.mjs'
import {compileSizeSyncPlan} from './pdd-size-sync.mjs'
import {assertProductPackageSchema} from './pdd-package-schema.mjs'
import {compileServicesPlan} from './pdd-services.mjs'
import {compilePricingPlan} from './pdd-pricing.mjs'
import {compileFreightPlan} from './pdd-freight.mjs'
import {resolveFreightProfile} from './pdd-freight-profile.mjs'
import {compileElementsPlan} from './pdd-elements.mjs'
import {compileStylePlan} from './pdd-style.mjs'
import {compileFabricPlan} from './pdd-fabric.mjs'
import {compileAttributePlan,supportedAttributeKeys} from './pdd-attributes.mjs'
import {createHash} from 'node:crypto'
import {compileBasicPlan} from './pdd-basic-adapter.mjs'
import {compileMatrixPlan} from './pdd-matrix-adapter.mjs'
import {compileSizePlan} from './pdd-size-adapter.mjs'
import {compileImagePlan} from './pdd-image-plan.mjs'
import {compileDetailPlan} from './pdd-detail-adapter.mjs'
import {compileSkuImagePlan} from './pdd-sku-image-adapter.mjs'
import {compileShippingPlan} from './pdd-shipping-adapter.mjs'
const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value)}return value}
// Uploads can trigger platform attribute inference. Apply authoritative attributes afterwards.
const executionOrder=['basic','carousel','matrixAndSku','pricing','size','sizeSync','skuImages','detail','brand','elements','style','fabric','attributes','shipping','services','freight']
export const orderProductSteps=steps=>[...steps].sort((a,b)=>executionOrder.indexOf(a.id)-executionOrder.indexOf(b.id))
const nonempty=s=>typeof s==='string'&&s.trim()===s&&s.length>0
function uniqueMap(items,key,error){const map=new Map();for(const item of items){if(!nonempty(item?.[key])||map.has(item[key]))throw new Error(error);map.set(item[key],item)}return map}
const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v
export function compileProductPackage(raw,{freightProfiles=[],shopBindings}={}){
 // Snapshot before compilation so caller changes cannot alter later execution inputs.
 const pkg=structuredClone(raw)
 if(pkg?.schemaVersion!=='0.1'||pkg.product?.categoryKey!=='womenswear.tshirt'||pkg.listing?.platform!=='pdd'||!Number.isSafeInteger(pkg.product.revision)||pkg.product.revision<1||!Number.isSafeInteger(pkg.listing.revision)||pkg.listing.revision<1||!nonempty(pkg.product.id)||!nonempty(pkg.listing.shopKey)||!nonempty(pkg.listing.categoryBindingKey))throw new Error('PACKAGE_IDENTITY_INVALID')
 if(!Array.isArray(pkg.assets)||!Array.isArray(pkg.sizeCharts)||!Array.isArray(pkg.evidence)||!Array.isArray(pkg.variants)||!Array.isArray(pkg.listing.offers))throw new Error('PACKAGE_COLLECTION_INVALID')
 const code=pkg.product.productCode,assets=uniqueMap(pkg.assets,'id','ASSET_ID_INVALID'),variants=uniqueMap(pkg.variants,'id','VARIANT_ID_INVALID')
 const sizes=new Map(),colors=new Map()
 for(const v of variants.values())for(const [map,key,label] of [[sizes,v.sizeKey,v.sizeLabel],[colors,v.colorKey,v.colorLabel]]){
  if(!nonempty(key)||!nonempty(label)||(map.has(key)&&map.get(key)!==label)||[...map].some(([k,l])=>k!==key&&l===label))throw new Error('VARIANT_LABEL_MAPPING_AMBIGUOUS')
  map.set(key,label)
 }
 const selected=pkg.listing.sizeConfiguration?.selectedSizeKeys
 if(!Array.isArray(selected)||new Set(selected).size!==sizes.size||selected.length!==sizes.size||selected.some(k=>!sizes.has(k)))throw new Error('SELECTED_SIZE_SET_MISMATCH')
 for(const a of assets.values())if(!['main','detail','sku'].includes(a.role)||a.reviewStatus!=='approved'||!Number.isSafeInteger(a.order)||a.order<0)throw new Error('ASSET_NOT_APPROVED_OR_INVALID')
 const ordered=role=>{
  const chosen=[...assets.values()].filter(a=>a.role===role).sort((a,b)=>a.order-b.order)
  if(new Set(chosen.map(a=>a.order)).size!==chosen.length)throw new Error('ASSET_ORDER_AMBIGUOUS:'+role)
  return chosen.map(a=>({id:a.id,path:a.sourcePath}))
 }
 const basic={scope:'pdd-tshirt-basic-v1',fields:[{key:'listing.title',value:pkg.listing.title},{key:'product.productCode',value:code}]}
 compileBasicPlan(basic)
 const brand=pkg.product.brand===null||pkg.product.brand===undefined?null:{scope:'pdd-tshirt-attributes-v1',productCode:code,fields:[{key:'product.brand',value:pkg.product.brand}]}
 if(brand)compileAttributePlan(brand)
 const attributeFields=Object.entries(pkg.product.attributes||{}).filter(([key])=>supportedAttributeKeys.includes('attributes.'+key)).map(([key,value])=>({key:'attributes.'+key,value}))
 const attributeInput={scope:'pdd-tshirt-attributes-v1',productCode:code,fields:attributeFields}
 if(attributeFields.length)compileAttributePlan(attributeInput)
 const hasFabric=['fabricName','material','composition'].some(k=>Object.hasOwn(pkg.product.attributes||{},k))
 const fabricInput=hasFabric?{scope:'pdd-tshirt-fabric-v1',productCode:code,fabricName:pkg.product.attributes.fabricName,material:pkg.product.attributes.material,composition:pkg.product.attributes.composition}:null
 if(hasFabric)compileFabricPlan(fabricInput)
 const hasStyle=['primaryStyle','secondaryStyle'].some(k=>Object.hasOwn(pkg.product.attributes||{},k))
 const styleInput=hasStyle?{scope:'pdd-tshirt-style-v1',productCode:code,primaryStyle:pkg.product.attributes.primaryStyle,secondaryStyle:pkg.product.attributes.secondaryStyle}:null
 if(hasStyle)compileStylePlan(styleInput)
 const elementsInput=Object.hasOwn(pkg.product.attributes||{},'fashionElements')?{scope:'pdd-tshirt-elements-v1',productCode:code,values:pkg.product.attributes.fashionElements}:null
 if(elementsInput)compileElementsPlan(elementsInput)
 const matrix=compileMatrixPlan(pkg)
 const matrixInput={scope:'pdd-tshirt-matrix-v1',sizeSystem:'中国码',productCode:code,variants:matrix.sku.variants.map(({key,...v})=>v)}
 const pricing={scope:'pdd-tshirt-pricing-v1',productCode:code,referenceAmountMinor:pkg.listing.pricing?.referenceAmountMinor,multiItemDiscount:pkg.listing.pricing?.multiItemDiscount,variants:matrixInput.variants};compilePricingPlan(pricing)
 const carousel={scope:'pdd-tshirt-carousel-v1',productCode:code,images:ordered('main')};compileImagePlan(carousel)
 const detail={scope:'pdd-tshirt-detail-images-v1',productCode:code,images:ordered('detail')};compileDetailPlan(detail)
 const bindings=pkg.listing.offers.map(offer=>{
  const v=variants.get(offer.variantId),asset=assets.get(offer.skuAssetId)
  if(!v||!asset||asset.role!=='sku'||asset.colorKey!==v.colorKey)throw new Error('SKU_ASSET_BINDING_INVALID')
  return {color:v.colorLabel,size:v.sizeLabel,imageId:asset.id}
 })
 const skuImages={scope:'pdd-tshirt-sku-images-v1',productCode:code,images:ordered('sku'),bindings};compileSkuImagePlan(skuImages)
 if(pkg.sizeCharts.length!==1||!['garment','body_recommendation'].includes(pkg.sizeCharts[0].kind))throw new Error('SIZE_CHART_SCOPE_UNSUPPORTED')
 const chart=pkg.sizeCharts[0]
 if(!Array.isArray(chart.columns)||!chart.columns.length||chart.columns.some(c=>c.unit!==(c.key==='weight'?'kg':'cm'))||new Set(chart.columns.map(c=>c.key)).size!==chart.columns.length)throw new Error('SIZE_CHART_COLUMNS_INVALID')
 if(!Array.isArray(chart.rows)||chart.rows.length!==sizes.size||new Set(chart.rows.map(r=>r.sizeKey)).size!==sizes.size||chart.rows.some(r=>!sizes.has(r.sizeKey)))throw new Error('SIZE_CHART_ROWSET_MISMATCH')
 for(const row of chart.rows)if(!row.values||Object.keys(row.values).length!==chart.columns.length||chart.columns.some(c=>!(c.key in row.values)))throw new Error('SIZE_CHART_CELLS_MISMATCH')
 const size={scope:'pdd-tshirt-size-v1',productCode:code,kind:chart.kind,unit:chart.kind==='body_recommendation'?'mixed':'cm',rows:chart.rows.map(r=>({size:sizes.get(r.sizeKey),measurements:r.values}))};compileSizePlan(size)
 const sizeSync={scope:'pdd-tshirt-size-sync-v1',productCode:code,enabled:pkg.listing.sizeConfiguration.syncChartToDetail};compileSizeSyncPlan(sizeSync)
 const hours={'24h_handover':24,'48h_handover':48}[pkg.listing.logistics?.shippingPromise]
 const shipping={scope:'pdd-tshirt-shipping-v1',productCode:code,shipmentHours:hours};compileShippingPlan(shipping)
 const services=pkg.listing.services?{scope:'pdd-tshirt-services-v1',productCode:code,expected:{...pkg.listing.services,inventoryDeduction:pkg.listing.logistics.inventoryDeduction}}:null
 if(services)compileServicesPlan(services)
 const shopBinding=shopBindings===undefined?null:resolveShopBinding(pkg.listing.shopKey,shopBindings)
 const freightProfile=resolveFreightProfile(pkg.listing,freightProfiles)
 const freight=freightProfile?{scope:'pdd-tshirt-freight-v1',productCode:code,...freightProfile.freight}:null
 if(freight)compileFreightPlan(freight)
 const blockers=[
  {path:'/product/attributes',reason:'dependent_and_required_attribute_coverage_incomplete'},
  {path:'/product/brand',reason:brand?'brand_live_selection_verification_required':'brand_configuration_missing'},
  {path:'/listing/qualification',reason:'qualification_requirements_unverified'},
  {path:'/listing/pricing',reason:'pricing_live_readback_required'},
  {path:'/listing/logistics/profileKey',reason:freightProfile?'freight_live_readback_required':'freight_effective_configuration_unverified'},
  {path:'/listing/services',reason:services?'services_live_readback_required':'services_configuration_missing'},
  {path:'/listing/logistics/inventoryDeduction',reason:'inventory_deduction_unverified'},
  {path:'/listing/shopKey',reason:'live_shop_identity_unverified'},
  {path:'/listing/categoryBindingKey',reason:'live_category_binding_unverified'},
  {path:'/listing/sizeConfiguration/templateKey',reason:'size_template_unverified'},
  {path:'/listing/sizeConfiguration/syncChartToDetail',reason:'size_detail_sync_live_readback_required'},
  {path:'/',reason:'independent_whole_form_readback_unimplemented'}
 ]
 if(!pkg.evidence.length||pkg.evidence.some(e=>e.confirmed!==true))blockers.push({path:'/evidence',reason:'unconfirmed_evidence'})
 assertProductPackageSchema(pkg)
 const mappedAttributes=new Set([...supportedAttributeKeys.map(k=>k.slice('attributes.'.length)),'fabricName','material','composition','primaryStyle','secondaryStyle','fashionElements'])
 const attributeCoverage=Object.keys(pkg.product.attributes).map(key=>({path:'/product/attributes/'+key.replaceAll('~','~0').replaceAll('/','~1'),status:mappedAttributes.has(key)?'compiled':'unhandled'}))
 for(const item of attributeCoverage)if(item.status==='unhandled')blockers.push({path:item.path,reason:'attribute_not_mapped'})
 const digest=createHash('sha256').update(JSON.stringify(canonical(pkg))).digest('hex')
 const executionHash=createHash('sha256').update(JSON.stringify(canonical({sourceHash:digest,freightProfile,...(shopBinding?{shopBinding}:{})}))).digest('hex')
 return freeze({attributeCoverage,executionHash,bindings:{freightProfile,shopBinding},version:'pdd-package-plan-v1',sourceHash:digest,source:pkg,identity:{productId:pkg.product.id,productCode:code,productRevision:pkg.product.revision,listingRevision:pkg.listing.revision,shopKey:pkg.listing.shopKey},steps:orderProductSteps([{id:'basic',input:basic},...(brand?[{id:'brand',input:brand}]:[]),...(elementsInput?[{id:'elements',input:elementsInput}]:[]),...(styleInput?[{id:'style',input:styleInput}]:[]),...(fabricInput?[{id:'fabric',input:fabricInput}]:[]),...(attributeFields.length?[{id:'attributes',input:attributeInput}]:[]),{id:'matrixAndSku',input:matrixInput},{id:'pricing',input:pricing},{id:'size',input:size},{id:'sizeSync',input:sizeSync},{id:'carousel',input:carousel},{id:'skuImages',input:skuImages},{id:'detail',input:detail},{id:'shipping',input:shipping},...(services?[{id:'services',input:services}]:[]),...(freight?[{id:'freight',input:freight}]:[])]),blockers,executable:false,fullProductVerified:false})
}
