# Sanaka 强调色规范

这份规范基于当前代码实现整理，不是脱离代码另起一套。

涉及代码：

- [src/lib/accentColor.ts](/Users/steve372dzudo/sanaka/src/lib/accentColor.ts)
- [src/domain/schemas.ts](/Users/steve372dzudo/sanaka/src/domain/schemas.ts)
- [src/domain/defaults.ts](/Users/steve372dzudo/sanaka/src/domain/defaults.ts)
- [src/hooks/useAccentColor.ts](/Users/steve372dzudo/sanaka/src/hooks/useAccentColor.ts)
- [src/components/AccentColorPicker.tsx](/Users/steve372dzudo/sanaka/src/components/AccentColorPicker.tsx)
- [src/components/AccentColorCustomDialog.tsx](/Users/steve372dzudo/sanaka/src/components/AccentColorCustomDialog.tsx)
- [src/pages/SettingsPage.tsx](/Users/steve372dzudo/sanaka/src/pages/SettingsPage.tsx)
- [src/styles/app.css](/Users/steve372dzudo/sanaka/src/styles/app.css)

## 1. 当前实现模型

现在的强调色系统是三层：

1. 设置层
   - `settings.accentColor`
   - 支持 `preset` 和 `custom`
2. 运行时变量层
   - `applyAccentColor()` 把设置写入 `:root` 的 CSS 变量
3. 主题语义层
   - `app.css` 再把这些强调色变量映射成真正给组件用的语义变量

不要跳过第 2、3 层，直接在组件里写 hex。

## 2. 数据结构

### 2.1 预设色

当前预设：

- `purple`
- `blue`
- `orange`
- `white`
- `green`

定义位置：

- [src/lib/accentColor.ts](/Users/steve372dzudo/sanaka/src/lib/accentColor.ts)

`AccentColorPicker` 通过 `getAccentPresetColor()` 读取预设的 `lightPrimary`，不再维护第二份色值。

要求：

- 新增预设时，更新 `PRESET_PALETTES` 和 `accentColorPresetSchema`

### 2.2 自定义色

当前自定义只暴露 4 个入口色：

- `lightPrimary`
- `lightSurface`
- `darkPrimary`
- `darkSurface`

定义位置：

- [src/domain/schemas.ts](/Users/steve372dzudo/sanaka/src/domain/schemas.ts)

当前代码行为：

- 自定义模式下，并不会真正生成一整套细分层级
- `derivePalette()` 是把很多派生位直接回落到这 4 个入口色

这意味着：

- 现在的自定义色能力是“可用”，但精细度不如预设色
- 后续如果要增强自定义色，不应先去改组件，而应先改 `derivePalette()`

## 3. 变量分层

### 3.1 源变量层

这一层由 `applyAccentColor()` 写入：

- `--accent-light-primary`
- `--accent-light-primary-strong`
- `--accent-light-primary-soft`
- `--accent-light-surface`
- `--accent-light-panel`
- `--accent-light-panel-soft`
- `--accent-light-panel-muted`
- `--accent-light-bg`
- `--accent-dark-primary`
- `--accent-dark-primary-strong`
- `--accent-dark-primary-soft`
- `--accent-dark-surface`
- `--accent-dark-panel`
- `--accent-dark-panel-soft`
- `--accent-dark-panel-muted`
- `--accent-dark-bg`

规则：

- 这层只由 `src/lib/accentColor.ts` 管
- 组件和页面不要直接写这层变量，除非是在做主题变量映射

### 3.2 主题映射层

这一层在 [src/styles/app.css](/Users/steve372dzudo/sanaka/src/styles/app.css) 的 `:root` 和 `:root[data-theme="dark"]` 里做：

- `--accent-primary`
- `--accent-primary-strong`
- `--accent-primary-soft`
- `--accent-surface`
- `--accent-panel`
- `--accent-panel-soft`
- `--accent-panel-muted`
- `--accent-bg`

规则：

- 亮暗主题切换只在这里做
- 不要在组件级 selector 里重新判断 light/dark 再去切一遍强调色

### 3.3 语义变量层

