export function parseTabularInput(text:string){
 if(text.length>100000)throw new Error('表格过大，请仅复制当前商品的数据')
 const delimiter=text.includes('\t')?'\t':',',rows:string[][]=[],row:string[]=[];let value='',quoted=false,closed=false
 for(let i=0;i<text.length;i++){
  const c=text[i]
  if(quoted){if(c==='"'){if(text[i+1]==='"'){value+='"';i++}else{quoted=false;closed=true}}else value+=c;continue}
  if(c===delimiter||c==='\n'||c==='\r'){row.push(value.trim());value='';closed=false;if(c!==delimiter){if(row.some(Boolean))rows.push([...row]);row.length=0;if(c==='\r'&&text[i+1]==='\n')i++}continue}
  if(closed){if(c!==' ')throw new Error('引号结束后只能跟分隔符，请检查表格格式');continue}
  if(c==='"'){if(value.trim())throw new Error('单元格中间出现未转义引号，请检查表格格式');value='';quoted=true}else value+=c
 }
 if(quoted)throw new Error('表格引号不完整');row.push(value.trim());if(row.some(Boolean))rows.push(row)
 if(rows.length<2||rows.length>101)throw new Error('请连同表头复制，至少一行数据，最多100行')
 const headers=rows[0].map(h=>h.replace(/^\uFEFF/,'').replace(/（/g,'(').replace(/）/g,')').replace(/\s/g,''))
 if(new Set(headers).size!==headers.length||headers.some(h=>!h))throw new Error('表头不能为空或重复')
 if(rows.slice(1).some(r=>r.length!==headers.length))throw new Error('每行列数必须与表头一致，空值也需保留所在列')
 return {headers,rows:rows.slice(1)}
}
