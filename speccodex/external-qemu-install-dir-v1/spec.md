# External QEMU Install Dir V1

## Goal

给 Sanaka 增加“外部 QEMU 安装目录”支持，但语义必须非常明确：

- 用户一旦在设置中指定了外部 QEMU 安装目录，Sanaka 之后就只使用这个目录
- 不再 silently 回退到 bundled QEMU、PATH、系统常见目录
- 如果该目录不完整、不可用或与当前需要的架构不匹配，直接返回结构化错误
- 设置页和 monitor 信息处都要明确显示当前生效的 QEMU 路径、版本和命中来源，避免用户困惑

这个功能的核心不是“多一种探测方式”，而是“让 QEMU 来源变成用户可控、可见、无歧义”。

## Product Rules

- 配置项是“QEMU 安装目录”，不是单个 exe 路径
- 该目录应理解为 QEMU runtime root；其下至少应能解析出需要的 `qemu-system-*` 和可选的 `qemu-img`
- 用户保存了该目录后，Sanaka 的 QEMU 解析策略切换为“严格外部目录模式”
- 严格外部目录模式下，不允许自动回退
- 未设置外部目录时，Sanaka 仍可保持现有 bundled / PATH / 常见目录探测逻辑
- 命中来源必须显式区分，例如：
  - `bundled`
  - `auto-detected`
  - `external-configured`
- 一旦来源是 `external-configured`，但目录无效，则不允许把来源伪装成别的来源

## Scope

本轮只做应用级外部 QEMU 目录：

- 设置中指定一个应用级 QEMU 安装目录
- runtime 探测和启动都使用这个设置
- 设置页展示当前生效 runtime 信息
- monitor / runtime 信息展示当前生效 runtime 信息

本轮不做：

- 单台虚拟机级别覆盖 QEMU 路径
- 为每个架构分别配置单独的 exe
- 自动回退到 bundled / PATH
- 自动修复目录内容
- 自动下载外部 QEMU

## Data Changes

`AppSettings` 新增应用级 QEMU runtime 配置，例如：

```ts
qemu: {
  externalDir: string;
}
```

约束：

- 默认值是 `externalDir = ""`
- 当 `externalDir = ""` 时，沿用现有自动探测逻辑
- 当 `externalDir != ""` 时，进入严格外部目录模式
- `externalDir` 保存的是用户输入后的规范化绝对路径

`QemuEnvironment` / runtime environment 结构需要补充：

- `source: 'bundled' | 'auto-detected' | 'external-configured'`
- `configuredExternalDir?: string`
- `effectiveRoot?: string`
- 每个 binary 条目保留：
  - `found`
  - `path`
  - `version`
- 顶层新增适合用户展示的错误信息字段，例如：
  - `errorCode`
  - `errorMessage`

## Detection Rules

### 1. Auto Mode

当 `settings.qemu.externalDir = ""`：

- 保持当前行为
- 允许从 bundled QEMU、PATH、常见安装目录中解析
- 命中来源按实际情况返回 `bundled` 或 `auto-detected`

### 2. External Dir Mode

当 `settings.qemu.externalDir != ""`：

- 只在 `settings.qemu.externalDir` 对应目录内查找
- 不拼接 PATH
- 不扫描常见安装目录
- 不读取 bundled 目录作为兜底
- 对 Windows / macOS / Linux 的子目录规则可以显式编码，但最终仍必须归属于这个外部目录

允许的解析方式可以包括：

- `<externalDir>/qemu-system-x86_64`
- `<externalDir>/bin/qemu-system-x86_64`
- Windows 下带 `.exe`

但这些都属于“在用户指定目录内解析”，不是回退。

### 3. Failure Behavior

外部目录模式下，如果出现以下任一情况，直接返回错误：

- 目录不存在
- 目录不可访问
- 目标架构需要的 `qemu-system-*` 不存在
- 二进制存在但不可执行

错误返回要求：

- 是结构化、用户可读的
- 包含当前配置目录
- 包含缺失的关键 binary 名称
- 不要只抛底层 ENOENT / EACCES

