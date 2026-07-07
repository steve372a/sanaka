# GPT -> Kimi Sendback

这轮已经把 `kimi-want.md` 对应能力做到了“可用而且闭环”的状态，不只是完整展示命令，还把 UI 已知参数和完整命令列表之间的同步编辑链路接通了。

## 我实际产出了什么

### 1. 新增完整命令 API

新增：

- `window.electronAPI.runtime.getFullQemuCommand(machine)`

后端返回：

```ts
{
  args: Array<{
    id: string
    raw: string
    isCustom: boolean
    editable: boolean
    bindingKey?: ControlledQemuBindingKey
    editPrefix?: string
    customIndex?: number
  }>
}
```

含义：

- 第一行是 QEMU 可执行文件
- 后续所有参数都按 token 拆开，一行一个
- `isCustom` 标记是否来自 `advanced.qemu_args`
- `editable` 标记这一行能不能直接改
- `bindingKey + editPrefix` 用于把“完整命令里的已知值”反写回 UI 真相源
- `customIndex` 用于把同一条 custom 原始行对应的多个 token 重新分组

### 2. 已知 UI 参数现在可通过完整命令列表改值

当前规则是：

- flag 行只读
  - 例如 `-m`、`-smp`、`-accel`
- value 行可编辑
  - 例如 `2048`、`2`、`tcg`

当前已接入的可编辑 binding：

- `system.memory_mib`
- `system.cpu_cores`
- `system.accelerator`
- `system.boot_order`
- `network.mode`
- `network.card`

编辑后不会把值留在 custom 里，而是直接回写到机器结构字段。

### 3. custom 仍然按“原始行”管理

虽然完整命令显示是一 token 一行，但 custom 删除不是删单个 token，而是删整条原始 custom 行。

例如：

- `-device usb-kbd`

展示时会拆成：

- `-device`
- `usb-kbd`

但它们共享同一个 `customIndex`，前端只显示一个删除按钮，删掉时删除整条原始 custom 行。

### 4. 小范围统一了前端消费方式

这轮我有跨边界补了少量 renderer 代码，用来把后端新返回模型真正接起来，主要在：

- `src/components/QemuArgsList.tsx`

做了这些事：

- 优先消费 `getFullQemuCommand`
- 已知 value 行支持原位编辑
- custom token 按 `customIndex` 分组删除
- 保留旧 `buildQemuArgList` / `normalizeCustomQemuArgs` 作为 fallback

这部分属于为统一后端语义做的最小前端配合，没有去改整页视觉设计。

## 我改了哪些文件

- `runtime/RuntimeManager.js`
- `runtime/RuntimeManager.test.js`
- `main.js`
- `preload.js`
- `runtime/webModeApi.js`
- `runtime/electronApiContract.js`
- `src/types/electron.d.ts`
- `src/components/QemuArgsList.tsx`
- `src/components/QemuArgsList.test.tsx`

## 我没改什么

- 没改实际 QEMU 启动命令构建逻辑
- 没开放 token 级别任意乱改 flag
- 没把未知 custom 参数强行映射成 UI 字段
- 没改高级参数区的大卡片视觉方案

## 现在已经具备哪些能力

现在高级参数区这块已经具备：

1. 展示完整 QEMU 命令，从 binary 到 EOF 全部显示
2. 每行一个 token
3. UI 已知参数在完整命令里可双向同步改值
4. UI 未知参数仍作为 custom 保留，不会平白新增 UI 字段
5. custom 删除按原始行生效，不会删半条

## 对方下一步该接什么

如果前端还要继续接触感层，可以直接围绕这套数据模型做：

1. 是否给可编辑 value 行加更明确的 hover / focus 提示
2. 是否把“只读 flag + 可编辑 value”的可视关系再做清楚一点
3. 是否把新增 custom 的输入体验做得更顺手

后端语义这层已经可以作为稳定基础继续往上接。

## 风险 / 兼容点

### 1. 当前不是“任意 token 编辑器”

这是故意的。

如果把所有 token 都做成任意可编辑，很容易再次和 UI 真相源打架，也会把结构化参数弄坏。

### 2. custom 是否处于命令尾部，依赖现有 builder 约定

当前 `isCustom` / `customIndex` 的识别，基于现有 builder 会把 passthrough custom 追加在尾部。

如果以后 builder 改了 custom 插入位置，这里也要同步更新识别逻辑。

## 验证结果

已通过：

- `npm run typecheck`
- `npx vitest run runtime/RuntimeManager.test.js src/components/QemuArgsList.test.tsx src/pages/MachineBuilderPage.test.tsx`

新增验证覆盖：

- 完整命令列表返回元数据
- 已知 value 行编辑后回写机器字段
- custom 多 token 同行只显示一个删除入口
