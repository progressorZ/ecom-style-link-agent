# GitHub 社区启用清单

本文件供仓库管理员在首次公开仓库时使用。仓库内已经包含 README、LICENSE、CONTRIBUTING、CODE_OF_CONDUCT、SECURITY、SUPPORT、Issue 表单、Discussion 表单、Pull Request 模板和 CI；以下项目必须在 GitHub 网页中启用或确认。

## 1. 仓库基本信息

在仓库首页右侧 About 区域设置：

- Description：自动填写电商后台复杂、重复的商品上新表单；每个平台和类目作为独立 App 发布。
- Website：暂时留空，后续有文档站再填写。
- Topics：ecommerce、browser-automation、playwright、product-listing、seller-tools、typescript、pinduoduo。
- 勾选 Releases、Packages、Discussions（启用后）。

不要在 Description 中写“支持所有平台”。应明确当前可运行范围，路线图能力不能写成已经支持。

## 2. 启用 Discussions

进入 **Settings → General → Features → Discussions → Set up discussions**，发布并置顶欢迎帖。

保留或创建以下分类：

| 分类 | 格式 | 说明 |
|---|---|---|
| Announcements | Announcement | 只有维护者发布版本及兼容通知 |
| Q&A | Question and answer | 用户提问并标记答案 |
| Ideas | Open-ended | 新平台、类目和架构建议 |
| Show and tell | Open-ended | 展示 Adapter、使用经验及教程 |

分类英文名称建议保持 GitHub 默认值，使 .github/DISCUSSION_TEMPLATE/ 中的文件名与分类 slug 对应。发布欢迎帖后置顶并锁定主楼，正文至少包含：

1. 当前只支持拼多多中国站女装 T 恤单款填表。
2. 下载包和五步使用入口。
3. Q&A、Ideas、Issues、Pull Requests 的分流规则。
4. 禁止提交凭据、二维码、店铺身份和完整 data 目录。
5. CONTRIBUTING、CODE_OF_CONDUCT、SECURITY 链接。

## 3. Issues 与标签

在 **Settings → General → Features** 启用 Issues。仓库已经关闭普通用户的空白 Issue，只显示结构化表单。

创建以下初始标签：

- bug：可复现错误。
- adapter：平台或类目适配。
- proposal：尚在确认范围的提案。
- question：使用问题，通常转到 Discussions。
- good first issue：范围明确、风险低、验证方法完整的新手任务。
- help wanted：维护者确认需要社区帮助。
- needs-reproduction：缺少可复现步骤。
- needs-real-page-verification：模拟测试通过，等待授权商家实页验证。
- privacy-review：截图、夹具或报告需要脱敏检查。
- breaking-change：会影响 Schema、Adapter 或数据迁移。

不要批量制造空的 good first issue。只有维护者能够解释验收条件并及时评审时才添加该标签。

## 4. 安全设置

进入 **Settings → Security → Private vulnerability reporting** 并启用私密漏洞报告。随后在 SECURITY.md 中写入可长期使用的私密联系方式；不要把个人微信二维码作为唯一安全入口。

同时启用：

- Dependabot alerts。
- Dependabot security updates。
- Secret scanning，以及当前账户方案支持的 push protection。

发布前确认历史中没有 Cookie、token、二维码、店铺编号、真实用户图片和浏览器 profile。

## 5. 分支和 Pull Request 规则

为 main 创建 Ruleset 或分支保护：

- Require a pull request before merging。
- Require status checks to pass，选择 CI 的 verify job。
- Require conversation resolution before merging。
- 阻止 force push 和删除 main。
- 有两名以上活跃维护者后，要求至少一名批准者。

项目只有一名维护者时，不要启用无法由本人满足的强制外部审批。此时仍应通过 Pull Request 保留变更记录，并等待 CI 通过再合并。

明确维护者用户名后再添加 .github/CODEOWNERS。建议共享 Schema、运行时、安全与发布脚本由核心维护者负责，各 adapters/&lt;id&gt;/ 和 apps/&lt;id&gt;/ 由对应维护者负责。

## 6. Releases

首次版本使用 GitHub Pre-release，例如 v0.1.0-beta。每个 App 按系统独立附加文件：

- &lt;app-id&gt;-v&lt;version&gt;-windows-x64.zip
- &lt;app-id&gt;-v&lt;version&gt;-windows-x64.zip.sha256
- &lt;app-id&gt;-v&lt;version&gt;-macos-universal.zip
- &lt;app-id&gt;-v&lt;version&gt;-macos-universal.zip.sha256

Release Notes 必须写清支持的平台、站点、叶子类目、验证日期、操作系统状态、人工处理项和已知限制。

## 7. 即时群的启用条件

首发阶段使用 GitHub Discussions 即可。满足以下条件后再考虑 Discord、微信群或 QQ 群：

- 每周持续出现 Discussions 无法承载的即时交流。
- 至少有两名能够轮流处理违规和敏感信息的管理员。
- 有固定规则将群内结论整理回 GitHub。
- 有长期有效的加入入口，而不是频繁失效的二维码。

即时群用于交流和互助，不作为 Bug、兼容性结论、路线图决定或发布通知的唯一存档。

## 8. 公开后的日常节奏

- 每周至少一次整理新 Discussion 和 Issue。
- 对已回答的 Q&A 标记答案。
- 把明确的 Ideas 转为 Issue，并补齐验收条件。
- 每个 Release 发布一篇 Announcement。
- 每月检查 Adapter 的维护者、最后真实验证日期和成熟度。
- 长期无人维护或平台页面失效的 Adapter 降级为 experimental 或 deprecated。
