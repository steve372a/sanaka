# GPT -> Kimi Sendback

## 2026-08-02 修复 Windows 内置 QEMU 找不到 BIOS

### 原因

- Windows QEMU 构建资源包含 `bios-256k.bin`，但安装包把它放在 `resources/qemu/share/bios-256k.bin`。
- 内置 QEMU 位于 `resources/qemu/bin`，它按标准前缀布局从 `../share/qemu` 读取数据文件，因此启动 PC 虚拟机时报 `qemu: could not load PC BIOS 'bios-256k.bin'`。

### 实际产出

- Windows `afterPack` 统一把 QEMU 数据文件放到 `resources/qemu/share/qemu`。
- 同时兼容源 QEMU 包使用 `share` 或 `share/qemu` 两种目录结构，避免重复嵌套。
- Release workflow 在上传 Windows 安装包前强制检查 `resources/qemu/share/qemu/bios-256k.bin`。
- 新增打包测试，实际模拟完整 Windows QEMU 目录并验证 BIOS 的最终位置。

### 没改什么

- 没有修改虚拟机配置、BIOS 类型、QEMU 命令或外部 QEMU 路径行为。
- 前端不需要对接修改。

## 2026-08-02 修复 Windows 安装包白屏

### 原因

- GitHub Actions 从干净 checkout 直接运行 `npm run pack:win`，而原脚本没有先运行 Vite build。
- 正式 Windows 安装包解包后确认 `app.asar` 只有 `main.js`、`preload.js` 等主进程文件，缺少整个 `dist/`；Electron 窗口和原生菜单能够出现，但 `dist/index.html` 不存在，所以内容区白屏。

### 实际产出

- `pack:win` 与 `pack:win:dir` 现在都会先执行 `npm run build`。
- Windows Actions 在上传安装包前读取最终 `app.asar`，强制检查 `dist/index.html`、至少一个前端 JS 和至少一个 CSS；缺少任一项就停止发布。
- `app.asar` 清单在 Windows 使用反斜杠，校验前会统一为 `/`；避免把实际存在的 renderer 误判为缺失。

### 后续

- 修复提交后移动 `v0.0.4(beta)` tag，重新构建并覆盖 Release 中的 Windows 安装包。

## 2026-08-02 修复首次 GitHub Actions 发布失败

### 实际产出

- Windows 构建资源实际版本为 QEMU 11.0.50；workflow、资源文件名和资源生成脚本已改为使用真实版本，不再按 11.0.1 误判失败。
- macOS QEMU 在解压目录中尚未具备 App 的 `Contents/Frameworks` 路径，不能提前运行；版本检查已移到 DMG 构建完成后，直接执行最终 `Sanaka.app` 内的 QEMU。
- Linux amd64 与 Linux aarch64 在首次 run 中已经构建成功，本次不改 Linux 打包流程。

### 验证

- workflow 继续校验 QEMU 资源 SHA256；Windows 校验实际可执行版本，macOS 校验最终 App 内可执行版本。
- 本次需要把修复提交推到 `main`，再移动 `v0.0.4(beta)` tag 触发新的完整构建。

## 2026-08-02 GitHub Actions 跨平台自动发布

### 实际产出

- 新增 `.github/workflows/build-release.yml`，只在推送 `v*` tag 时构建 Windows x64、macOS aarch64、Linux amd64 和 Linux aarch64。
- 四个平台使用 GitHub 原生 runner；macOS 使用 M1 runner，Linux aarch64 使用 `ubuntu-24.04-arm`。
- 构建均显式使用 `--publish never`，最后由独立 job 创建或更新 GitHub Release，避免 electron-builder 在 tag 环境隐式发布并要求 `GH_TOKEN`。
- Release 自动包含四个安装包、当前版本欢迎视频和统一 `SHA256SUMS.txt`。
- QEMU 与欢迎视频从隐藏草稿 Release `build-assets-v1` 下载，QEMU 继续保持 Git 忽略；runner 会校验压缩包 SHA256，并执行最终 QEMU 确认 macOS 为 11.0.1、Windows 为 11.0.50。
- 新增 `scripts/prepare-github-build-assets.sh` 和 `.github/BUILD_ASSETS.md`，以后只有升级 QEMU 或更换欢迎视频时需要更新构建资源。

