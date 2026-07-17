# Tiny Swords

阵型将军 · 限时按键 · 战术消行 — 一款基于 Tiny Swords 素材的网页策略益智游戏。

## 在线游玩

部署完成后，游戏地址为：

`https://SW937.github.io/tiny-swords/`

## 本地运行

```bash
cd game
python3 server.py
```

浏览器打开 `http://127.0.0.1:8765/` 即可。

macOS 也可双击 `game/启动游戏.command`。

## 操作说明

- `←` `→` 移动 · `↑` 旋转
- `↓` 软降 · `Space` 硬降
- 每个阵型最多 8 次移动/旋转（软降、硬降、奖励键不计入）
- 填满一行即可出征消行
- 商店可用木材购买建筑（哨岗、金矿）

## 项目结构

```
game/
  index.html      # 游戏入口
  css/            # 样式
  js/             # 游戏逻辑
  assets/         # 图片与音效
  server.py       # 本地开发服务器（可选）
```

## 部署说明

本项目使用 GitHub Actions 自动部署 `game/` 目录到 GitHub Pages。

1. 在 GitHub 创建仓库 `tiny-swords`
2. 推送代码到 `main` 分支
3. 仓库 Settings → Pages → Source 选择 **GitHub Actions**
4. 推送后等待 Actions 完成，即可访问在线版
