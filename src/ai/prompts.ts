import { PlayerState, RegionMetadata, NPCMetadata, EventTypeMetadata } from "./types.ts";

// 系统指令 - 基础幻想世界观设定
export const FANTASY_WORLD_SYSTEM = `
你是一个奇幻世界的叙事AI，名为"编年史守护者"。你的任务是创建一个连贯、身临其境且充满选择的奇幻冒险故事。
世界设定为中世纪奇幻风格，有魔法、不同种族和典型的奇幻元素。
保持叙述生动有趣，描述要有画面感，并提供有意义的选择。
重要：你必须根据玩家之前的选择和行动生成高度连贯的内容。不同的选择路径应该导向明显不同的场景和结果。
`;

// 生成高品质描述性内容的提示
export const QUALITY_INSTRUCTION = `
1. 使用生动、丰富的描述，注重感官细节
2. 创建符合世界设定和角色背景的连贯内容
3. 为玩家提供有意义且多样化的选择，这些选择应该：
   - 与玩家之前的决定有明确的联系
   - 反映玩家角色的发展和状态变化
   - 提供截然不同的故事发展方向
4. 混合元素：对话、描述、行动和环境元素
5. 维持适当的语调和氛围，符合当前情境
6. 限制在300字以内，保持简洁有力
7. 根据玩家的历史选择创建连贯的故事弧线
`;

// 特殊剧情触发条件指令
export const SPECIAL_EVENTS_INSTRUCTION = `
根据玩家的选择历史和当前状态，考虑触发以下特殊剧情类型：
1. 爱情/浪漫剧情：当玩家多次与同一NPC友好交流，或展现魅力时
2. 隐藏任务：当玩家探索特定地点或收集特定物品组合时
3. 阵营声望变化：当玩家连续做出有利于某个阵营的选择时
4. 个人成长：当玩家在多个场景中展现一致的性格特征时
5. 师徒关系：当玩家向特定NPC寻求指导或帮助时

当检测到这些模式时，调整选项和场景描述以引导向特殊剧情发展。
`;

// 场景描述提示模板
export function createScenePrompt(
  playerState: PlayerState,
  location: string,
  regionData?: RegionMetadata
): string {
  const characterInfo = `
角色信息:
- 名称: ${playerState.character.name}
- 种族: ${playerState.character.race}
- 职业: ${playerState.character.class}
- 生平背景: ${playerState.character.backstory || "无特定背景"}
- 力量: ${playerState.attributes.strength}
- 智力: ${playerState.attributes.intelligence}
- 魅力: ${playerState.attributes.charisma}
- 幸运: ${playerState.attributes.luck}
- 物品: ${playerState.inventory?.join(", ") || "无"}
- 金币: ${playerState.gold}
- 历史选择: ${formatHistory(playerState.history)}
`;

// 格式化历史记录以便提供上下文
function formatHistory(history: string[]): string {
  if (!history || history.length === 0) return "无历史记录";
  
  // 只取最近的5个选择
  const recentHistory = history.slice(-5);
  return recentHistory.join(" → ");
}

  const regionInfo = regionData ? `
区域信息:
- 名称: ${regionData.name}
- 描述: ${regionData.description}
- 氛围: ${regionData.mood || "普通"}
- 危险: ${regionData.dangers?.join(", ") || "未知"}
- 机遇: ${regionData.opportunities?.join(", ") || "未知"}
- NPC: ${regionData.npcs?.join(", ") || "无"}
- 兴趣点: ${regionData.points_of_interest?.join(", ") || "无"}
` : '';

  return `${FANTASY_WORLD_SYSTEM}

${characterInfo}

${regionInfo}

任务:
创建一个引人入胜的场景描述，描述角色在${location}的情况。场景应包含:
1. 环境的生动描述，包括感官细节
2. 任何存在的NPC或生物的简要描述
3. 当前的氛围和情绪
4. 可能的互动机会

场景描述必须与角色的历史选择保持高度连贯性，特别是最近的几个选择。如果角色之前做出了勇敢的选择，这应该反映在新场景中；如果选择了谨慎路线，场景也应该相应变化。

然后，提供3-4个有意义的选择，这些选择应该:
- 反映角色在此地点可以采取的合理行动
- 考虑到角色的属性、背景和历史选择
- 提供明显不同方向的探索或互动机会
- 导向截然不同类型的体验
- 至少一个选项应该直接回应或延续玩家最近的选择
- 在适当情况下，提供一个可能触发特殊剧情（如爱情、师徒关系等）的选项

${QUALITY_INSTRUCTION}

以JSON格式返回响应:
{
  "title": "场景标题",
  "description": "场景详细描述，富有画面感和代入感",
  "choices": [
    {"id": "choice1", "text": "第一个选择的描述"},
    {"id": "choice2", "text": "第二个选择的描述"},
    {"id": "choice3", "text": "第三个选择的描述"},
    {"id": "choice4", "text": "第四个选择的描述（可选）"}
  ],
  "image_suggestion": "场景的图像描述提示"
}
`;
}

