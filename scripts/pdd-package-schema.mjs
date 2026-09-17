import Ajv2020 from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'
import schema from '../schemas/product-package.schema.json' with {type:'json'}
const ajv=new Ajv2020({allErrors:true,strict:true,coerceTypes:false,useDefaults:false,removeAdditional:false})
addFormats(ajv)
const validate=ajv.compile(schema)
export function assertProductPackageSchema(value){
 if(validate(value))return
 const error=new Error('PACKAGE_SCHEMA_INVALID')
 error.validationErrors=validate.errors.map(({instancePath,keyword,message,params})=>({path:instancePath,keyword,message,params}))
 throw error
}
