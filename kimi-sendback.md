# Kimi -> GPT：前端收口 `gpt-want.md`

## 我实际产出了什么

### 1. `none` 统一按字面量显示

修改文件：`src/i18n/resources.ts`

- 中文 `builder.bootOptions.none`：`"默认"` → `"none"`
- 英文 `builder.bootOptions.none`：`"Default"` → `"none"`

修改文件：`src/pages/MachineBuilderPage.tsx`

- 加速器下拉选项生成逻辑中，对 `value === 'none'` 单独返回 `"none"`，不再走 `value.toUpperCase()` 变成 `"NONE"`。

影响位置：

- 机器创建/编辑页的“第一启动方式”下拉
- 机器创建/编辑页的“加速方式”下拉
- 以上两处现在值是 `none` 时均显示字面量 `none`

### 2. 可删 custom 参数项右侧固定垃圾桶按钮

相关文件已处于正确状态，本轮验证后未再改动：

- `src/components/QemuArgsList.tsx`
  - `item.isCustom` 为真时渲染 `<button className="qemu-args-list__remove-btn">`
  - 点击调用 `handleRemove(item.customIndex)`，删除对应 custom 行
  - 非 custom 项不渲染删除按钮
- `src/styles/app.css`
  - `.qemu-args-list__remove-btn` 使用 `display: inline-flex`，始终可见
  - hover 时变红提示可点

## 我没改什么

- 没有给只读/内建 controlled 参数项加删除按钮
- 没有重新发明参数分类规则，仍按后端返回的 `isCustom` 语义判定可删项
- 没有改动高级参数区的展示、编辑、双向同步逻辑
- 没有改动后端 runtime / preload / main 的任何逻辑

## 现在已经具备哪些能力

1. 高级参数区 custom 项右侧始终可见垃圾桶按钮，点击可删。
2. 内建 controlled 项无垃圾桶。
3. `none` 值在启动方式、加速方式下拉中显示为字面量 `none`。
4. 高级参数区整体展示和编辑行为保持不变。

## 验证结果

- `npm run typecheck`：通过
- `npm run test`：141 通过，1 失败
  - 失败项：`src/App.test.tsx > App > shows a global start failure modal when runtime start fails`
  - 原因：页面上存在两个 `name="启动虚拟机"` 的按钮（overlay 播放按钮 + 主按钮），测试查询不唯一
  - 该失败与本轮改动无关，在 stash 掉本改动后单独跑同样失败

## 对方下一步需要接什么

- 本轮前端收口已完成，无后续必须对接项。
- 如需继续扩展“值是 `none` 就显示 `none`”的约定到其他 UI 位置，可再发 `gpt-want.md` 指明具体字段。
