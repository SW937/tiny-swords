#!/bin/bash
# 一键部署 Tiny Swords 到 GitHub Pages (SW937/tiny-swords)
set -e

GH="/tmp/gh_2.67.0_macOS_arm64/bin/gh"
REPO="SW937/tiny-swords"
ROOT="$(cd "$(dirname "$0")" && pwd)"

cd "$ROOT"

if [ ! -x "$GH" ]; then
  echo "正在下载 GitHub CLI..."
  curl -sL "https://github.com/cli/cli/releases/download/v2.67.0/gh_2.67.0_macOS_arm64.zip" -o /tmp/gh.zip
  unzip -qo /tmp/gh.zip -d /tmp
fi

if ! "$GH" auth status &>/dev/null; then
  echo "请先登录 GitHub（浏览器会打开授权页面）："
  "$GH" auth login -h github.com -p https -w
fi

if ! "$GH" repo view "$REPO" &>/dev/null; then
  echo "创建仓库 $REPO ..."
  if git remote get-url origin &>/dev/null; then
    "$GH" repo create tiny-swords --public --source=. --push=false \
      --description "阵型将军 · Tiny Swords 网页策略益智游戏"
  else
    "$GH" repo create tiny-swords --public --source=. --remote=origin --push=false \
      --description "阵型将军 · Tiny Swords 网页策略益智游戏"
  fi
fi

git remote get-url origin &>/dev/null || git remote add origin "https://github.com/$REPO.git"
git remote set-url origin "https://github.com/$REPO.git"

echo "推送代码到 main 分支..."
git push -u origin main

echo ""
echo "启用 GitHub Pages (GitHub Actions)..."
"$GH" api repos/"$REPO"/pages -X POST \
  -f build_type=workflow \
  2>/dev/null || echo "Pages 可能已配置，跳过。"

echo ""
echo "=========================================="
echo "  部署完成！"
echo "  仓库: https://github.com/$REPO"
echo "  游戏: https://SW937.github.io/tiny-swords/"
echo "=========================================="
echo "首次部署需等待 GitHub Actions 完成（约 1-2 分钟）。"
echo "查看进度: https://github.com/$REPO/actions"
