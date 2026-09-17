# 店铺身份核验（2026-09-10）

## 目标与实现

新增 `scripts/pdd-shop-identity.mjs`，通过后台可见操作获取身份，不读取 Cookie、隐藏框架状态或私有接口：

1. 确認当前地址属于 `https://mms.pinduoduo.com/`，且无已打开的弹窗或下拉框。
2. 从 `#mms-header-next .user-name-name .user-name-text` 读取唯一可见店铺名称。“主账号”也使用 `.user-name-text`，因此不能只使用这个类。
3. 悬停店铺名称，点击“店铺二维码”，等待唯一可见 canvas 出现足够的黑白不透明像素，再点击“打开网页查看店铺”。按钮可点击不代表店铺链接已就绪；约5秒仍未渲染报 SHOP_QR_NOT_READY。
4. 只检查本次操作产生的新页面地址。空白页有界等待约5秒，仍为空白则报 `SHOP_HOME_NAVIGATION_UNAVAILABLE`；不推断编号。
5. 仅接受 HTTPS、精确域名 `mobile.yangkeduo.com`、路径 `/mall_page.html` 和唯一正整数 `mall_id`。保存结果去掉所有跟踪参数。不接受买家登录页或其他域名。
6. 比较配置中的内部 shopKey、平台、店铺名称、mallId。配置重复、缺失、名称或编号不一致均阻断。
7. 关闭本次创建的页面和二维码弹窗；不关闭原有页面，不保存、修改或发布商品。

独立整表回读已支持 `shopBindings` 配置。配置存在时，在回读开始与结束重新读取店铺编号；中间每项回读检查名称。无配置保持诊断能力，但报告 `shopIdentity.status=unverified`。这不是所有写入模块的统一防错店铺锁：独立填表/素材 CLI 暂未全部接入。

## 使用方式

`npm run pdd:check-package -- 商品.json 核验配置.json`

核验配置可包含：

```json
{
  "shopBindings": [
    {
      "platform": "pdd",
      "shopKey": "你的内部店铺标识",
      "shopName": "真实店铺名称",
      "mallId": "真实数字编号"
    }
  ]
}
```

shopKey 必须与商品包 listing.shopKey 一致。已有测试商品包的 `demo-shop-not-connected` 不会被自动改成正式店铺绑定。配置由受信任的本地操作者维护；不以任意调用者提交的 JSON 证明商家授权。

## 真实页面证据与限制

首次人工路径验证，从后台二维码按钮成功打开与当前账号匹配的店铺主页，并读取到数字 `mall_id` 与可见店铺名称。公开文档已移除真实店铺编号和名称。这证明读取路径存在，不证明后续调用持续可用。

自动验证最初遇到持续 about:blank。通过两次可见截图确认：弹窗刚出现时按钮已可点击，但二维码像素尚未渲染。补充可见画布就绪等待后，同一个未刷新的测试商品页成功读到上述编号，整表回读前后两次身份校验均匹配。

真实证据：

- `output/playwright/real-shop-identity/report.json`：当前测试编辑页的店铺名称、编号及已去除跟踪参数的主页地址。
- `output/playwright/real-package-readback/v2-shop-2026-09-10/report.json`：shopIdentity matched，33项字段匹配、0项差异、3项素材待核实，fullProductVerified false。
- 本轮绑定只针对虚构测试输入，内部别名仍为 demo-shop-not-connected；没有将其改成正式商家配置。
- 未保存或发布商品，未刷新原测试编辑页。

最新全量验证：143项Node测试、8项Vitest及生产构建通过。测试包括同样式账号名、严格地址与配置校验、错店阻断、已有弹窗保护、空白页清理，以及二维码延迟渲染时按钮已启用的竞态。

编译计划本身没有实时浏览器证据，仍保留 live_shop_identity_unverified；回读报告的 shopIdentity 提供当前核验结果。这还不是所有写入模块都强制验证店铺的完整交付。

## 后续接入

- 将真实单款回读的身份核验接入统一任务执行与保存门禁；保留空白页/二维码未就绪的失败策略。
- 将配置绑定纳入统一执行计划和任务摘要，执行前强制核验，避免任意独立写入模块绕过。
- 对页面中途切换店铺、身份读取失败和任务恢复，继续采用停止并核对的策略。
- 整单仍有素材内容确认、资质、运费配置、草稿重开等缺口，不应移除其他阻断。

后续更新：45章已将编译期阻断与独立回读已证实项分开，店铺回读匹配后转入 resolvedBlockers；编译期本身仍保留实时核验要求。
