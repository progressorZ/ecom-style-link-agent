import config from '../config/pdd/tshirt-v1.json' with { type: 'json' }

export function assertPddEditorUrl(rawUrl) {
  const url = new URL(rawUrl)
  if (url.protocol !== 'https:' || url.hostname !== config.scope.host || url.pathname !== config.scope.path) {
    throw new Error(`页面不在已登记的拼多多商品编辑器范围内：${url.origin}${url.pathname}`)
  }
}

export function assertActionAllowed(actionName) {
  if (config.safety.forbiddenActions.includes(actionName)) throw new Error(`禁止自动执行平台发布动作：${actionName}`)
  if (actionName !== config.safety.allowedTerminalAction) throw new Error(`未登记的终态操作：${actionName}`)
}

export function buildFieldPlan(observedLabels) {
  const labelCounts = new Map(observedLabels.map((label) => [label, observedLabels.filter((item) => item === label).length]))
  return config.fields.map((field) => ({
    ...field,
    observedCount: labelCounts.get(field.label) || 0,
    status: labelCounts.get(field.label) === 1 ? 'unique_label' : labelCounts.get(field.label) ? 'ambiguous_label' : 'not_visible'
  }))
}

export function buildVariantRowKey(colorLabel, sizeLabel) {
  if (!colorLabel?.trim() || !sizeLabel?.trim()) throw new Error('规格行必须同时具有颜色和尺码')
  return `${colorLabel.trim()}::${sizeLabel.trim()}`
}

export { config as tshirtLocatorContract }

export function assessLocatorCoverage(fieldResults, saveDraftCount, fields = config.fields) {
  const checked = fields.map((field) => {
    const matches = fieldResults.filter((item) => item.key === field.key)
    const result = matches[0]
    if (matches.length !== 1) return { key: field.key, status: 'missing_or_duplicate_result' }
    if (result.status !== 'unique') return result
    const control = result.control
    const textControl = control && (control.tag === 'textarea' || (control.tag === 'input' && ['text', 'number', null, ''].includes(control.type)))
    const comboControl = control && (control.tag === 'select' || control.role === 'combobox' || (control.component === 'beast-core-select' && ['beast-core-select', 'beast-core-select-header', 'beast-core-select-htmlInput'].every((evidence) => control.componentEvidence?.includes(evidence))))
    const kindMatches = field.control === 'text' ? textControl : comboControl
    const placeholderMatches = (!field.placeholderContains || control?.placeholder?.includes(field.placeholderContains)) && (!field.placeholder || control?.placeholder === field.placeholder)
    const status = !kindMatches ? 'wrong_control_type' : !placeholderMatches ? 'wrong_placeholder'
      : control.disabled ? (field.whenDisabled === 'readback_only' ? 'derived_readback_required' : 'disabled_control')
      : control.readOnly ? 'readonly_control'
      : field.control === 'multi_combobox' && !control.multiple ? 'unverified_multiselect' : 'unique'
    return { ...result, locatorStatus: 'unique', status, permittedOperation: status === 'unique' ? 'candidate_write' : status === 'derived_readback_required' ? 'readback_only' : 'none' }
  })
  return {
    fields: checked,
    basicFieldsLocated: checked.length === fields.length && checked.every((field) => ['unique', 'derived_readback_required'].includes(field.status)),
    basicFieldsReady: checked.length === fields.length && checked.every((field) => field.status === 'unique') && saveDraftCount === 1,
    ready: false,
    unverifiedSections: ['categoryBreadcrumb', 'variantMatrix', 'sizeLinkage', 'mediaUpload', 'logistics'],
    coverageNote: '仅检查基础字段定位；完整 R1 尚未实现，不可据此开始真实填表。'
  }
}
