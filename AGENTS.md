# Sanaka Agent Guide

这个仓库由单一 AI 直接承担完整实现，不再区分前端 AI、后端 AI，也不再要求通过其他 AI 接力。

## 工作方式

- 一个任务由当前 AI 从分析、实现、测试到交付全程负责。
- UI、交互、Electron main process、preload、IPC、文件系统、runtime、脚本和打包都属于当前任务的可修改范围。
- 不要只写方案或派单；用户要求实现时，应直接完成能够在当前环境中完成的部分。
- 修改范围以需求为准，不因能够跨层修改就顺手重构无关模块。

## 历史协作文件

- `gpt-want.md`、`kimi-want.md`、`gpt-sendback.md`、`kimi-sendback.md` 仅作为历史记录保留。
- 新任务不再强制读写 `xx-want.md` 或 `xx-sendback.md`。
- 只有用户明确要求记录 spec、checklist、交接说明时，才创建或更新对应文档。

## 产品与前端

- 不要对终端用户暴露 `.saka`、`machine.svm`、bundle root、IPC 名称或原始 QEMU 参数，除非是明确的高级/调试视图。
- 尊重当前产品方向：对象优先、低噪音、克制的 Material You 气质、居中工作区。
- 保持桌面端、网页版、浅色、深色和窄屏体验一致；交互状态和错误状态必须完整。
- 如果使用仓库里的设计 skill，先读对应 `SKILL.md`，只采用当前任务需要的规则。

## Runtime 与平台

- 平台差异要显式编码，不要埋成隐性行为。
- 优先返回结构化、用户向的错误，不把内部异常直接扔给 renderer。
- recent、bundle、runtime state、文件访问边界和打包行为必须符合产品规则。
- 涉及 QEMU、路径、编码、权限或打包时，应验证最终运行产物，不只验证源文件存在。

## 仓库习惯

- 搜索优先使用 `rg`。
- 手工修改文件使用 `apply_patch`。
- 不回滚未经用户授权的改动。
- 默认按脏工作区处理，提交和验证只包含当前任务相关文件。
- 测试范围按风险决定：窄改动跑相关测试，共享逻辑、跨进程协议和打包改动扩大验证范围。

## 写作风格

- 每个任务开始前执行 `shuorenhua` skill。
- 如果会话未注入该 skill，读取 `/Users/steve372dzudo/.agents/skills/shuorenhua/SKILL.md`。
- 沟通保留事实和术语，少套话、少表演、少模板腔。
- 代码、日志、命令、配置、协议字段和报错原文不做文案化改写。
