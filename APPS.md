# 用户 App 目录

仓库收集多个独立表单工具。普通用户在这里选择一个具体 App，再按自己的操作系统下载对应包。每个 App 有独立名称、版本、数据目录和发布文件，不需要下载整个项目合集。

| App | 表单范围 | Windows | macOS | 状态 |
|---|---|---|---|---|
| [拼多多女装 T 恤上新助手](apps/pdd-womenswear-tshirt/README.md) | 拼多多 CN / 女装 T 恤 / 单款填表 | beta | experimental | beta |

`APPS.md` 面向最终用户；[ADAPTERS.md](ADAPTERS.md) 面向开发者。新增表单时同时创建 `apps/<app-id>/app.json` 和对应 Adapter，或者明确引用一个已有 Adapter 的单一类目 Profile。