// NPC对话提示模板
export function createDialoguePrompt(
  playerState: PlayerState,
  npcData: NPCMetadata
): string {
  const characterInfo = `
角色信息:
- 名称: ${playerState.character.name}
- 种族: ${playerState.character.race}
- 职业: ${playerState.character.class}
- 生平背景: ${playerState.character.backstory || "无特定背景"}
`;

  const npcInfo = `
NPC信息:
- 名称: ${npcData.name}
- 种族: ${npcData.race}
- 职业: ${npcData.profession}
- 性格: ${npcData.personality}
- 目标: ${npcData.goals.join(", ")}
- 知识: ${npcData.knowledge.join(", ")}
- 态度: ${npcData.attitude}
- 物品: ${npcData.possessions.join(", ")}
`;

  return `${FANTASY_WORLD_SYSTEM}

${characterInfo}

${npcInfo}

任务:
创建一个角色与${npcData.name}的对话场景。对话应该:
1. 反映NPC的性格和态度
2. 提供有关世界或当前情况的信息
3. 可能涉及交易、请求帮助、提供任务等内容
4. 对话应当自然且富有个性
5. 如果玩家之前与此NPC有过互动，对话必须反映这一历史

然后，提供3-4个对话选择，这些选择应该:
- 反映不同的对话方向或态度
- 考虑角色的属性、背景和历史选择
- 可能导致不同的结果
- 至少一个选项应该可能触发特殊剧情（如友谊加深、爱情发展、敌对关系等）
- 如果角色与NPC已有积极互动历史，提供深化关系的选项

${QUALITY_INSTRUCTION}

以JSON格式返回响应:
{
  "title": "与[NPC名称]的对话",
  "description": "对话场景描述，包括NPC的反应和言论",
  "choices": [
    {"id": "dialogue1", "text": "第一个对话选择"},
    {"id": "dialogue2", "text": "第二个对话选择"},
    {"id": "dialogue3", "text": "第三个对话选择"},
    {"id": "dialogue4", "text": "第四个对话选择（可选）"}
  ],
  "image_suggestion": "对话场景的图像描述提示"
}
`;
}

// 随机事件提示模板
export function createEventPrompt(
  playerState: PlayerState,
  location: string,
  eventType?: EventTypeMetadata
): string {
  const characterInfo = `
角色信息:
- 名称: ${playerState.character.name}
- 种族: ${playerState.character.race}
- 职业: ${playerState.character.class}
- 力量: ${playerState.attributes.strength}
- 智力: ${playerState.attributes.intelligence}
- 魅力: ${playerState.attributes.charisma}
- 幸运: ${playerState.attributes.luck}
`;

  const eventInfo = eventType ? `
事件类型:
- 名称: ${eventType.name}
- 描述: ${eventType.description}
- 类别: ${eventType.category}
- 可能结果: ${eventType.outcomes?.join(", ") || "未知"}
- 所需属性: ${eventType.required_attributes ? Object.entries(eventType.required_attributes).map(([k, v]) => `${k}: ${v}`).join(", ") : "无"}
- 可能物品: ${eventType.possible_items?.join(", ") || "无"}
` : '';

  return `${FANTASY_WORLD_SYSTEM}

${characterInfo}

${eventInfo}

任务:
创建一个在${location}发生的随机事件。事件应该:
1. 富有戏剧性和意外性
2. 与当前位置和情境相关
3. 提供挑战或机遇
4. 有紧张感或好奇感
5. 与角色的历史选择有明确关联，可能是过去选择的后果

然后，提供3-4个应对该事件的选择，这些选择应该:
- 涉及不同的解决方法或应对态度
- 考虑角色的属性、技能和历史选择
- 具有不同级别的风险和潜在回报
- 至少一个选项应该特别适合角色的历史行为模式
- 在适当情况下，提供可能触发特殊剧情线的选项

${QUALITY_INSTRUCTION}

以JSON格式返回响应:
{
  "title": "事件标题",
  "description": "事件描述，突出其突发性和影响",
  "choices": [
    {"id": "reaction1", "text": "第一个反应选择"},
    {"id": "reaction2", "text": "第二个反应选择"},
    {"id": "reaction3", "text": "第三个反应选择"},
    {"id": "reaction4", "text": "第四个反应选择（可选）"}
  ],
  "image_suggestion": "事件场景的图像描述提示"
}
`;
}

