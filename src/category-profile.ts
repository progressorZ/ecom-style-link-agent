import registry from '../config/category-profiles.json'

export type EvidenceStatus='verified'|'unverified'
export type AttributeField={key:string;label:string;required:boolean;evidence:EvidenceStatus}
export type CategoryProfile={id:string;platform:string;categoryKey:string;categoryPath:string;displayName:string;productNoun:string;status:'experimental'|'beta';variantDimensions:[string,string];attributeFields:AttributeField[];sizeMode:'apparel-chart'|'footwear-size-reference';defaults:{colors:string;sizes:string}}

export const categoryProfiles=registry.profiles as CategoryProfile[]
export function getCategoryProfile(id:string){const profile=categoryProfiles.find(item=>item.id===id);if(!profile)throw new Error(`未知类目 Profile：${id}`);return profile}
export const boardShoesProfile=getCategoryProfile('pdd-board-shoes')