### 外部资源

- 已创建隐藏草稿 Release `build-assets-v1`。
- 已上传 macOS QEMU runtime、Windows QEMU 完整目录、校验文件和 `0.0.4-beta.mp4`，总计约 175 MB。
- 草稿 Release 不会出现在正常发布列表，也不会影响 Latest。

### 验证

- workflow 通过 `actionlint`。
- 两个 QEMU 压缩包本地 SHA256 校验通过，GitHub 上传后的服务端 digest 一致。
- 从独立 macOS QEMU 压缩包成功构建 `sanaka-0.0.4beta-macos-aarch64.dmg`；包内 x86_64 与 aarch64 QEMU 均实际运行并报告 11.0.1，最终 App 通过严格 codesign 验证。
- Windows 压缩包解压后通过现有 `resolveWindowsQemuLayout()` 完整性检查。

## 2026-08-01 修复减弱动态效果开关状态

### 实际产出

- `SettingsPage` 的“减弱动态效果”开关改用已有的 `settings-motion-option__toggle` 和 `settings-motion-option__thumb` 专用样式。
- 修复原来复用 `ios-toggle__track` 导致 `:checked` 选择器无法匹配的问题；现在打开后滑块会移动，轨道也会显示启用状态。
- 没有修改 `reduceMotion` 的持久化、全局 `data-reduced-motion` 属性或其他开关。

### 验证

- `npm run typecheck` 通过。
- 相关设置页测试通过。

## 2026-08-01 白色强调色改为中性白色系

### 实际产出

- 修正 `src/lib/accentColor.ts` 的 `white` 预设：浅色主题改为白色、雾灰和浅银灰分层，不再使用 `#8A8A8A` 作为浅色强调背景。
- 白色预设的浅色 `primary`、`primaryStrong`、`primarySoft`、surface、panel 和背景全部改为浅色中性值，设置抽屉展开标题不再出现整块深灰。
- 深色主题同步改为中性灰阶，去掉原来接近纯黑的突兀层级，同时保留深色主题的对比度。
- `AccentColorPicker` 改为直接读取 `getAccentPresetColor()`，色块预览和实际运行时 palette 不再出现两套颜色。

### 验证

- `npm run typecheck` 通过。
- `src/lib/accentColor.test.ts` 新增白色预设浅色和深色变量断言。
- `git diff --check` 通过。

## 2026-08-01 pull 失败后确认 Git 强制同步

### 实际产出

- `scripts/pull.sh` 默认先执行 `git fetch`，再通过 `git merge --ff-only` 安全快进目标分支。
- 本地分支不存在时，仍然直接从 `origin/<branch>` 创建。
- 只有远程获取成功、但本地分支因分叉或工作区冲突无法安全快进时，才询问是否使用 Git 强制同步。
- 用户确认后，脚本先保存当前 HEAD 到 `refs/sanaka-backups/pull/...`，再 stash 已跟踪和未跟踪文件，最后 `reset --hard` 到远程分支。
- 网络失败和远程分支不存在不会显示强制同步选项；非交互环境也不会自行强制覆盖。

### 没改什么

- 没有加入删除仓库、重新克隆或运行 doctor 的方案。
- 没有修改 `push.sh`、`start.sh` 或 npm 环境。

### 验证

- `bash -n scripts/pull.sh` 通过。
- 隔离 Git 仓库测试通过：正常快进、分叉后拒绝覆盖、确认强制同步、备份引用、stash，以及远程分支不存在时不显示强制选项。

## 2026-08-01 恢复英文品牌标识

- 中文界面的品牌副标题恢复为原来的 `Virtual Machine Studio`。
- 关于页页脚和桌面工作区标识同步恢复原文，避免把固定品牌文案误当成普通界面翻译。
- QEMU 版本、来源状态和错误提示的中英文国际化不回退。

## 2026-08-01 QEMU 状态与中英文资源清理

### 实际产出