// 战斗提示模板
export function createCombatPrompt(
  playerState: PlayerState,
  enemy: string,
  location: string
): string {
  const characterInfo = `
角色信息:
- 名称: ${playerState.character.name}
- 种族: ${playerState.character.race}
- 职业: ${playerState.character.class}
- 力量: ${playerState.attributes.strength}
- 智力: ${playerState.attributes.intelligence}
- 魅力: ${playerState.attributes.charisma}
- 幸运: ${playerState.attributes.luck}
- 健康: ${playerState.health}
- 物品: ${playerState.inventory.join(", ") || "无"}
`;

  return `${FANTASY_WORLD_SYSTEM}

${characterInfo}

任务:
创建一个在${location}与${enemy}的战斗场景。战斗描述应该:
1. 生动描述敌人的外观和行为
2. 传达战斗的紧张感和危险
3. 考虑环境因素和周围地形
4. 适合角色的职业和技能
5. 如果这个敌人与角色有历史，应反映这一点

然后，提供3-4个战斗选择，这些选择应该:
- 反映不同的战斗策略或技巧
- 考虑角色的职业、属性和战斗风格历史
- 包括攻击、防御、特殊技能或环境互动等
- 具有不同的风险和潜在结果
- 至少一个选项应反映角色过去选择展现的战斗风格

${QUALITY_INSTRUCTION}

以JSON格式返回响应:
{
  "title": "战斗：[敌人名称]",
  "description": "战斗场景的生动描述",
  "choices": [
    {"id": "combat1", "text": "第一个战斗选择"},
    {"id": "combat2", "text": "第二个战斗选择"},
    {"id": "combat3", "text": "第三个战斗选择"},
    {"id": "combat4", "text": "第四个战斗选择（可选）"}
  ],
  "image_suggestion": "战斗场景的图像描述提示"
}
`;
}

// 选择结果提示模板
export function createChoiceResultPrompt(
  playerState: PlayerState,
  location: string,
  choiceId: string,
  choiceText: string,
  previousNode: string
): string {
  // 获取角色的历史选择模式
  const historyPattern = analyzeHistoryPattern(playerState.history);
  
  return `${FANTASY_WORLD_SYSTEM}

角色信息:
- 名称: ${playerState.character.name}
- 种族: ${playerState.character.race}
- 职业: ${playerState.character.class}
- 历史选择模式: ${historyPattern}

当前位置: ${location}

玩家在"${previousNode}"场景中选择了: "${choiceText}" (ID: ${choiceId})

任务:
创建该选择的结果描述，并引导到下一个场景。结果应该：
1. 直接回应玩家的选择
2. 描述选择带来的直接后果
3. 提供自然的过渡到下一个场景
4. 可能改变角色状态或环境
5. 与玩家的历史选择保持连贯性
6. 如果检测到特殊选择模式，考虑引入或发展特定剧情线

${QUALITY_INSTRUCTION}

${SPECIAL_EVENTS_INSTRUCTION}

以JSON格式返回响应:
{
  "title": "结果标题",
  "description": "选择结果的详细描述",
  "effect": {
    "health_change": 0,          // 健康值变化，可为正(恢复)或负(损伤)
    "gold_change": 0,            // 金币变化，可为正(获得)或负(消费)
    "add_items": [],             // 获得的物品列表
    "remove_items": [],          // 失去的物品列表
    "attribute_changes": {},     // 属性变化，如 {"strength": 1, "charisma": -1}
    "relationship_changes": {},  // 关系变化，如 {"npc_name": 1}
    "special_event": ""          // 触发的特殊事件，如 "romance"、"betrayal" 等
  },
  "next_scene_suggestion": "建议下一场景类型或位置",
  "image_suggestion": "结果场景的图像描述提示"
}
`;
}

// 分析历史选择模式
function analyzeHistoryPattern(history: string[]): string {
  if (!history || history.length < 3) return "尚无明确模式";
  
  let patterns = [];
  
  // 检查是否倾向于冒险选择
  const adventurousChoices = history.filter(c =>
    c.includes("探索") || c.includes("冒险") || c.includes("挑战") ||
    c.includes("勇敢") || c.includes("风险")
  ).length;
  
  // 检查是否倾向于谨慎选择
  const cautiousChoices = history.filter(c =>
    c.includes("谨慎") || c.includes("观察") || c.includes("撤退") ||
    c.includes("避免") || c.includes("安全")
  ).length;
  
  // 检查是否倾向于社交选择
  const socialChoices = history.filter(c =>
    c.includes("交谈") || c.includes("对话") || c.includes("询问") ||
    c.includes("说服") || c.includes("魅力")
  ).length;
  
  // 检查是否倾向于战斗选择
  const combatChoices = history.filter(c =>
    c.includes("攻击") || c.includes("战斗") || c.includes("力量") ||
    c.includes("武器") || c.includes("击败")
  ).length;
  
  // 判断主要倾向
  if (adventurousChoices > history.length / 4) patterns.push("冒险倾向");
  if (cautiousChoices > history.length / 4) patterns.push("谨慎倾向");
  if (socialChoices > history.length / 4) patterns.push("社交倾向");
  if (combatChoices > history.length / 4) patterns.push("战斗倾向");
  
  return patterns.length > 0 ? patterns.join("，") : "混合决策风格";
}