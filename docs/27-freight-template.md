# 运费模板执行与店铺配置绑定

更新：2026-09-09。范围为已测试店铺的新建女装 T 恤编辑页。

## 真实页面证据

运费区域之前不可见的原因是服务区折叠。点击精确文本“展开修改”后，`#cost_template_id` 出现；“其他模板”单选控制模板下拉框。下拉框的只读 input 值为空，当前模板名称应读取可见 select header，不能把 input 空值判断为未选择。

模板名称不足以证明配送配置一致。执行器还读取可见 `.template-group` 中包邮、付运费和不配送区域的完整文本，并与冻结输入逐组核对（仅归一化空白，不忽略地区、数字、金额或顺序）。规则文案变化也会停止，需要重新核实。

实测货号为 `AUTO-MATRIX-20260908-02`，使用测试页已有“新疆西藏收费默认模板”。该值只证明页面行为，不代表商家已确认此配置适用于真实商品。此次没有保存草稿或发布。

报告位于 `output/playwright/real-freight/dev-2026-09-08/report.json`。目录沿用了前日命名，实际操作日期为 2026-09-09。报告中的 `completed: ["template"]` 只证明已经展开、已选其他模板后的重新选择与规则回读；完整“折叠→展开→切换模式→选模板”路径由隔离浏览器测试覆盖，不能登记为完整真实自动流程通过。真实验证使用 CLI 注入相同执行核心，交互式命令入口仍需单独验收。

## 独立执行

```bash
npm run pdd:fill-freight -- examples/pdd-freight-smoke.json
# 明确配置且测试货号一致后，填写并回读：
npm run pdd:fill-freight -- examples/pdd-freight-smoke.json --apply
npm run test:freight
```

默认仅预检；折叠时报告 `requiresExpansion`，不点击展开。写入时校验域名、类目、新建页面及货号，选择精确名称的唯一可见选项；遇到已有弹层、歧义、缺少选项或规则不一致则停止并记录部分进度。当前支持 default/other，不创建或修改模板，不支持同城配送。失败后可能已部分更改页面，不自动回滚或重试。

## 接入 ProductPackage

商品仍通过 `listing.logistics.profileKey` 引用外部店铺配置，平台模板规则不混入通用商品事实。编译器新增可选参数：

```js
compileProductPackage(productPackage, {freightProfiles: [profile]})
```

配置结构示例见 `examples/pdd-freight-profiles.template.json`，默认未确认，不可直接通过编译。每条配置包含：

| 字段 | 契约 |
|---|---|
| version | pdd-freight-profile-v1 |
| platform / shopKey / profileKey | 三项均与刊登数据精确匹配 |
| revision | 大于零的安全整数，配置变更应递增 |
| confirmation | confirmed=true、带时区时间、确认依据 reference |
| freight.mode | default 或 other |
| freight.templateName | 精确页面名称 |
| freight.expectedGroups | 人工确认的完整配送规则文本数组 |

同一绑定匹配多条配置即拒绝，包括同时传入同一配置的多个历史版本；调用方只提供当前生效版本。未匹配时不生成 freight 步骤，保留未验证阻断；匹配但未确认或结构无效时拒绝编译。confirmation 只是调用方输入声明，目前没有认证审批服务，不能代表系统已验证确认人或真实店铺身份。

```bash
npm run pdd:compile-package -- examples/product-package-tshirt.json output/package-plan/tshirt.json
# 本地准备并确认配置文件后：
npm run pdd:compile-package -- examples/product-package-tshirt.json output/package-plan/tshirt.json /path/to/confirmed-profiles.json
```

冻结后的配置写入 `bindings.freightProfile`；`sourceHash` 保持商品源数据指纹，新增 `executionHash` 同时包含商品指纹与外部配置。变更配送规则、配置版本或确认记录会改变执行指纹。该指纹为后续任务过期检测提供依据，目前尚未接入持久任务系统。

即使编译成功，也保留 `freight_live_readback_required`、真实店铺身份和其他完整性阻断，`executable` 与 `fullProductVerified` 仍为 false。独立运费 CLI 不读取店铺配置注册表，不能将其子集成功作为统一执行完成。

## 验收与后续

隔离测试覆盖折叠展开、规则变化、选项缺失、跨店匹配、重复配置、确认缺失、输入覆盖防护、配置冻结和指纹变化。全量回归结果见当前方案入口。

下一步补参考价/折扣和其他服务字段，再建立统一执行与独立整表核对。保存草稿、重开及人工发布后的链接回收仍未验收。

本轮全量验证：94 项 Node 测试＋8 项 Vitest 测试，共 102 项通过，TypeScript 检查与生产构建通过。
