// @vitest-environment jsdom
import {describe,expect,it} from 'vitest'
import {strToU8,zipSync} from 'fflate'
import {parseListingSheet,readSpreadsheet} from './spreadsheet-import'

describe('listing spreadsheet import',()=>{
 it('parses shared product facts and variant rows',()=>{const result=parseListingSheet([
  ['商品货号','商品标题','品牌','颜色','鞋码','拼单价','单买价','库存','鞋面材质'],
  ['B001','基础板鞋','无品牌','黑白','35','88','98','20','帆布'],
  ['','','','黑白','36','88','98','15','']
 ],{upperMaterial:'鞋面材质'});expect(result.productCode).toBe('B001');expect(result.attributes.upperMaterial).toBe('帆布');expect(result.rows).toHaveLength(2)})
 it('rejects duplicate variants',()=>expect(()=>parseListingSheet([['颜色','尺码','拼单价','单买价','库存'],['白','S','1','2','3'],['白','S','1','2','3']])).toThrow('重复'))
 it('reads the first worksheet from an xlsx file',async()=>{const shared='<?xml version="1.0"?><sst><si><t>颜色</t></si><si><t>鞋码</t></si><si><t>拼单价</t></si><si><t>单买价</t></si><si><t>库存</t></si><si><t>黑白</t></si></sst>',sheet='<?xml version="1.0"?><worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="s"><v>2</v></c><c r="D1" t="s"><v>3</v></c><c r="E1" t="s"><v>4</v></c></row><row r="2"><c r="A2" t="s"><v>5</v></c><c r="B2"><v>35</v></c><c r="C2"><v>99</v></c><c r="D2"><v>109</v></c><c r="E2"><v>20</v></c></row></sheetData></worksheet>',bytes=zipSync({'xl/sharedStrings.xml':strToU8(shared),'xl/worksheets/sheet1.xml':strToU8(sheet)}),file=new File([bytes], 'board.xlsx');const rows=await readSpreadsheet(file);expect(parseListingSheet(rows).rows[0]).toEqual({color:'黑白',size:'35',groupPrice:'99',singlePrice:'109',stock:'20'})})
})
