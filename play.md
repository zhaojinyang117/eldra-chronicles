```markdown
# 更新后的开发计划

## 一、项目概述  
打造一款“西方奇幻＋Roguelike”元素的文字冒险小游戏，节点式选择+随机事件+可插图，前期本地开发，后期部署到 Deno(Deno Deploy / 自建 VPS)。

---

## 二、核心功能与特性  
1. 节点式文本冒险  
   - YAML 驱动：每个节点一份 `config/nodes/*.yaml`  
   - 可选场景插图接口(`image: "/images/xxx.jpg"`)  
2. Roguelike 随机事件  
   - 全局 `config/world.yaml` 定义随机事件池与权重  
   - 属性系统(力量、智力、魅力、运气)+ 条件/效果解析  
3. 存档与回放  
   - 浏览器 localStorage 快速存档  
   - 后期可扩展为服务器存档  
4. 可扩展世界观  
   - `world.yaml` 管理种族、职业、势力、地图概况  

---

## 三、技术选型  
- 后端：Deno + Oak  
- 配置：YAML(Deno.std `yaml` 模块)  
- 存储：开发期 YAML/JSON，后期可接 SQLite  
- 前端：纯原生 HTML/CSS/JS，无框架  
- 部署：Deno Deploy 或 VPS + Nginx  

---

## 四、目录结构  
```

.
├─ config/
│   ├─ world.yaml
│   └─ nodes/
│       ├─ start.yaml
│       ├─ node\_001.yaml
│       └─ …
├─ public/
│   ├─ index.html
│   ├─ style.css
│   └─ client.js
├─ src/
│   ├─ server.ts
│   ├─ router.ts
│   └─ logic.ts
├─ images/            # 场景插图 (部署后可换为 CDN)
├─ deno.json
└─ README.md

```

---

## 五、配置文件示例  

### world.yaml  
```

races:

- id: human; name: 人类
- id: elf;   name: 精灵
  classes:
- id: warrior; name: 战士
- id: mage;    name: 法师
  randomEvents:
- id: bandit; weight: 30; text: "路上你遇到了一伙土匪……"
- id: druid;  weight: 10; text: "森林深处，一位德鲁伊向你招手。"

```

### nodes/start.yaml  
```

id: "start"
title: "黎明之城的晨光"
text: |
你醒来时，第一缕阳光透过石窗洒在石板地面上……
image: "/images/dawn\_castle.jpg"
choices:

- id: "explore\_market"
  text: "前往集市打听消息"
  target: "node\_001"
- id: "visit\_tavern"
  text: "去酒馆找线人"
  target: "node\_002"

```

---

## 六、后端设计  

### 1. 路由 (src/router.ts)  
- GET  /api/node/:id     → 读取 `config/nodes/:id.yaml` → 返回 Node  
- POST /api/choice       → 接收 `{ state, choiceId }` → 计算新 state + next node → 返回 `{ state, node }`  

### 2. 核心逻辑 (src/logic.ts)  
- loadWorld(): 解析 `world.yaml`  
- loadNode(id): 解析对应节点 YAML  
- applyChoice(state, choiceId):  
  - 校验条件 → 更新属性、背包、历史  
  - 随机事件插入 → 计算下一节点 ID  

### 3. 启动 (src/server.ts)  
```

import { Application } from "<https://deno.land/x/oak/mod.ts>";
import router from "./router.ts";

const app = new Application();
app.use(router.routes());
app.use(router.allowedMethods());

await app.listen({ port: 8000 });

```

---

## 七、前端设计  

### public/index.html  
```

<!DOCTYPE html>

<html lang="zh">
<head>
  <meta charset="UTF-8" />
  <title>奇幻文本冒险</title>
  <link rel="stylesheet" href="style.css" />
</head>
<body>
  <div id="game">
    <h2 id="title"></h2>
    <img id="scene-img" hidden />
    <p id="text"></p>
    <div id="choices"></div>
  </div>
  <script src="client.js"></script>
</body>
</html>
```

### public/client.js

```

let state = { current: "start", attributes: {}, inventory: [], history: [] };

async function loadNode(id) {
const res = await fetch(`/api/node/${id}`);
return res.json();
}

function render(node) {
document.getElementById("title").textContent = node.title;
const img = document.getElementById("scene-img");
if (node.image) { img.src = node.image; img.hidden = false; }
else img.hidden = true;
document.getElementById("text").textContent = node.text;
const choicesDiv = document.getElementById("choices");
choicesDiv.innerHTML = "";
node.choices.forEach(c => {
const btn = document.createElement("button");
btn.textContent = c.text; btn.className = "choice";
btn.onclick = () => choose(c.id);
choicesDiv.appendChild(btn);
});
}

async function choose(choiceId) {
const res = await fetch("/api/choice", {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({ state, choiceId })
});
const { state: newState, node } = await res.json();
state = newState;
render(node);
localStorage.setItem("save", JSON.stringify(state));
}

window.onload = async () => {
const saved = localStorage.getItem("save");
if (saved) state = JSON.parse(saved);
const node = await loadNode(state.current);
render(node);
};

```

---

## 八、开发路线图

阶段  时间      任务\
1     1–2 周・YAML 结构 & 世界观大纲\
・Deno + Oak 项目骨架\
2     2–3 周・Node/Choice 读取 & 状态流转\
・简易前端渲染\
3     3–4 周・属性 / 条件 / 效果解析引擎\
・随机事件模块\
・存档与回放\
4     4–5 周・插图接口 & 图片资源管理\
・前端交互优化\
・Admin 在线编辑预研 (可选)\
5     5–6 周・单元测试 + 体验测试\
・CI/CD 配置 → Deno Deploy 自动部署\
6     持续・剧情扩充、多人 / 分享平台、语音 / BGM、国际化

---

## 九、部署与权限

deno.json

```

{
"tasks": {
"start": "deno run --allow-read --allow-net src/server.ts"
}
}

```

- `--allow-read` 读取 config、images
- `--allow-net` 对外 HTTP

即可推送至 Deno Deploy 或自建 VPS + Nginx 反代。

---

## 十、后续扩展

- 剧情创作平台：玩家贡献节点
- 联机协作 / 多人模式
- BGM、音效、TTS 朗读
- 多语言支持

> 以上即为涵盖 YAML 配置、极简前端、Deno 后端、完整路线与部署的更新版开发计划！

```
```
