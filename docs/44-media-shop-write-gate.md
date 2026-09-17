# 素材任务店铺写入门禁（2026-09-10）

## 本轮实现

`compileProductPackage` 接收可选 `shopBindings`，按 listing.shopKey 和平台唯一解析店铺名称与 mallId，快照并冻结为 `plan.bindings.shopBinding`。店铺绑定改变时 executionHash 改变，sourceHash 保持商品事实的独立指纹。未提供店铺绑定时保留旧执行摘要算法，以便只读诊断旧记录；提供空数组不代表跳过校验，而是配置缺失错误。

`executePackageMedia` 的 carousel、detail、skuImages 三类统一素材任务：

1. apply 必须有店铺绑定；缺少时在任何页面操作或任务占位前失败。
2. 用当前可见店铺名称、二维码与主页编号核验绑定，核对货号、类目和编辑页地址。
3. 写入不可自动释放的任务占位和 intent，包括冻结计划与身份观察。
4. 上传前再次读取身份，成功才调用原素材执行器。
5. 上传完成后再次读取身份；不一致时记录已完成素材作为 partialResult，保留失败任务，不能直接重试。
6. 只有核验通过才返回 media_upload_recorded，结果含 shopIdentity、shopIdentityAfter 和按含店铺绑定的 executionHash 生成的素材回执。

这提供任务边界检查，不是平台事务锁，也不能保证多个浏览器或其他独立脚本不会同时切换账号。已有独立 fill/upload 调试命令尚未全部接入，不能据此宣称所有写入口都有统一门禁。

## 命令

```sh
npm run pdd:run-media -- 商品.json carousel 核验配置.json
npm run pdd:run-media -- 商品.json carousel 核验配置.json --apply
```

第一条预检，第二条才上传。配置允许 shopBindings 和 freightProfiles；格式参照43章。apply 缺少配置会在启动浏览器前报 SHOP_BINDING_REQUIRED_FOR_WRITE。预检不提供绑定仍可诊断图片，但不证明店铺身份。

执行和随后整表回读应使用同一份店铺/物流配置。绑定不同会改变执行指纹，旧素材回执不能自动变为新绑定的证据。历史回执不自动补写、升级或替代人工素材核实。

## 验证

- 本地浏览器完整素材任务测试覆盖：缺少绑定和错编号时零上传；正确绑定后上传、持久记录及独立回读；同任务重复执行阻断；上传中店铺名称变化后保留已上传明细，恢复检查返回 needs_inspection 且 retryAllowed false。
- 指纹测试覆盖：商品事实不变、店铺编号改变、外部参数变更不能改写已编译计划、空配置失败。
- 实际运行缺少配置的 apply CLI，启动浏览器前报 SHOP_BINDING_REQUIRED_FOR_WRITE。
- 最新全量144项Node测试、8项Vitest及生产构建通过，共152项。

本轮未再次上传真实店铺图片。43章已真实验证身份读取；本轮新增身份门禁＋任务日志的组合由隔离浏览器测试验证，尚未完成真实整合上传验收。未保存或发布商品。

## 下一步

统一表单执行入口仍缺失；需要在统一任务生命周期接入同样的身份/输入版本约束，完成运费、资质及素材核实，再验证草稿保存与重开。当前计划的整单阻断与人工发布边界继续保留。
