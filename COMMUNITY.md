# 社区与交流

本项目希望成为电商平台重复填表工具的开源合集。讨论内容应当能够被后来者搜索、验证和继续维护，因此正式社区以 GitHub 仓库为中心。

## 到哪里提出内容

| 你的需求 | 使用入口 |
|---|---|
| 不会使用、启动失败、想确认操作方法 | GitHub Discussions 的“Q&A”分类 |
| 提议新平台、新类目或较大的产品方向 | GitHub Discussions 的“Ideas”分类 |
| 分享已完成的 Adapter、测试经验或使用成果 | GitHub Discussions 的“Show and tell”分类 |
| 报告能够稳定复现的程序错误或平台页面变化 | GitHub Issues，并选择对应表单 |
| 准备贡献代码 | 先讨论或认领 Issue，再提交 Pull Request |
| 报告 Cookie、登录状态、越权写入等安全问题 | GitHub 私密漏洞报告；不要创建公开 Issue |

Issues 用于可执行、可验收的工作，Discussions 用于问答和尚未确定范围的想法。讨论形成明确结论后，再转成 Issue 跟踪实现。

## 推荐的 Discussions 分类

仓库管理员首次启用 Discussions 时创建或保留以下分类：

| 分类 | 格式 | 用途 |
|---|---|---|
| 📣 Announcements | Announcement | 版本发布、兼容性变化和维护通知 |
| 🙏 Q&A | Question and answer | 安装、使用和排错；可标记最佳答案 |
| 💡 Ideas | Open-ended | 新平台、新类目和架构建议 |
| 🙌 Show and tell | Open-ended | 展示 Adapter、自动化经验和实际效果 |

置顶一篇“欢迎来到社区”公告，说明当前只支持的 App、提问入口、隐私要求和贡献指南。不要为每个平台建立独立聊天群；先用 Discussion 标题及标签标记平台和类目，等单个平台形成稳定维护者和持续交流后再拆分。

## 即时交流群

Discord、微信群、QQ群或其他聊天群可以后续添加，但应遵守以下原则：

- README 只链接由维护团队管理的官方群。
- 群内形成的兼容性结论、排错方法和功能决定，应整理回 Discussion、Issue 或文档。
- 不在群里收集 Cookie、token、二维码、远程控制权限或完整的 `data` 文件夹。
- 微信群二维码会过期，适合使用长期有效的加入说明或联系入口，不直接把临时二维码写进仓库。
- 群管理员和行为处理方式应公开；所有社区空间遵守 [行为准则](CODE_OF_CONDUCT.md)。

项目刚公开时建议先启用 GitHub Discussions。出现稳定的日常交流量和至少两名管理员后，再建立即时群，避免问题散落在无法搜索的聊天记录中。

## 提问前准备

请先搜索已有文档、Discussion 和 Issue。提问时提供：

- 使用的 App、版本和下载包名称。
- Windows 或 macOS 版本、浏览器名称及版本。
- 操作到了哪一步、期望结果和实际结果。
- 已脱敏的错误文字或任务报告。

请移除账号、手机号、Cookie、token、二维码、店铺编号、商品链接、订单、地址和真实客户数据。截图边缘、浏览器地址栏和页面标题也可能包含身份信息。

## 参与贡献

新增平台或类目请先阅读 [贡献指南](CONTRIBUTING.md) 和 [Adapter 贡献规范](docs/55-adapter-contribution-spec.md)。适合第一次贡献的工作会标记 `good first issue`；需要维护者协助确认范围的工作会标记 `help wanted`。