- 设置页不再直接显示 QEMU 的原始 `QEMU emulator version ...` 输出；只提取版本号，再通过 i18n 显示为中文“QEMU 版本 11.0.1”或英文“QEMU version 11.0.1”。
- QEMU 状态改为三种来源状态：内置 QEMU 使用绿色“Sanaka 内部 QEMU”，自动探测或用户指定的外部路径使用黄色“外部路径 QEMU”，不可用时使用红色“QEMU 不可用”。
- QEMU 检测失败不再把后端英文异常直接显示在中文界面；根据 `errorCode` 映射为中英文用户文案。
- 清理资源混排：中文界面的 `Virtual Machine Studio`、`Desktop Workspace` 改为中文；英文架构不匹配警告不再包含中文占位符，改用统一的 `{{hostArch}}`、`{{guestArch}}` i18n 变量。
- 保留 QEMU、VNC、Sanaka、TCG、Finder、路径和命令等专有名词，不做错误翻译。

### 验证

- 英文资源中已没有中文字符。
- 非测试界面中不再直接引用 `QEMU emulator version`，仅版本解析正则保留该协议输出格式。
- `npm run typecheck`、`npm run build`、`git diff --check` 通过。
- `npm test -- --run` 通过：48 个测试文件，231 个测试。

## 2026-08-01 QEMU 目录状态卡重设计

### 实际产出

- 只重做了设置“文件”里的 QEMU 运行环境区域，没有改整个设置抽屉。
- 原来的单色 `info-panel` 改成分层状态卡：显示当前来源、可用状态、QEMU 目录和版本，目录使用独立的浅色路径槽。
- 卡片背景使用中性表面到轻强调色的渐变，内部图标、状态、路径和按钮分别使用不同表面层级，避免整块纯粉色。
- 只保留“选择 QEMU 目录”按钮，并增加文件夹图标。
- 删除“恢复自动检测”按钮、页面清除处理函数、空路径恢复逻辑及相关中英文文案；目录对话框在路径为空时禁用“应用”。
- 首次安装且用户从未指定目录时，后端原有自动探测仍保留，避免新安装无法找到 QEMU。

### 实现边界

- 没有修改 QEMU 扫描器、严格目录验证、Electron IPC 或 runtime 检测规则。
- 新样式放在 `src/styles/settings-qemu.css`，由桌面端和网页端入口共同加载，避免改动单行压缩的全局 `app.css`。

### 验证

- QEMU 设置页和目录对话框相关测试通过：15 个测试。
- `npm run typecheck`、`npm run build`、`git diff --check` 通过。

## 2026-08-01 设置页与欢迎窗口回退修复

### 实际产出

- 补回欢迎窗口中英文资源，`WelcomeDialog` 不再显示 `app.welcome.*` 翻译 key。
- 设置页模板列表重新使用 `TemplateIcon`，恢复 Windows XP、Windows 98、Windows 10 和 Linux 的彩色原版图标；暗色模式继续沿用现有轻微降亮度处理。
- 实验功能恢复为行式开关布局，并补回“网页版”开关；现有五项实验设置均直接写回 `settings.experimental`。
- 更新区域重新接回 `update-settings` 设计和 Windows Phone 风格五点加载条；检查动画至少显示 800ms，结果不再三秒后自动消失。
- QEMU 路径、版本和命中来源从“默认配置”移到“文件”，原有目录选择、恢复自动检测和扫描对话框逻辑未改。

### 没改什么

- 没有修改 Electron main、preload、IPC、QEMU 检测器或更新协议。
- 没有重做现有 CSS 设计；本次复用了仓库中已经存在但未被 JSX 使用的 `experimental-option`、`update-settings` 和 `TemplateIcon` 样式。
- 没有处理根目录图标审阅文件和 `.agents/` 本地链接。

### 后续注意

- 前端后续调整 `SettingsPage` 时，不要恢复本地 `getTemplateIcon()` 通用 SVG；模板图标统一走 `src/components/TemplateIcon.tsx`。
- `experimental.webMode` 必须继续保留在实验功能界面。
- QEMU 运行环境入口属于“文件”抽屉，不要重新放回“默认配置”。

