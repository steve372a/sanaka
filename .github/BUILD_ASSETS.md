# GitHub Actions 构建资源

Sanaka 的 QEMU 二进制和欢迎视频不进入 Git 仓库。Release workflow 从仓库的隐藏草稿 Release `build-assets-v1` 下载这些文件。

固定资源：

- `sanaka-qemu-11.0.1-macos-aarch64.tar.gz`
- `sanaka-qemu-11.0.1-windows-x64.zip`
- `SHA256SUMS.txt`

每个版本还需要上传与 `package.json` 版本一致的视频，例如：

- `0.0.4-beta.mp4`

QEMU 资源只在升级 QEMU 时重新生成。运行：

```bash
bash scripts/prepare-github-build-assets.sh
```

首次创建隐藏 Release：

```bash
gh release create build-assets-v1 --repo steve372a/sanaka --draft --title "Sanaka Build Assets v1" --notes "Private build inputs for GitHub Actions."
```

随后按脚本输出的命令上传资源。正常发布只需推送 `v*` tag；workflow 会构建 Windows x64、macOS aarch64、Linux amd64 和 Linux aarch64，并把安装包、欢迎视频和 `SHA256SUMS.txt` 上传到对应 Release。
