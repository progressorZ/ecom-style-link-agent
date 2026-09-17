import catalog from './attribute-options.json'
import {updateForm,type FormData} from './mvp-form.ts'
export const attributeCatalog=catalog
export function attributeChoices(attributes:Record<string,string>,key:string):string[]{
 const relations=catalog.relations as Record<string,Record<string,Record<string,string[]>>>
 for(const [parent,children] of [['fabricName',['material','composition']],['primaryStyle',['secondaryStyle']]] as const)if((children as readonly string[]).includes(key))return relations[parent]?.[attributes[parent]]?.[key]??[]
 return (catalog.options as Record<string,string[]>)[key]??[]
}
export function changeAttribute(form:FormData,key:string,value:string):FormData{
 const attributes={...form.attributes,[key]:value}
 if(form.attributes[key]!==value){if(key==='fabricName'){attributes.material='';attributes.composition=''}if(key==='primaryStyle')attributes.secondaryStyle=''}
 return updateForm(form,{attributes})
}
