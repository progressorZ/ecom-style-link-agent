const messages:Record<string,string>={
 SERVICES_REQUIRE_MANUAL_CORRECTION:'商家页服务设置与工作台不一致。请检查周边区域当天发货、假一赔十等选项；修改一致后点击“核对商品”，无需重新填写。',
 SHOP_QR_ENTRY_UNAVAILABLE:'没有找到可操作的“店铺二维码”入口，请关闭顶部菜单或遮挡层后再核对。',
 SHOP_QR_MODAL_AMBIGUOUS:'店铺二维码窗口没有正常打开，请关闭页面上的弹窗后再核对。',
 SHOP_CLOSE_POPUP_FIRST:'商家页面仍有弹窗或下拉框打开，请先关闭，再继续核对。',
 MEDIA_TASK_EXISTS_RECONCILE_REQUIRED:'这个页面已有图片上传记录，旧任务阻止重复上传，并不是图片格式错误。请先核对页面已上传的图片。',
 MEDIA_PREVIOUS_UPLOAD_INCOMPLETE:'上次图片上传中断或缺少完成记录，无法确认是否全部上传。请在商家页核对并人工补齐本组图片。',
 MEDIA_PREVIOUS_UPLOAD_CHANGED:'页面图片或本地图片与上次上传记录不一致，不能直接跳过或重复上传。请核对本组图片及顺序。',
 MEDIA_RECEIPT_TARGETS_INVALID:'当前图片数量或对应规格与上次上传记录不同，请核对商家页图片。',
 MEDIA_RECEIPT_ENTRY_INVALID:'当前图片与原上传记录的对应关系已改变，请核对商家页图片。',

 COLOR_OPTION_MISSING_OR_AMBIGUOUS:'程序未能唯一匹配商品颜色。请核对录入的颜色名称与平台颜色选项；本次旧记录没有保存具体失败的颜色。',
 COLOR_OPTIONS_NOT_READABLE:'颜色面板已打开，但程序没有读到颜色选项。这是页面识别问题，请保留页面并反馈任务报告。',
 CLOSE_EXISTING_COLOR_PANEL:'颜色选择面板仍然打开，请先取消或完成当前选择，再核对商品。',
 SIZE_EXISTING_VALUES_BLOCK_COLUMN_CHANGE:'尺码表已有尺寸，不能自动换列。请在原页面核实并手动调整后重试。',
 SIZE_EXISTING_VALUES_BLOCK_RANGE_CHANGE:'尺码表已有尺寸，不能自动切换区间模式。请在原页面核实后手动调整。',
 SIZE_RANGE_CONTROL_UNAVAILABLE:'平台当前列没有可操作的区间开关，请在商家页人工处理。',
 SIZE_EXTRA_COLUMN:'尺码表有额外列，请核对模板与平台选项。',
 SIZE_SKU_ROWSET_MISMATCH:'尺码表行与颜色尺码规格不一致，请核对销售尺码。',
 SIZE_VALUE_INVALID:'尺寸需为0～300之间的正数，最多一位小数；区间下限不能大于上限。',
 SIZE_RANGE_MODE_INCONSISTENT:'同一尺寸列的所有尺码必须统一使用单值或区间。',

 REFERENCE_PRICE_MUST_EXCEED_ALL_SINGLE_PRICES:'参考价必须高于所有颜色尺码规格的单买价，请修改后重新校验。',
 SKU_VALUES_INVALID:'请核实价格和库存：单买价不能低于拼单价，库存必须为非负整数。',
 SKU_DUPLICATE_PLAN:'规格组合或商家编码重复，请更新颜色尺码规格，由系统重新生成编码。',
 DISABLED_SKU_REQUIRES_ZERO_STOCK:'停用规格 的库存必须为 0，请核实后填写。',
 SKU_ALL_DISABLED:'至少需要一个启用规格。',IMAGE_DUPLICATE_CONTENT:'同一组图片存在重复内容，请移除重复图片。',
 IMAGE_PLAN_INVALID:'图片不能为空，每组最多 10 张，请检查主图、详情图和 颜色规格图。',
 IMAGE_DUPLICATE_PATH:'同一组图片存在重复文件，请移除重复项。',
 SHOP_BINDING_INVALID:'店铺名称或编号无效，请填写平台显示的名称与纯数字店铺编号。',
 FREIGHT_PLAN_INVALID:'运费配置不完整，请填写模板名称及实际地区收费规则。',
 SPARSE_MATRIX_UNSUPPORTED:'本版要求每种颜色使用相同的尺码集合。其他组合请在平台手工填写。',
 dependent_and_required_attribute_coverage_incomplete:'检查当前类目是否还有额外必填属性。',
 qualification_requirements_unverified:'按平台提示核实品牌或商品所需资质。',
 live_category_binding_unverified:'确认当前叶子类目确为女装 T 恤。',
 size_template_unverified:'人工确认平台尺码模板适用。',
 independent_whole_form_readback_unimplemented:'支持字段已单独核对；整页未覆盖内容仍需人工检查。',
 unconfirmed_evidence:'部分输入资料尚未由用户确认。',
 brand_live_selection_verification_required:'检查品牌选择结果与实物资料一致。'
}
export function explainLiveMessage(raw:string){raw=raw.replace(/\u001b\[[0-?]*[ -/]*[@-~]/g,'')
 if(messages[raw])return messages[raw];
 if(raw.includes('locator.click: Timeout')&&raw.includes('店铺二维码'))return '读取店铺身份时，“店铺二维码”入口被页面顶部浮层遮挡。程序已停止，商品不会发布；请更新并重启工作台后继续。'
 if(raw.startsWith('SERVICES_REQUIRE_MANUAL_CORRECTION:')){try{
 const differences=JSON.parse(raw.slice('SERVICES_REQUIRE_MANUAL_CORRECTION:'.length)) as {field:string;expected:unknown;observed:unknown}[]
 const labels:Record<string,string>={goodsType:'商品类型',secondHand:'是否二手',customized:'是否定制',presale:'是否预售',inventoryDeduction:'库存扣减方式',groupSize:'拼单人数',sevenDayReturns:'7天无理由退货',nearbySameDay:'周边区域当天发货及揽收',authenticityPromise:'假一赔十'}
 const value=(v:unknown)=>typeof v==='boolean'?(v?'已勾选':'未勾选'):v==='payment_success'?'支付成功减库存':String(v??'未读取到')
 return '服务设置不一致：'+differences.map(d=>`“${labels[d.field]??d.field}”工作台为${value(d.expected)}，商家页为${value(d.observed)}`).join('；')+'。请按实际服务承诺修改商家页或工作台，使两边一致，再点击“核对商品”，无需重新填写。'
 }catch{return messages.SERVICES_REQUIRE_MANUAL_CORRECTION}}
 const colorError=raw.match(/^(COLOR_OPTION_MISSING|COLOR_OPTION_AMBIGUOUS|COLOR_OPTION_DISABLED):(.*)$/s)
 if(colorError){try{const detail=JSON.parse(colorError[2]);const color=String(detail.color);const options=Array.isArray(detail.available)?detail.available.map(String).join('、'):'';return colorError[1]==='COLOR_OPTION_MISSING'?`平台颜色选项中没有找到“${color}”。请核实实物颜色，并将录入名称改成平台对应名称，修改后重新检查该颜色的价格、库存和图片。当前可选：${options||'未读取到'}。`:colorError[1]==='COLOR_OPTION_DISABLED'?`平台的“${color}”选项不可选，请在商家页面检查原因。`:`程序找到了多个“${color}”选项，无法确定应点击哪个。这是页面识别问题，请反馈任务报告。`}catch{return '颜色匹配失败，请核对平台颜色名称并反馈任务报告。'}}
 if(raw.startsWith('SIZE_COLUMN_UNAVAILABLE:'))return '平台没有找到尺寸列：'+raw.slice('SIZE_COLUMN_UNAVAILABLE:'.length)+'，请确认页面模板或人工补充。';if(raw.startsWith('ENOENT'))return '本机图片文件不存在，请重新选择图片并载入。';if(raw.startsWith('IMAGE_FILE_SIZE_INVALID'))return '图片为空或超过当前 3MB 限制，请重新选择。';return raw}
