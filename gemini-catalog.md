# Sanaka 页面模块分析与 UI/UX 优化方案 (Gemini Catalog)

本文档整理了前端页面模块的分析与优化建议。遵循《Sanaka Agent Guide》中的要求：“视觉、布局、交互主导的问题由前端 AI 负责”，并坚守“对象优先、低噪音、克制的 Material You 气质”。

---

## 1. 虚拟机配置关联 (File Association)

*(注意：根据用户要求，此模块的面板及说明文字已被完全移除。此条目仅作历史架构参考。)*

### 1.1 现状分析 (归档)
**位置:** `SettingsPage.tsx` -> `Files`
原来通过一个静态的 `.info-panel` 展示 `.saka` 和 `.svm` 的关联文字。
由于缺乏环境感知反馈且对设置的实际调整没有影响，已精简移除。

---

## 2. QEMU Runtime (运行环境状态)

*(注意：根据用户要求，此模块的面板及信息展示已被完全移除，解除对 `runtimeEnvironment` 的直接依赖。)*

### 2.1 现状分析 (归档)
**位置:** `SettingsPage.tsx` -> `Runtime`
原来使用一个长列表嵌套 `.info-panel` 渲染出所有的 QEMU paths 和 searchRoots。虽然开发友好，但在端侧设置中视觉重心偏颇。现已移除，保持设置页面轻量克制。

---

## 3. 模板列表 (Templates Catalog)

### 3.1 现状分析
**位置:** `SettingsPage.tsx` -> `Templates`
原实现中，每个模板项的 `.template-row__actions` 区域不仅包含了用于调整顺序的上下箭头和启用/禁用切换开关（iOS toggle），还包含了一个用于展示设置的 `info-panel` 卡片，其中声明 `Sanaka` 为前端及 `VNC` 为后端。
由于信息冗余，且该内容（Sanaka + VNC 控制结构）不能反映可交互的模板控制属性，使得每行的纵向高度不必要地拉大，视觉上比较拥挤并且偏离了克制的极简原则。

### 3.2 优化方案
* **精简操作区结构**:
  已移除模板行操作区域的 `.template-row__control` (包含无用的前端/后端显示 `info-panel`)。
* **重排操作按键位置**: 
  - 将操作区按左右对齐的模式进行重组。
  - 最左侧为该模板自身的切换开关 (ios-toggle)，确保其与模板信息块靠得较近。
  - 最右侧放置控制位置的上下排序按钮 (.template-row__reorder)。
* **样式调整**:
  - `.template-row__actions` 的排列更符合视觉直觉，开关控制本身的开启状态，右侧调整顺序。

