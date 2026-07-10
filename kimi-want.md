# Kimi -> GPT

## 前端已完成功能

Kimi 已完成“设置页强调色选择器”前端实现：

1. **设置项入口**
   - 在 `src/pages/SettingsPage.tsx` 的“通用”一级卡片内新增一行：左侧“强调色”，右侧 5 个纯色圆形预设 + 1 个自定义按钮。

2. **数据模型**
   - `src/domain/schemas.ts` 新增 `accentColor` 字段：
     - `mode: 'preset' | 'custom'`
     - `preset: 'purple' | 'blue' | 'orange' | 'white' | 'green'`
     - `custom: { lightPrimary, lightSurface, darkPrimary, darkSurface }`
     - `templates: Array<{ id, name, custom }>`
   - `src/domain/defaults.ts` 已补充默认值。

3. **组件**
   - `src/components/AccentColorPicker.tsx`：5 个预设圆（紫/蓝/橙/白/绿）+ 自定义圆（浅色底、+ 号），选中项外圈描边。
   - `src/components/AccentColorCustomDialog.tsx`：自定义颜色弹窗，含 4 个颜色选择器、保存为模板按钮、已保存模板列表、命名输入子窗口。

4. **即时生效与主题映射**
   - `src/lib/accentColor.ts` 提供 5 套预设调色板与 `applyAccentColor`。
   - `src/hooks/useAccentColor.ts` 监听 `settings.accentColor` 变化。
   - `src/App.tsx` / `src/AppWeb.tsx` 已接入 hook。
   - `src/styles/app.css` 已将主题色改由 `--accent-*` 变量映射，同时影响浅色区和深色区。

5. **紫色已调粉**
   - 当前紫色预设主色为 `#C678FF`（偏粉、高饱和），不再使用原来的冷灰紫 `#8B7FD4`。

## 请 GPT 只做一件事

**检查是否还有残留的硬编码颜色。**

要求：

1. 重点扫描 `src/styles/app.css`：
   - 搜索是否还有旧的紫色系硬编码，例如：
     - `#cdbaf2`、`#a78bda`、`#9279c8`、`#c4b0f0`、`#ece3fb`、`#f7f1fb`
     - `#3a3055`、`#2a2540`、`#252236`、`#302a45`、`#171525`
     - `rgba(146, 121, 200, ...)`、`rgba(89, 70, 118, ...)`、`rgba(107, 76, 138, ...)`、`rgba(61, 42, 79, ...)`、`rgba(196, 176, 240, ...)`、`rgba(232, 224, 240, ...)`
   - 如果发现，改为使用 `--accent-*` 变量或 `color-mix(in srgb, var(--accent-primary) ..., transparent)`。

2. 扫描 `src/components/*.tsx` 和 `src/pages/*.tsx`：
   - 检查是否有内联样式 `style={{ ... }}` 或 `styled-jsx` 中写死的紫色 hex/rgba。
   - 检查 SVG `fill`、`stroke` 中是否还有写死的紫色。

3. 扫描 `src/lib/accentColor.ts`：
   - 确认紫色 preset 的 light/dark 整套颜色是协调的偏粉紫，没有其他 preset 残留旧紫。

4. 不要做的事：
   - 不要修改功能逻辑。
   - 不要改预设数量、自定义弹窗、保存模板逻辑。
   - 不要改文字色、成功/警告/危险色、console 颜色、纯黑白。

完成后写 `gpt-sendback.md`，只说明：

- 是否发现残留硬编码颜色
- 改了哪些文件、哪些位置
- 是否还有未处理的残留项及原因
