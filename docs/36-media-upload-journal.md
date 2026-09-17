# 上传任务意图、结果与引用记录

2026-09-09。新增 executePackageMedia 连接统一ProductPackage与已有carousel/detail/skuImages执行器；新增命令入口。

```bash
npm run pdd:run-media -- /path/to/product.json carousel
npm run pdd:run-media -- /path/to/product.json carousel --apply
```

step可替换为detail或skuImages。默认只读预检；--apply只执行指定素材步骤，不保存或发布商品。现有执行器的空图片区、规格、图片解码、货号及类目保护继续生效。完整ProductPackage仍有其他阻断，此入口是开发中的素材步骤运行器，不能当成完整商品任务。

## 持久记录顺序

1. 编译并冻结商品计划，核对编辑页与货号。
2. 在output/media-tasks下以shopKey＋精确editorUrl＋stepId生成目录键，排他创建目录。已有目录时不调用上传，要求先对账。
3. 排他写intent.json并同步文件，记录完整计划、URL和步骤，之后才允许执行上传。
4. 上传结束后再次检查页面，验证完成条目覆盖每个预期位置/SKU，生成带scope的receipt，与原始report一起保存result.json。
5. 失败写failure.json，保留异常和部分结果，状态needs_inspection、mayHaveUploaded=true。目录保留，不自动删除或重试。

三个媒体步骤分别记录，允许同一编辑页处理不同区域；新版本也不自动绕过旧页面同一步骤的占用。若执行前预检失败而已写意图，同样保留待核对，当前没有自动恢复界面。记录文件权限0600；没有登录凭据写入意图，但本地路径和商品资料需要正常备份保护。

文件进行了fsync；尚未完成断电、文件系统故障和进程崩溃故障注入验收，不能宣称完整容灾。目录占用仅保护该入口，其他独立CLI仍可操作同一页面，后续需要统一店铺执行锁。

## 与回读连接

result.json包含receipt，满足文档35的版本、店铺、商品、编辑页、assetId、目标位置/规格、源哈希和远程地址契约。可将receipt组成readback-context.json的mediaReceipts数组交给pdd:check-package。

不从历史无范围日志生成新记录；只接受本次执行器完整成功的结果。引用生成不等于视觉内容审核，contentVerified仍false，店铺身份验证及整单blockers继续保留。

## 验收范围

本轮完成模块连接与本地生命周期测试：上传动作前能读到意图、重复范围阻断、失败不释放占用、部分结果不能生成receipt。全量测试继续覆盖原各上传执行器。

尚未在真实页面跑新任务入口，未生成真实上传receipt，未证明上传→持久记录→综合核对端到端通过。本轮没有修改平台页面，没有保存或发布。下一步需要在干净测试商品上验证这条链路，并增加记录加载/对账与店铺锁。

最新全量验证：119项Node测试＋8项Vitest，共127项通过，TypeScript检查及生产构建通过。

## 追加验收：隔离浏览器完整主图链路

已新增集成测试：完整ProductPackage → 默认预检无上传 → --apply对应核心执行 → 两张实际PNG经浏览器file input顺序处理 → result.json落盘 → 重新读取receipt → 当前DOM及源文件哈希独立核对。重复执行被阻断，页面远程图片替换被检出。此测试全部网络由本地fixture拦截，不能视为真实拼多多端到端验收。

增加只读记录检查：

```bash
npm run pdd:inspect-media-task -- output/media-tasks/<任务目录键>
```

返回recorded时还会根据intent中的计划和原始report重建引用记录并核对保存的receipt；只有字段一致才返回记录。缺intent或缺result为unknown，有failure为needs_inspection。缺result可能仍在运行，也可能进程中断，不能据此判断已停止。所有结果retryAllowed=false，该工具不会释放目录、重试或回滚。

文件内容一致性检查不等于防篡改认证；本机记录的权限、来源可信度及外部店铺身份仍需后续Worker体系保障。

2026-09-09：完整主图任务至引用核验的隔离浏览器集成测试通过，新增只读任务记录检查，未知或失败不允许盲重试。最新121项Node＋8项Vitest共129项测试及构建通过；真实新入口验收仍待完成。