### 验证

- `npm run typecheck` 通过。
- `npm test -- --run` 通过：48 个测试文件，228 个测试。
- `npm run build` 通过。
- `git diff --check` 通过。

## 2026-08-01 accidental pull recovery

- Recovered the uncommitted renderer, Electron, runtime, packaging, update, VNC, web workspace, welcome video, and external QEMU changes from the local Codex session log and surviving build files.
- Restored the external QEMU settings entry, strict configured-directory detection, full-computer scan streaming, and runtime validation.
- Updated `scripts/pull.sh` so it creates a backup ref and stash before replacing a local branch with `origin/<branch>`.
- Kept local review assets, personal skill links, and `video/0.0.4-beta.mp4` outside the recovery commit.
- Verification passed: TypeScript, 224 Vitest tests, production build, Shell syntax, and `git diff --check`.

- 已扫描 `src/styles/app.css`、`src/components/*.tsx`、`src/pages/*.tsx`、`src/lib/accentColor.ts`。
- 没发现 `kimi-want.md` 里列出的那批旧紫色硬编码残留，例如 `#cdbaf2`、`#a78bda`、`#9279c8`、`#c4b0f0`、`#ece3fb`、`#f7f1fb`、`#3a3055`、`#2a2540`、`#252236`、`#302a45`、`#171525`，以及对应的旧 `rgba(...)` 组合。

## 改了哪些文件、哪些位置

- `src/styles/app.css`
  - `:root` 顶部主题变量区：把浅色主题里仍带旧紫偏向的表面/浮层相关硬编码改成基于 `--accent-*` 的 `color-mix(...)`，包括 `--bg-soft`、`--sidebar-surface`、`--surface-card`、`--surface-card-strong`、`--surface-floating`、`--surface-floating-soft`、`--surface-floating-muted`、`--surface-overlay`、`--input-surface-strong`。
  - `:root[data-theme="dark"]` 顶部主题变量区：把暗色主题里仍写死的旧紫底色改成基于 `--accent-*` 的变量/混色，包括 `--bg-soft`、`--line`、`--line-strong`、`--surface-raised`、`--surface-raised-strong`、`--sidebar-surface`、`--surface-card`、`--surface-card-strong`、`--surface-floating`、`--surface-floating-soft`、`--surface-floating-muted`、`--surface-overlay`。
  - 移动端暗色栏位：把 `html[data-theme="dark"] .mobile-header`、`html[data-theme="dark"] .mobile-bottom-nav` 以及对应移动端暗色底栏背景，从旧紫 `rgba(30, 26, 43, ...)` 改成基于 `var(--sidebar-surface)` 的 `color-mix(...)`。

## 还有没有未处理残留项

- `src/lib/accentColor.ts`：没改。紫色 preset 已经是一套偏粉紫的新值，没有混入旧紫残留。
- `src/components/AccentColorPicker.tsx`：没改。这里的 hex 是 5 个预设色本身，属于功能定义，不是旧主题残留。
- `src/components/AccentColorCustomDialog.tsx`：没改。默认自定义色使用的是当前紫色 preset，不是旧紫残留。
- `src/pages/MachineBuilderPage.tsx`：保留了一处 success 状态的内联 `rgba(...)`，因为它是成功态，不属于强调色残留，按要求不处理。
- `src/components/SharedFolderPanel.tsx`、`src/components/NoVncViewport.tsx`：没改。前者是成功/警告 fallback，后者是 console fallback，按要求不处理。

## 验证

- `npm run typecheck` 已通过。
## 2026-07-30 macOS 最终应用包签名

### 实际产出

- `scripts/package-sanaka-macos.sh` 现在默认在 QEMU 和动态库全部嵌入后，对最终 `Sanaka.app` 执行 ad-hoc 签名，不再依赖额外参数或环境变量启用。
- `scripts/embed-qemu-macos.sh` 在签完嵌套 QEMU 二进制、动态库和整个 App 后，强制运行 `codesign --verify --deep --strict --verbose=2`；验证失败会立即终止构建，不会继续生成 DMG。
- `scripts/quick-build-macos-app.sh` 原本就在应用打包成功后才创建 DMG，因此现在完整顺序为：构建 App、嵌入 QEMU、最终签名、严格验证、创建 DMG。

