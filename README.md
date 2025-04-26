# Eldra Chronicles

一款"西方奇幻＋Roguelike"元素的文字冒险小游戏，基于节点式选择、随机事件和场景插图。

## 项目概述

- **游戏类型**：文字冒险 + Roguelike
- **技术栈**：Deno + Oak (后端)，原生 HTML/CSS/JS (前端)
- **配置驱动**：基于 YAML 的节点式设计
- **存档系统**：浏览器 localStorage

## 特色功能

- 节点式剧情分支
- 属性影响选择结果
- 随机事件系统
- 场景插图展示
- 多存档支持

## 运行方式

开发环境：

```bash
# 安装 Deno (如未安装)
# Windows (PowerShell)
iwr https://deno.land/install.ps1 -useb | iex

# 启动服务器
deno task start
```

## 目录结构

```
.
├─ config/          # 配置文件
│   ├─ world.yaml   # 全局世界设置
│   └─ nodes/       # 节点配置
├─ public/          # 前端文件
├─ src/             # 后端代码
└─ images/          # 场景图片
```

## 许可证

MIT