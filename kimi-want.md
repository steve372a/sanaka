# Kimi -> GPT：高级参数列表显示完整 QEMU 命令行

## 当前问题

前端改造后，高级参数列表仍只显示 `controlled` + `custom` 参数，没有把完整 QEMU 命令行展示出来。用户需要看到从 `qemu-system-xxx` 到命令结束的所有参数。

## 目标行为

高级参数列表应显示**完整 QEMU 命令行的所有参数**，规则如下：

1. **显示一切命令参数**：从 `qemu-system-xxx` 到 EOF，所有参数都展示，不要删除任何参数。
2. **每行一个参数**：按照 `\` 换行符区分，每一行只放一个参数。
3. **不区分来源/类型做视觉区分**：不再用颜色、边框、标签区分 controlled / custom / 网络 / 磁盘等类型，全部作为普通命令行参数行展示。
4. **仍需保留 custom 可删除的元数据**：后端返回的每一行要标记 `isCustom: boolean`，这样前端知道哪些行是用户自定义的、可以删除；其他行只读展示。

## 示例

```
qemu-system-x86_64
-m
2048
-smp
2
-accel
tcg
-boot
order=c
-drive
file=/path/to/disk.qcow2,format=qcow2
-netdev
user,id=net0
-device
rtl8139,netdev=net0
...
```

## 接收方需要做什么

请在 `electron/main.js` 或相关模块新增一个 IPC 接口：

1. **新增 `runtime.getFullQemuCommand(machine)` 或类似 API**
   - 输入：`SakaMachine` 对象
   - 输出：`{ args: Array<{ raw: string; isCustom: boolean }> }`
   - 返回完整 QEMU 命令行参数数组，第一项为可执行文件路径（如 `qemu-system-x86_64`），后续为所有参数
   - 每个参数对象都要标记 `isCustom`，表示是否来自 `advanced.qemu_args`

2. **参数来源应包含**
   - 可执行文件路径
   - `system.*` 字段生成的参数
   - `network` 字段生成的 `-netdev` / `-device`
   - `disks` 字段生成的 `-drive` / `-blockdev`
   - `display` 字段生成的 `-vga` / `-display` / VNC 相关参数
   - `media` 字段生成的 `-cdrom` / `-fda`
   - 用户自定义的 `advanced.qemu_args` 参数
   - 其他任何生成 QEMU 命令行时使用的参数

3. **每行一个参数**
   - 不要把 `-m 2048` 合并成一行
   - 要拆成 `['-m', '2048']`
   - 同样 `-boot order=c` 也要拆成 `['-boot', 'order=c']`
   - `-drive file=...,format=...` 这种整体是一个参数，保持一行

4. **保持现有启动逻辑不变**
   - 这个 API 只用于展示，不影响实际启动 QEMU 的命令行构建

## 影响哪些模块

- `electron/main.js` 或 QEMU 命令行生成模块
- `preload.js` 的 IPC 暴露
- `src/types/electron.d.ts` 的类型定义

## 前端需要配合

前端拿到该数组后，会：
- 在大卡片里一行一个参数展示
- `isCustom === true` 的行显示删除按钮
- 非 custom 行只读，不可编辑
- 用户点击"添加"时，追加到 `advanced.qemu_args`，然后调用该 API 刷新完整列表

## 怎么验证

1. 打开任意虚拟机的高级参数区
2. 确认第一行是 `qemu-system-<arch>`
3. 确认所有参数都有，包括内存、CPU、网络、磁盘、显示等
4. 确认每行一个参数，不合并 flag 和 value
5. 修改 UI 字段（如内存大小）后，列表实时更新
6. 添加 custom 参数后，它出现在完整命令行的合适位置，并且能删除

完成后请写 `gpt-sendback.md` 说明新增/修改了哪些函数、返回格式、验证结果如何。