### 边界

- 这是无 Apple Developer ID 条件下的 ad-hoc 签名，用来避免发布包因为构建后修改导致签名损坏；它不会产生开发者信任或公证。
- Windows 和 Linux 打包流程未修改。

### 验证

- 修改前，现有成品报 `code has no resources but signature indicates they must be present`。
- 使用新流程的最终签名命令后，`codesign --verify --deep --strict --verbose=4` 通过，结果为 `valid on disk` 和 `satisfies its Designated Requirement`。
- 最终签名显示 `Identifier=com.sanakaprix.sanaka`、`Signature=adhoc`、`Sealed Resources version=2`。
- 相关 Shell 脚本均通过 `bash -n`，改动通过 `git diff --check`。

## 2026-07-30 版本更新到 0.0.4-beta

### 实际产出

- `package.json` 与 `package-lock.json` 的应用版本统一更新为 `0.0.4-beta`，后续安装包名称和应用内版本信息会使用新版本号。
- “关于”窗口在应用元数据尚未就绪时的兜底版本同步更新为 `0.0.4-beta`。
- `updates/beta.toml` 更新为 `0.0.4-beta`，发布日期改为 `2026-07-30`，并写入本版八项用户向更新说明。
- 正式版通道 `updates/release.toml` 保持 `0.0.1`，没有把 beta 版本误推给 release 用户。

## 2026-08-01 欢迎窗口按版本忽略

### 实际产出

- 欢迎窗口按钮从“永久不再提醒”改为“至下个版本不再提醒”，英文同步为 `Do not remind until the next version`。
- 点击后保存当前应用版本；同一版本后续启动不再显示，升级到新版本后自动重新显示。
- 桌面端和网页端使用同一套版本判断，仍然保证每次软件启动最多显示一次。
- 旧配置中的 `showWelcomeOnStartup: false` 会迁移为“当前版本已忽略”，避免升级本次代码后突然重新弹出；下个版本仍会恢复欢迎窗口。

### 没改什么

- 右上角关闭和“关闭”按钮仍只关闭本次窗口，不写入忽略设置。
- 欢迎视频加载、循环播放、下载回退和窗口视觉样式没有修改。

### 验证

- `npm run typecheck` 通过。
- 欢迎组件、设置 schema、版本判断、旧配置迁移和 App 相关测试通过：5 个测试文件，13 个测试。
- `npm test -- --run` 通过：49 个测试文件，234 个测试。
- `npm run build` 与 `git diff --check` 通过。

## 2026-08-01 Windows QEMU 构建目录兼容

### 实际产出

- Windows `afterPack` 不再假定 QEMU 可执行文件必须直接位于用户选择的目录。
- 现在统一支持三种输入：可执行文件位于目录根部、位于目录下的 `bin/`、以及用户直接选择 `bin/`。
- 当可执行文件位于 `bin/` 时，`share` 和 `lib` 会从 QEMU 根目录复制，不再因目录层级错位漏掉固件和依赖资源。
- 自动候选列表遇到“目录存在但内容不完整”的路径时会继续检查后续候选，不再被第一个空目录提前截断。
- `scripts/embed-qemu-windows.sh` 同步采用相同的根目录/二进制目录拆分，并兼容 `bin`、`Bin`、`BIN`。

### 没改什么

- macOS 打包原有的根目录/`bin` 双结构检测保持不变。
- 应用运行时外部 QEMU 检测原本已同时搜索用户目录和其 `bin/`，本次没有修改。
- QEMU 二进制、`share`、`lib` 的完整性要求没有降低。

### 验证

- 新增 4 个 Windows QEMU 目录布局测试，覆盖根目录、`bin/`、直接选择 `bin/` 和跳过不完整候选。
- `bash -n scripts/embed-qemu-windows.sh` 与 `npm run typecheck` 通过。
- `npm test -- --run` 通过：50 个测试文件，238 个测试。
- `npm run build` 与 `git diff --check` 通过。
