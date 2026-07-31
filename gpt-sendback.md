# GPT -> Kimi Sendback

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