示例语义：

- “已配置外部 QEMU 目录，但目录不存在”
- “已配置外部 QEMU 目录，但缺少 `qemu-system-x86_64.exe`”
- “已配置外部 QEMU 目录，但无法执行 `qemu-img.exe`”

版本读取规则：

- 如果 `--version` 能读取，正常写入 `version`
- 如果 `--version` 读取失败，但文件存在且可执行，不因为这一点直接判目录无效
- 此时返回 `version = null`
- 真正的可用性由后续启动时再验证

## Startup Rules

- 启动虚拟机前使用当前 settings 重新解析 runtime environment
- 如果当前处于严格外部目录模式且探测失败，启动直接失败
- 失败时 renderer 收到的是结构化启动错误，不是模糊的 “QEMU unavailable”
- monitor / runtime detail 中应能看到：
  - 当前来源
  - 当前外部目录
  - 本次实际命中的系统二进制路径
  - 版本信息

## UI Changes

### Settings Page

设置页 Runtime 区新增：

- 外部 QEMU 安装目录输入框
- 目录选择按钮
- 手工编辑路径
- 显示当前 runtime 状态卡片：
  - 来源
  - 生效根目录
  - 各 binary 路径
  - 版本
  - 当前错误

交互规则：

- 用户保存外部目录后，如果目录无效，设置可以保存，但 UI 必须立即明确显示错误状态
- 不能把无效目录自动改回自动探测
- 不能显示“已切换成功”但实际上仍在用 bundled
- 用户把目录清空后，Sanaka 立即恢复自动探测，并刷新设置页与 monitor 显示

### Monitor / Runtime Info

monitor 信息处新增或补齐：

- 当前 QEMU 来源
- 当前 QEMU 根目录
- 当前架构对应 system binary 路径
- `qemu-img` 路径
- 版本字符串

如果当前来源是 `external-configured` 且无效：

- monitor 中要明确显示为错误状态
- 不能隐藏成普通“未检测到”

## Error Model

建议增加专门的 runtime 错误码：

- `QEMU_EXTERNAL_DIR_MISSING`
- `QEMU_EXTERNAL_DIR_UNREADABLE`
- `QEMU_EXTERNAL_BINARY_MISSING`
- `QEMU_EXTERNAL_BINARY_NOT_EXECUTABLE`

其中 `version = null` 不必须映射成致命错误；它可以只是状态信息。

这些错误码至少要能用于：

- 设置页状态显示
- 启动失败弹窗
- monitor/runtime 详情

## Platform Notes

### Windows

- 目录内二进制通常是 `.exe`
- 常见布局可能是根目录或 `bin/`
- 该能力与现有中文路径代理不是同一层问题，不要混在一起
- 即使外部目录正确，机器镜像路径仍可能需要路径代理，这两者要分开显示

### macOS

- 外部目录可能来自用户自编译 QEMU 或 Homebrew 拷贝
- 如果依赖动态库不完整，应作为外部目录错误暴露给用户

### Linux

- 用户可能指向 distro 包安装结果的某个目录
- 如果要支持 `/usr/bin` 这种目录，也应显式由用户填写，而不是系统偷偷回退

## Non-Goals

- 不解决 libvirt
- 不解决 RDP
- 不做 runtime 自动下载
- 不做多 runtime profile
- 不做“如果外部目录坏了就偷偷用内置 QEMU”

## Acceptance Criteria

- 设置中可以切换到“指定安装目录”模式
- 设置中可以填写或清空外部 QEMU 安装目录
- 填写目录后，Sanaka 只从该目录解析 QEMU
- 目录无效时，设置页能立即显示明确错误
- 目录无效时，启动虚拟机直接失败，不发生回退
- 清空目录后，Sanaka 恢复自动探测
- 设置页能显示当前生效路径、版本、命中来源
- monitor / runtime 信息也能显示当前生效路径、版本、命中来源
- 用户可以明确知道“现在到底用的是哪个 QEMU”
