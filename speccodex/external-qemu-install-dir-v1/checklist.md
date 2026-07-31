# Checklist

## Product

- [ ] 外部 QEMU 配置对象加入应用级设置
- [ ] `external-dir` 模式下不允许自动回退
- [ ] `externalDir` 为空时自动探测
- [ ] `externalDir` 非空时严格只认该目录
- [ ] 外部目录无效时给出明确用户错误

## Runtime

- [ ] `QemuDetector` 支持严格外部目录模式
- [ ] 严格外部目录模式只查用户指定目录
- [ ] `QemuEnvironment` 返回 `source`
- [ ] `QemuEnvironment` 返回 `effectiveRoot`
- [ ] `QemuEnvironment` 返回结构化错误信息
- [ ] `--version` 读取失败时允许返回 `version = null`
- [ ] 启动前按当前设置重新探测
- [ ] 外部目录模式探测失败时直接阻止启动

## UI

- [ ] 设置页可填写或选择外部安装目录
- [ ] 设置页清空目录后恢复自动探测
- [ ] 设置页显示当前生效路径
- [ ] 设置页显示当前版本
- [ ] 设置页显示当前命中来源
- [ ] 设置页显示目录错误状态
- [ ] monitor / runtime 信息显示当前生效路径
- [ ] monitor / runtime 信息显示当前版本
- [ ] monitor / runtime 信息显示当前命中来源

## Compatibility

- [ ] 不破坏 `auto` 模式现有 bundled / PATH 探测
- [ ] 不把路径代理错误和外部 QEMU 目录错误混淆
- [ ] Windows / macOS / Linux 都有明确目录解析规则

## Verification

- [ ] 未配置外部目录时，现有启动流程可用
- [ ] 配置有效外部目录时，实际使用该目录下的 QEMU
- [ ] 配置无效外部目录时，设置页立即显示错误
- [ ] 配置无效外部目录时，启动直接失败且不回退
- [ ] 清空外部目录后恢复自动探测
- [ ] `npm run typecheck`
- [ ] `npm test`
- [ ] `npm run build`
