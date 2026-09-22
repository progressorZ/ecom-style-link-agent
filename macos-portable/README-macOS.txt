电商上新助手 macOS 免安装版

本 ZIP 同时支持 Apple Silicon（M 系列）和 Intel Mac，已包含两个架构的 Node.js 运行时和全部依赖，启动时不需要在线安装。当前 App 的用途、已支持功能和限制请先阅读 README-App.md。

1. 完整解压 ZIP，不要在压缩包预览中运行。
2. 双击 Start-PDD-Assistant.command，保持终端启动窗口打开。
3. 如果系统首次阻止打开，请在“系统设置 → 隐私与安全性”核对来源后选择允许；不要关闭系统安全功能。
4. 按 README-App.md 的流程录入资料。需要商家页面时，使用工作台打开的专用浏览器登录；验证码、滑块和最终发布由本人处理。
5. 工作台标为“实验性”或“尚未启用自动填表”的 App 只整理本地资料，不会填写平台页面。

个人商品资料、图片、报告和专用浏览器登录状态保存在 data 文件夹。同一个 App 每次只打开一个启动窗口；不同 App 会自动使用各自的本机端口和数据目录。更新同一个 App 时先使用工作台的一键备份，或备份整个 data 文件夹；不要跨 App 混用，也不要把使用后的 data 分享给别人。

启动失败时双击 Diagnose-PDD-Assistant.command。项目没有 Apple 商业签名，请只从项目官方 GitHub Release 下载并核对 SHA-256。

本软件采用 Apache License 2.0，许可证见 LICENSE，署名说明见 NOTICE。
