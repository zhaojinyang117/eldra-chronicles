import { parse } from "https://deno.land/std/yaml/mod.ts";
import { generateContent, generateChoiceResult } from "./ai/generator.ts";
import { ContentGenerationRequest, PlayerState, ContentGenerationResponse, ContentType } from "./ai/types.ts";
import { extractEffectsFromResponse } from "./ai/parser.ts";

// 特殊状态类型
export enum SpecialStatus {
  NONE = "none",
  BLESSED = "blessed", // 神眷
  LUCKY = "lucky",     // 幸运
  CURSED = "cursed",   // 诅咒
  POISONED = "poisoned", // 中毒
  DYING = "dying",     // 濒死
  DEAD = "dead"        // 死亡
}

// 定义状态接口
export interface GameState {
  current: string;
  attributes: Record<string, number>;
  inventory: string[];
  gold: number;
  // 基本历史记录（选择ID）
  history: string[];
  // 详细历史记录，包含选择文本和结果
  detailedHistory: {
    nodeId: string;
    nodeTitle: string;
    choiceId: string;
    choiceText: string;
    result?: string;
    timestamp: number;
  }[];
  // 与NPC的关系值，-100到100
  relationships: Record<string, number>;
  // 触发的特殊剧情
  specialEvents: {
    type: string;
    target?: string;
    stage: number;
    startTimestamp: number;
  }[];
  health: number;
  // 角色相关属性
  character?: {
    name: string;
    race: string;
    class: string;
    backstory?: string;
  };
  // 当前位置信息
  location?: {
    id: string;
    name: string;
    type: string;
  };
  // 上一个节点信息
  lastNode?: {
    id: string;
    title: string;
  };
  // 随机事件结果
  randomEventResult?: string;
  // 特殊状态
  specialStatus: SpecialStatus;
  // 特殊状态持续时间（轮数或节点数）
  statusDuration?: number;
}

// 特殊剧情类型
export enum SpecialEventType {
  ROMANCE = "romance",
  RIVALRY = "rivalry",
  MENTORSHIP = "mentorship",
  BETRAYAL = "betrayal",
  REDEMPTION = "redemption",
  HIDDEN_QUEST = "hidden_quest"
}

// 定义节点接口
export interface GameNode {
  id: string;
  title: string;
  text: string;
  image?: string;
  choices: Choice[];
}

// 定义选择接口
interface Choice {
  id: string;
  text: string;
  target: string;
  condition?: string;
  effect?: string;
}

// 定义世界配置接口
interface WorldConfig {
  races: any[];
  classes: any[];
  randomEvents: any[];
  regions: any[];
  attributePoints?: number;
  starting: {
    node: string;
    attributes: Record<string, number>;
    inventory: string[];
    gold: number;
  };
}

// 缓存
const nodeCache = new Map<string, GameNode>();
let worldConfig: WorldConfig | null = null;

// 加载世界配置
export async function loadWorld(): Promise<WorldConfig> {
  if (worldConfig) {
    return worldConfig;
  }
  
  try {
    const text = await Deno.readTextFile("./config/world.yaml");
    worldConfig = parse(text) as WorldConfig;
    return worldConfig;
  } catch (err: unknown) {
    console.error(`加载世界配置出错: ${err instanceof Error ? err.message : String(err)}`);
    throw new Error(`无法加载世界配置: ${err instanceof Error ? err.message : String(err)}`);
  }
}

