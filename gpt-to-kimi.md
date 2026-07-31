# GPT -> Kimi

这份只说前端对接点，不涉及 UI 设计。

## 背景

后端已经完成“外部 QEMU 安装目录”能力：

- 新增设置项：`settings.qemu.externalDir`
- 当它为空字符串时：按原来的自动检测逻辑工作
- 当它非空时：严格只使用这个目录和这个目录下的 `bin`
- 不再回退到 bundled / PATH / 常见安装目录

## 前端需要对接什么

### 1. 设置读写

前端设置模型里接入：

- `settings.qemu.externalDir: string`

要求：

- 允许空字符串
- 保存时原样走 `window.electronAPI.settings.save(...)`
- 清空后表示恢复自动检测

### 2. 运行环境展示

前端从这两个接口拿环境信息：

- `window.electronAPI.runtime.detectQemu()`
- `window.electronAPI.runtime.getRuntimeEnvironment()`

后端现在会返回这些新增字段：

- `source`
  - 可能值：`bundled` / `auto-detected` / `external-configured`
- `configuredExternalDir`
- `effectiveRoot`
- `errorCode`
- `errorMessage`

前端只需要消费，不需要自己推导。

### 3. 错误展示

当用户配置了外部目录但目录无效时：

- 启动虚拟机
- 预览命令
- 获取完整命令

后端都会直接返回明确错误。

前端要求：

- 优先显示后端返回的 `errorMessage`
- 不要再把它改写成泛化的 “QEMU unavailable” 一类兜底话术

### 4. 当前生效信息

前端如果要显示“当前实际命中的 QEMU 环境”，直接用后端返回值：

- 当前来源：`source`
- 当前根目录：`effectiveRoot`
- 当前配置值：`configuredExternalDir`
- 当前报错：`errorMessage`
- 当前版本：从命中的 binary `version` 里取

不要在前端自己扫描路径，也不要自己做回退判断。

## 这次后端没有做的事

- 没做设置页输入框
- 没做目录选择按钮
- 没做 monitor / settings 的展示文案
- 没做前端 i18n 文案

## 联调注意

- `source` 等新增字段在类型上目前是可选，但真实后端返回会带
- 如果前端本地 mock 了 `QemuEnvironment`，需要把这些字段补上或允许缺省