这一层才是业务样式真正应该消费的：

- `--bg`
- `--panel`
- `--line`
- `--primary`
- `--primary-strong`
- `--surface-raised`
- `--sidebar-surface`
- `--surface-card`
- `--surface-floating`
- `--input-surface`
- `--interactive-surface`
- `--link-accent`
- `--border-subtle`

规则：

- 业务样式优先用语义变量
- 只有在确实是“强调色效果本身”时，才直接用 `--accent-*` 或基于它做 `color-mix`

## 4. 组件层使用规则

### 4.1 允许

- 用 `var(--primary)` 表达主强调
- 用 `var(--surface-card)`、`var(--surface-floating)` 表达强调色参与过的表面
- 用 `color-mix(in srgb, var(--accent-primary) X%, transparent)` 做 hover、focus、soft bg
- 用 `color-mix(in srgb, var(--accent-primary-strong) X%, transparent)` 做边框、描边、弱高亮

### 4.2 不允许

- 在组件里直接写预设色 hex，比如 `#C678FF`
- 在组件里写“旧紫色残留”这类硬编码，再指望以后统一替换
- 同一个 UI 区块里同时混用 `--primary`、`--accent-light-primary`、裸 hex
- 把强调色逻辑埋进 TSX 内联 style，除非这个值本身就是颜色选项预览

### 4.3 特例

下面这些不属于强调色主链，可以保留独立语义：

- `success`
- `warning`
- `danger`
- console 专用颜色
- 媒体内容、截图、第三方画面本身的颜色

但即便如此，也不要顺手写进旧的紫色调残留。

## 5. 新增样式时的准则

新增一个界面或组件时，按这个顺序选变量：

1. 先找现成语义变量
   - `--surface-card`
   - `--interactive-surface`
   - `--line`
   - `--link-accent`
2. 不够用，再看是否能基于已有变量 `color-mix`
3. 还不够，再补语义变量
4. 最后才考虑补源变量层

不要一上来就新发明一个 hex。

## 6. 扩展规则

### 6.1 新增预设色

至少同时修改：

- `accentColorPresetSchema`
- `defaultSettings` 如需默认值变更
- `PRESET_PALETTES`
- `AccentColorPicker` 的 swatch

如果只改其中一处，会出现：

- 设置值非法
- picker 看得到但保存不了
- schema 过不去

### 6.2 增强自定义色

如果后面要把自定义色从 4 个入口扩成更完整的系统，建议顺序是：

1. 先扩 `accentColorCustomSchema`
2. 再扩 `AccentColorCustomDialog`
3. 再改 `derivePalette()`
4. 最后才调整 CSS 语义层

不要先改组件样式，因为那样只会把问题散开。

## 7. 当前已知限制

### 7.1 自定义色派生过于粗

[src/lib/accentColor.ts](/Users/steve372dzudo/sanaka/src/lib/accentColor.ts) 里的 `derivePalette()` 目前是直接复用入口色，没有真正算出：

- strong
- soft
- panel
- panelSoft
- panelMuted
- bg

这会带来两个结果：

- 自定义主题层次感会偏弱
- 极端颜色下，可读性和分层可能不稳定

### 7.2 picker 预览色是静态值

[src/components/AccentColorPicker.tsx](/Users/steve372dzudo/sanaka/src/components/AccentColorPicker.tsx) 里的 swatch 使用的是固定色值，不是从 `PRESET_PALETTES` 自动读。

这代表：

- picker 预览直接读取 palette，不会因手工复制颜色而与实际主题不一致

## 8. 验收清单

以后谁动强调色，至少过这几条：

- 没有新增裸 hex 到业务组件样式里
- 没有绕开 `settings.accentColor`
- 亮色和暗色都能跟着切
- 预设模式和自定义模式都能正常应用
- 不会把 success / warning / danger 混成强调色
- `AccentColorPicker`、schema、默认值、palette 定义保持同步

## 9. 一句话原则

强调色不是一个“按钮颜色”，而是一整套从设置到变量再到语义表面的链路。

所以以后改强调色，优先改“链路”，不要改“局部补丁”。