// 加载节点数据
export async function loadNode(id: string): Promise<GameNode> {
  // 检查缓存
  if (nodeCache.has(id)) {
    return nodeCache.get(id)!;
  }
  
  // 角色创建相关节点继续使用静态文件
  const staticNodes = [
    'character_creation', 
    'character_summary', 
    'class_selection', 
    'race_info', 
    'class_info'
  ];
  
  if (staticNodes.includes(id)) {
    try {
      const text = await Deno.readTextFile(`./config/nodes/${id}.yaml`);
      const node = parse(text) as GameNode;
      
      // 存入缓存
      nodeCache.set(id, node);
      return node;
    } catch (err: unknown) {
      console.error(`加载节点 ${id} 出错: ${err instanceof Error ? err.message : String(err)}`);
      throw new Error(`无法加载节点 ${id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  } else {
    // 对于非静态节点，使用AI生成内容
    return generateNodeContent(id);
  }
}

// 使用AI生成节点内容
async function generateNodeContent(nodeId: string): Promise<GameNode> {
  // 如果没有具体状态，创建一个默认状态
  const defaultState: PlayerState = {
    character: {
      name: "冒险者",
      race: "human",
      class: "warrior"
    },
    attributes: {
      strength: 5,
      intelligence: 5,
      charisma: 5,
      luck: 5
    },
    inventory: [],
    gold: 10,
    history: [],
    health: 100,
    current: nodeId
  };
  
  // 根据节点ID确定内容类型和位置
  let contentType: "scene" | "event" | "dialogue" | "combat" = "scene";
  let location = "未知区域";
  
  if (nodeId.includes("_tavern")) {
    contentType = "scene";
    location = "酒馆";
  } else if (nodeId.includes("_forest")) {
    contentType = "scene";
    location = "森林";
  } else if (nodeId.includes("_combat")) {
    contentType = "combat";
    location = "战场";
  } else if (nodeId.includes("_npc_")) {
    contentType = "dialogue";
    location = "对话场景";
  } else if (nodeId.includes("_event")) {
    contentType = "event";
    location = "事件现场";
  }
  
  // 构建生成请求
  const request: ContentGenerationRequest = {
    type: ContentType.SCENE,
    state: defaultState,
    location: location,
    context: nodeId
  };
  
  try {
    // 调用AI生成内容
    const response = await generateContent(request);
    
    // 转换为GameNode格式
    const node: GameNode = {
      id: nodeId,
      title: response.title,
      text: response.content,
      image: response.meta?.image_suggestion || "default.jpg",
      choices: response.choices.map((choice, index) => ({
        id: `choice_${nodeId}_${index}`,
        text: choice.text,
        target: `generated_${Math.floor(Math.random() * 1000)}`,
        condition: "",
        effect: JSON.stringify(choice.effects)
      }))
    };
    
    // 存入缓存
    nodeCache.set(nodeId, node);
    return node;
  } catch (error) {
    console.error(`生成节点内容出错:`, error);
    // 返回一个基本的错误节点
    return {
      id: nodeId,
      title: "内容生成错误",
      text: `无法生成内容: ${error instanceof Error ? error.message : String(error)}`,
      choices: [{
        id: "retry",
        text: "重试",
        target: "start"
      }]
    };
  }
}

// 应用选择，更新状态并返回下一个节点
export async function applyChoice(
  state: GameState,
  choiceId: string
): Promise<{ state: GameState; node: GameNode }> {
  // 加载当前节点
  const currentNode = await loadNode(state.current);
  
  // 寻找对应的选择
  const choice = currentNode.choices.find(c => c.id === choiceId);
  if (!choice) {
    throw new Error(`选择 ${choiceId} 在当前节点中不存在`);
  }
  
  // 检查条件是否满足
  if (choice.condition && !evaluateCondition(choice.condition, state)) {
    console.error(`选择条件不满足 - 节点: ${currentNode.id}, 选择: ${choiceId}, 条件: ${choice.condition}`);
    throw new Error(`不满足选择条件: ${choice.condition}`);
  }
  
  // 应用效果
  if (choice.effect) {
    applyEffect(choice.effect, state);
  }
  
  // 保存上一个节点信息，以便AI生成连贯内容
  state.lastNode = {
    id: currentNode.id,
    title: currentNode.title
  };
  
  // 对于AI生成的内容，记录选择并生成结果
  if (choice.target.startsWith('generated_')) {
    try {
      // 转换GameState为PlayerState，确保属性符合Attributes接口要求
      const playerState: PlayerState = {
        character: state.character!,
        attributes: {
          strength: state.attributes.strength || 0,
          intelligence: state.attributes.intelligence || 0,
          charisma: state.attributes.charisma || 0,
          luck: state.attributes.luck || 0,
          ...state.attributes // 保留其他可能的自定义属性
        },
        inventory: state.inventory,
        gold: state.gold,
        history: state.history,
        health: state.health,
        current: state.current,
        specialStatus: state.specialStatus,
        statusDuration: state.statusDuration
      };
      
      // 生成选择结果
      const resultResponse = await generateChoiceResult(
        playerState,
        state.location?.name || "未知位置",
        choiceId,
        choice.text,
        currentNode.title
      );
      
      // 提取效果并应用
      const effects = extractEffectsFromResponse(resultResponse);
      if (effects) {
        // 应用健康值变化
        if (effects.health_change) {
          state.health += effects.health_change;
        }
        
        // 应用金币变化
        if (effects.gold_change) {
          state.gold += effects.gold_change;
        }
        
        // 添加物品
        if (effects.add_items && effects.add_items.length > 0) {
          state.inventory.push(...effects.add_items);
        }
        
        // 移除物品
        if (effects.remove_items && effects.remove_items.length > 0) {
          effects.remove_items.forEach((item: string) => {
            const index = state.inventory.indexOf(item);
            if (index !== -1) {
              state.inventory.splice(index, 1);
            }
          });
        }
        
        // 属性变化
        if (effects.attribute_changes) {
          Object.entries(effects.attribute_changes).forEach(([key, value]) => {
            state.attributes[key] = (state.attributes[key] || 0) + (value as number);
          });
        }
        
        // 关系变化
        if (effects.relationship_changes) {
          Object.entries(effects.relationship_changes).forEach(([npc, value]) => {
            state.relationships[npc] = (state.relationships[npc] || 0) + Number(value);
            // 限制关系值在-100至100之间
            state.relationships[npc] = Math.max(-100, Math.min(100, state.relationships[npc]));
            
            // 检查关系是否达到特殊剧情触发阈值
            if (state.relationships[npc] >= 50) {
              // 检查是否已有此NPC的友好特殊事件
              const existingEvent = state.specialEvents.find(e =>
                e.type === SpecialEventType.ROMANCE && e.target === npc);
              
              if (!existingEvent) {
                // 触发新的爱情剧情
                state.specialEvents.push({
                  type: SpecialEventType.ROMANCE,
                  target: npc,
                  stage: 1,
                  startTimestamp: Date.now()
                });
                console.log(`触发爱情剧情: 对象 ${npc}, 关系值 ${state.relationships[npc]}`);
              }
            } else if (state.relationships[npc] <= -50) {
              // 检查是否已有此NPC的敌对特殊事件
              const existingEvent = state.specialEvents.find(e =>
                e.type === SpecialEventType.RIVALRY && e.target === npc);
              
              if (!existingEvent) {
                // 触发新的敌对剧情
                state.specialEvents.push({
                  type: SpecialEventType.RIVALRY,
                  target: npc,
                  stage: 1,
                  startTimestamp: Date.now()
                });
                console.log(`触发敌对剧情: 对象 ${npc}, 关系值 ${state.relationships[npc]}`);
              }
            }
          });
        }
        
        // 特殊事件
        if (effects.special_event) {
          const eventType = effects.special_event.split(':')[0];
          const eventTarget = effects.special_event.split(':')[1] || undefined;
          
          // 检查是否已有相同类型和目标的事件
          const existingEvent = state.specialEvents.find(e =>
            e.type === eventType && e.target === eventTarget);
          
          if (!existingEvent) {
            state.specialEvents.push({
              type: eventType,
              target: eventTarget,
              stage: 1,
              startTimestamp: Date.now()
            });
            console.log(`触发特殊事件: 类型 ${eventType}, 目标 ${eventTarget || '无'}`);
          } else {
            // 推进现有事件阶段
            existingEvent.stage += 1;
            console.log(`特殊事件推进: 类型 ${eventType}, 目标 ${eventTarget || '无'}, 阶段 ${existingEvent.stage}`);
          }
        }
      }
      
      // 记录随机事件结果
      state.randomEventResult = resultResponse.content;
      
      // 生成新的场景节点
      const newNodeId = `generated_${Date.now()}`;
      
      // 更新状态
      state.current = newNodeId;
      state.history.push(choiceId);
      
      // 生成新的位置信息
      if (resultResponse.meta?.location) {
        state.location = {
          id: `loc_${Date.now()}`,
          name: resultResponse.meta.location,
          type: "generated"
        };
      }
      
      // 创建内容生成请求
      const nextSceneRequest: ContentGenerationRequest = {
        type: ContentType.SCENE,
        location: state.location?.name || "未知位置",
        // 增强上下文，添加前一个选择和结果的信息，避免内容重复
        context: `${resultResponse.meta?.next_scene_suggestion || "继续冒险"}。玩家刚刚选择了: "${choice.text}"。前一个场景是: "${currentNode.title}"`,
        nodeId: `node_${Date.now()}`, // 确保每次生成都有唯一节点ID
        state: {
          ...state,
          // 确保传递特殊事件信息给AI
          specialEventsContext: state.specialEvents && state.specialEvents.length > 0 ?
            createSpecialEventsContext(state) : "",
          // 添加更多状态信息
          lastChoice: {
            id: choiceId,
            text: choice.text,
            previousNode: currentNode.title,
            timestamp: Date.now()
          }
        }
      };
      
      // 生成下一个场景
      const nextSceneResponse = await generateContent(nextSceneRequest);
      
      // 转换为GameNode
      const nextNode: GameNode = {
        id: newNodeId,
        title: nextSceneResponse.title,
        text: nextSceneResponse.content,
        image: nextSceneResponse.meta?.image_suggestion,
        choices: nextSceneResponse.choices.map((choice, index) => ({
          id: `choice_${index}`,
          text: choice.text,
          target: `generated_${Math.floor(Math.random() * 1000)}`,
          condition: "",
          effect: ""
        }))
      };
      
      // 存入缓存
      nodeCache.set(newNodeId, nextNode);
      
      return { state, node: nextNode };
    } catch (error) {
      console.error(`生成选择结果出错:`, error);
      // 回退到普通节点加载
    }
  }
  
  // 更新状态
  state.current = choice.target;
  state.history.push(choiceId);
  
  // 检查是否触发随机事件
  const randomEvent = await checkRandomEvent(state);
  if (randomEvent) {
    // 如果触发随机事件，更新状态和目标节点
    return randomEvent;
  }
  
  // 加载下一个节点
  const nextNode = await loadNode(state.current);
  
  return { state, node: nextNode };
}

// 初始化游戏状态
export async function initState(): Promise<GameState> {
  const world = await loadWorld();
  
  return {
    current: world.starting.node,
    attributes: { ...world.starting.attributes },
    inventory: [...world.starting.inventory],
    gold: world.starting.gold,
    history: [],
    detailedHistory: [],
    relationships: {},
    specialEvents: [],
    health: 100,
    specialStatus: SpecialStatus.NONE,
    location: {
      id: "starting_location",
      name: "黎明之城",
      type: "city"
    }
  };
}

// 创建角色并初始化游戏状态
export async function createCharacter(
  name: string,
  raceId: string,
  classId: string,
  backstory?: string,
  attributePoints?: Record<string, number>
): Promise<GameState> {
  const world = await loadWorld();
  
  // 查找所选种族
  const race = world.races.find(r => r.id === raceId);
  if (!race) {
    throw new Error(`无效的种族: ${raceId}`);
  }
  
  // 查找所选职业
  const characterClass = world.classes.find(c => c.id === classId);
  if (!characterClass) {
    throw new Error(`无效的职业: ${classId}`);
  }
  
  // 合并种族和职业的基础属性
  const baseAttributes = { ...world.starting.attributes };
  
  // 应用种族属性修正
  Object.entries(race.attributes).forEach(([key, value]) => {
    baseAttributes[key] = (baseAttributes[key] || 0) + Number(value);
  });
  
  // 应用职业属性修正
  Object.entries(characterClass.attributes).forEach(([key, value]) => {
    // 处理形如 "+2" 或 "-1" 的修正值
    const modifier = String(value).trim();
    if (modifier.startsWith('+')) {
      baseAttributes[key] += Number(modifier.substring(1));
    } else if (modifier.startsWith('-')) {
      baseAttributes[key] += Number(modifier); // 负号已经包含在字符串中
    } else {
      // 当没有前缀时，将其视为增量而不是替换
      baseAttributes[key] += Number(modifier);
    }
  });
  
  // 应用玩家自定义的属性点分配
  let finalAttributes = { ...baseAttributes };
  if (attributePoints) {
    finalAttributes = { ...baseAttributes };
    Object.entries(attributePoints).forEach(([key, value]) => {
      finalAttributes[key] = baseAttributes[key] + value;
    });
  }
  
  // 初始特殊状态（基于幸运值）
  let initialStatus = SpecialStatus.NONE;
  if (finalAttributes.luck && finalAttributes.luck >= 10) {
    // 高幸运初始状态为"幸运"
    initialStatus = SpecialStatus.LUCKY;
  }
  
  // 创建游戏状态
  return {
    current: world.starting.node,
    attributes: finalAttributes,
    inventory: [...world.starting.inventory],
    gold: world.starting.gold,
    history: [],
    detailedHistory: [],
    relationships: {},
    specialEvents: [],
    health: 100,
    specialStatus: initialStatus,
    statusDuration: initialStatus !== SpecialStatus.NONE ? 3 : undefined,
    character: {
      name,
      race: raceId,
      class: classId,
      backstory
    },
    location: {
      id: "starting_location",
      name: "黎明之城",
      type: "city"
    }
  };
}

// 获取可用的自定义属性点
export async function getAvailableAttributePoints(): Promise<number> {
  const world = await loadWorld();
  return world.attributePoints || 5; // 默认5点，如果配置文件中未指定
}

// 重置游戏状态
export async function resetGame(state: GameState): Promise<GameState> {
  const { character } = state;
  if (!character) {
    return initState();
  }
  
  // 保留角色信息，但重置游戏进度
  return await createCharacter(
    character.name,
    character.race,
    character.class,
    character.backstory
  );
}

// 辅助函数: 评估条件
function evaluateCondition(condition: string, state: GameState): boolean {
  if (!condition.trim()) {
    return true; // 空条件始终为真
  }
  
  try {
    // 使用Function构造器创建一个动态函数来安全地评估条件
    // state传递给函数作为上下文
    const evalFunc = new Function("state", `return ${condition};`);
    return evalFunc(state);
  } catch (err: unknown) {
    console.error(`评估条件 "${condition}" 出错: ${err instanceof Error ? err.message : String(err)}`);
    return false;
  }
}

// 辅助函数: 应用效果
function applyEffect(effect: string, state: GameState): void {
  if (!effect.trim()) {
    return; // 空效果不做任何事
  }
  
  try {
    // 使用Function构造器创建一个动态函数来安全地应用效果
    // state传递给函数作为上下文
    const evalFunc = new Function("state", effect);
    evalFunc(state);
    
    // 应用特殊状态效果和检查游戏结局
    applySpecialStatusEffects(state);
    checkGameEndingConditions(state);
  } catch (err: unknown) {
    console.error(`应用效果 "${effect}" 出错: ${err instanceof Error ? err.message : String(err)}`);
  }
}

// 应用特殊状态效果
function applySpecialStatusEffects(state: GameState): void {
  // 如果有特殊状态，处理其效果
  switch(state.specialStatus) {
    case SpecialStatus.BLESSED:
      // 神眷状态：所有属性检定+2
      break;
      
    case SpecialStatus.LUCKY:
      // 幸运状态：好事件概率提高
      break;
      
    case SpecialStatus.CURSED:
      // 诅咒状态：所有属性检定-2
      break;
      
    case SpecialStatus.POISONED:
      // 中毒状态：每回合损失健康值
      state.health -= 5;
      break;
      
    case SpecialStatus.DYING:
      // 濒死状态：健康值持续下降
      state.health -= 10;
      break;
  }
  
  // 处理状态持续时间
  if (state.specialStatus !== SpecialStatus.NONE && state.specialStatus !== SpecialStatus.DEAD && state.statusDuration !== undefined) {
    state.statusDuration -= 1;
    
    // 状态持续时间结束
    if (state.statusDuration <= 0) {
      state.specialStatus = SpecialStatus.NONE;
      state.statusDuration = undefined;
    }
  }
}

// 检查游戏结局条件
function checkGameEndingConditions(state: GameState): void {
  // 检查健康值
  if (state.health <= 0 && state.specialStatus !== SpecialStatus.DEAD) {
    state.specialStatus = SpecialStatus.DEAD;
    state.health = 0;
    // 可以添加死亡事件或结局的逻辑
  }
  
  // 其他可能的游戏结局条件
  // 例如：特定物品组合、特定属性达到某个值等
}

// 辅助函数: 检查随机事件
async function checkRandomEvent(
  state: GameState
): Promise<{ state: GameState; node: GameNode } | null> {
  // 获取世界配置
  const world = await loadWorld();
  
  // 根据特殊状态调整随机事件触发概率
  let triggerChance = 0.1; // 基础10%触发概率
  
  // 幸运状态提高好事件概率
  if (state.specialStatus === SpecialStatus.LUCKY) {
    triggerChance = 0.2; // 提高到20%
  }
  
  // 诅咒状态提高坏事件概率
  if (state.specialStatus === SpecialStatus.CURSED) {
    triggerChance = 0.15; // 提高到15%
  }
  
  // 检查是否触发事件
  if (Math.random() < triggerChance) {
    // 根据权重选择随机事件
    let events = [...world.randomEvents]; // 创建副本以避免修改原始数据
    
    // 根据特殊状态过滤和调整事件
    if (state.specialStatus === SpecialStatus.LUCKY) {
      // 幸运状态下，增加好事件的权重
      events = events.map(event => {
        if (event.type === "good") {
          return { ...event, weight: event.weight * 2 }; // 好事件权重加倍
        }
        return event;
      });
    } else if (state.specialStatus === SpecialStatus.CURSED) {
      // 诅咒状态下，增加坏事件的权重
      events = events.map(event => {
        if (event.type === "bad") {
          return { ...event, weight: event.weight * 2 }; // 坏事件权重加倍
        }
        return event;
      });
    }
    // 检查是否应该触发特殊剧情
    function checkSpecialEventTriggers(state: GameState, choiceText: string): void {
      // 确保detailedHistory存在
      if (!state.detailedHistory) {
        state.detailedHistory = [];
        return;
      }
      
      // 只分析最近的10个选择
      const recentHistory = state.detailedHistory.slice(-10);
      
      
      // 分析选择文本模式
      const romanceKeywords = ['浪漫', '魅力', '吸引', '微笑', '倾心', '爱意'];
      const combatKeywords = ['战斗', '攻击', '挑战', '击败', '武器'];
      const explorationKeywords = ['探索', '寻找', '调查', '发现'];
      const mentorshipKeywords = ['学习', '请教', '指导', '教导', '训练'];
      
      // 检查是否有针对特定NPC的重复互动
      const npcInteractions: Record<string, number> = {};
      
      recentHistory.forEach(history => {
        // 提取选择文本中可能的NPC名称（简化处理，实际中可能需要更复杂的NPC识别）
        const match = history.choiceText.match(/与([^，。,\.]+)交谈|询问([^，。,\.]+)|接近([^，。,\.]+)/);
        if (match) {
          const npcName = match[1] || match[2] || match[3];
          npcInteractions[npcName] = (npcInteractions[npcName] || 0) + 1;
          
          // 如果有针对同一NPC的多次互动，检查是否应该触发特殊剧情
          if (npcInteractions[npcName] >= 3) {
            // 检查互动风格
            const isRomantic = romanceKeywords.some(kw =>
              history.choiceText.includes(kw) || (history.result || '').includes(kw));
              
            const isMentorship = mentorshipKeywords.some(kw =>
              history.choiceText.includes(kw) || (history.result || '').includes(kw));
            
            // 根据互动风格触发不同类型的特殊剧情
            if (isRomantic && !state.specialEvents.some(e =>
                e.type === SpecialEventType.ROMANCE && e.target === npcName)) {
              state.specialEvents.push({
                type: SpecialEventType.ROMANCE,
                target: npcName,
                stage: 1,
                startTimestamp: Date.now()
              });
              console.log(`基于互动频率触发爱情剧情: 对象 ${npcName}`);
            } else if (isMentorship && !state.specialEvents.some(e =>
                e.type === SpecialEventType.MENTORSHIP && e.target === npcName)) {
              state.specialEvents.push({
                type: SpecialEventType.MENTORSHIP,
                target: npcName,
                stage: 1,
                startTimestamp: Date.now()
              });
              console.log(`基于互动频率触发师徒剧情: 对象 ${npcName}`);
            }
          }
        }
      });
      
      // 检查当前选择是否可能触发隐藏任务
      if (choiceText.includes('调查') || choiceText.includes('探索') || choiceText.includes('寻找线索')) {
        const items = state.inventory.join(',').toLowerCase();
        const hasSpecialItemCombo =
          (items.includes('古老地图') && items.includes('神秘钥匙')) ||
          (items.includes('破损卷轴') && items.includes('魔法印记')) ||
          (items.includes('失落的文献') && choiceText.includes('图书馆'));
          
        if (hasSpecialItemCombo && !state.specialEvents.some(e => e.type === SpecialEventType.HIDDEN_QUEST)) {
          state.specialEvents.push({
            type: SpecialEventType.HIDDEN_QUEST,
            stage: 1,
            startTimestamp: Date.now()
          });
          console.log(`基于物品组合和选择触发隐藏任务`);
        }
      }
    }
    
    
    const totalWeight = events.reduce((sum, event) => sum + (event.weight || 1), 0);
    let random = Math.random() * totalWeight;
    
    for (const event of events) {
      random -= (event.weight || 1);
      if (random <= 0) {
        // 创建一个临时的节点对象表示随机事件
        const eventNode: GameNode = {
          id: `random_${event.id}`,
          title: `随机事件: ${event.name || event.id}`,
          text: event.text,
          choices: event.choices.map((choice: any) => ({
            id: choice.id,
            text: choice.text,
            target: state.current, // 随机事件完成后回到原来的节点
            condition: choice.condition,
            effect: `${choice.effect}; state.randomEventResult = "${choice.result}";`
          }))
        };
        
        return { state, node: eventNode };
      }
    }
  }
  
  return null;
}

// 将特殊事件转换为上下文描述，供AI使用
function createSpecialEventsContext(state: GameState): string {
  if (!state.specialEvents || state.specialEvents.length === 0) {
    return "";
  }
  
  // 添加时间戳和选择历史信息，使上下文更具唯一性
  const recentChoices = state.detailedHistory ?
    state.detailedHistory.slice(-3).map(h => h.choiceText).join('->') :
    "无选择历史";
  
  const eventsContext = state.specialEvents.map(event => {
    // 添加事件开始时间信息
    const eventAge = Math.floor((Date.now() - event.startTimestamp) / (1000 * 60 * 60)); // 小时
    const ageDesc = eventAge <= 1 ? "刚刚开始" : `${eventAge}小时前开始`;
    
    switch (event.type) {
      case SpecialEventType.ROMANCE:
        return `特殊事件:爱情剧情，目标:${event.target || '无名'}，阶段:${event.stage}，${ageDesc}。根据阶段增加亲密互动和情感描写。`;
      
      case SpecialEventType.RIVALRY:
        return `特殊事件:敌对关系，目标:${event.target || '无名'}，阶段:${event.stage}，${ageDesc}。增加紧张氛围和对抗描述。`;
      
      case SpecialEventType.MENTORSHIP:
        return `特殊事件:师徒关系，目标:${event.target || '无名'}，阶段:${event.stage}，${ageDesc}。增加学习场景和知识传授内容。`;
      
      case SpecialEventType.HIDDEN_QUEST:
        return `特殊事件:隐藏任务，阶段:${event.stage}，${ageDesc}。添加神秘线索和探索动机。`;
      
      case SpecialEventType.BETRAYAL:
        return `特殊事件:背叛剧情，目标:${event.target || '无名'}，阶段:${event.stage}，${ageDesc}。增加背叛迹象和信任危机描写。`;
      
      case SpecialEventType.REDEMPTION:
        return `特殊事件:救赎剧情，阶段:${event.stage}，${ageDesc}。增加弥补过错和改变的机会。`;
      
      default:
        return `特殊事件:${event.type}，目标:${event.target || '无'}，阶段:${event.stage}，${ageDesc}`;
    }
  }).join("；\n");
  
  // 添加玩家当前状态的简要描述，使内容更加连贯
  const playerStatus = `当前位置:${state.location?.name || '未知'}，健康状态:${state.health}/100，金币:${state.gold}，特殊状态:${state.specialStatus || '无'}`;
  
  return `玩家最近选择:${recentChoices}\n${playerStatus}\n特殊事件上下文:\n${eventsContext}`;
}