import {
  ContentGenerationRequest,
  ContentGenerationResponse,
  PlayerState,
  RegionMetadata,
  NPCMetadata,
  EventTypeMetadata,
  ContentType
} from "./types.ts";
import { askAI } from "./service.ts";
import {
  createScenePrompt,
  createDialoguePrompt,
  createEventPrompt,
  createCombatPrompt,
  createChoiceResultPrompt,
  FANTASY_WORLD_SYSTEM,
  QUALITY_INSTRUCTION,
  SPECIAL_EVENTS_INSTRUCTION
} from "./prompts.ts";
import { parseAIResponse, validateAIResponse } from "./parser.ts";
import * as YAML from "yaml";
import { ensureDir } from "https://deno.land/std/fs/mod.ts";

// 缓存目录
const CACHE_DIR = "./cache";
const CACHE_FILE = `${CACHE_DIR}/ai_response_cache.json`;

// 缓存最近的生成结果，用于避免重复请求
const recentGenerations = new Map<string, ContentGenerationResponse>();

// 初始化缓存系统
async function initCache() {
  try {
    // 确保缓存目录存在
    await ensureDir(CACHE_DIR);
    console.log("缓存目录已准备好");
    
    // 尝试加载现有缓存
    await loadCache();
    
    // 设置定期保存缓存的间隔
    setInterval(() => {
      saveCache().catch(err => {
        console.error("保存缓存失败:", err);
      });
    }, 5 * 60 * 1000); // 每5分钟保存一次
    
    console.log("缓存系统初始化完成");
  } catch (error) {
    console.error("初始化缓存系统失败:", error);
  }
}

// 从文件加载缓存
async function loadCache() {
  try {
    const cacheText = await Deno.readTextFile(CACHE_FILE);
    const cacheData = JSON.parse(cacheText);
    
    // 重新填充缓存
    for (const [key, value] of Object.entries(cacheData)) {
      recentGenerations.set(key, value as ContentGenerationResponse);
    }
    
    console.log(`已从文件加载${Object.keys(cacheData).length}个AI响应缓存`);
  } catch (error) {
    // 文件可能不存在，这是预期的
    if (!(error instanceof Deno.errors.NotFound)) {
      console.error("加载缓存文件失败:", error);
    } else {
      console.log("没有找到现有缓存文件，将创建新缓存");
    }
  }
}

// 将缓存保存到文件
async function saveCache() {
  if (recentGenerations.size === 0) {
    console.log("缓存为空，跳过保存");
    return;
  }
  
  try {
    // 仅缓存最近的50个生成结果
    const recentKeys = Array.from(recentGenerations.keys()).slice(-50);
    const cacheData = Object.fromEntries(
      recentKeys.map(key => [key, recentGenerations.get(key)])
    );
    
    await Deno.writeTextFile(
      CACHE_FILE, 
      JSON.stringify(cacheData, null, 2)
    );
    console.log(`AI响应缓存已保存到文件，包含${recentKeys.length}个条目`);
  } catch (error) {
    console.error("保存AI缓存失败:", error);
  }
}

// 清理旧缓存项目
function cleanupCache() {
  const beforeSize = recentGenerations.size;
  
  if (recentGenerations.size > 100) {
    console.log(`缓存项目数量(${recentGenerations.size})超过100，开始清理...`);
    
    // 获取所有缓存键并按添加时间排序
    const keys = Array.from(recentGenerations.keys());
    const keysToRemove = keys.slice(0, 50);
    
    // 删除最旧的50项
    keysToRemove.forEach(key => recentGenerations.delete(key));
    
    console.log(`缓存清理完成：从 ${beforeSize} 项减少到 ${recentGenerations.size} 项`);
    
    // 清理后保存缓存
    saveCache().catch(err => {
      console.error("清理后保存缓存失败:", err);
    });
  }
}

// 根据不同类型的请求生成内容
export async function generateContent(
  request: ContentGenerationRequest | any
): Promise<ContentGenerationResponse> {
  try {
    // 兼容处理旧版接口
    const compatRequest: ContentGenerationRequest = {
      type: request.type || request.generationType || ContentType.SCENE,
      location: request.location || request.currentLocation || "未知位置",
      state: request.state || request.playerState,
      context: request.context,
      nodeId: request.nodeId
    };
    
    // 记录生成内容请求的信息
    console.log(`开始生成内容 - 类型: ${compatRequest.type}, 位置: ${compatRequest.location}`);
    
    // 验证请求参数
    if (!compatRequest.type) {
      throw new Error("缺少内容类型参数");
    }
    
    if (!compatRequest.location) {
      throw new Error("缺少位置参数");
    }
    
    // 生成缓存键
    const cacheKey = createCacheKey(compatRequest);
    
    // 检查缓存
    if (recentGenerations.has(cacheKey)) {
      console.log(`使用缓存结果 - 缓存键: ${cacheKey}`);
      const cachedResponse = recentGenerations.get(cacheKey)!;
      
      // 验证缓存的响应
      if (validateAIResponse(cachedResponse)) {
        return cachedResponse;
      } else {
        console.log("缓存的响应无效，重新生成内容");
        recentGenerations.delete(cacheKey);
      }
    }
    
    // 将GameState转换为PlayerState
    const playerState = convertStateToPlayerState(compatRequest.state);
    console.log(`转换后的玩家状态 - 名称: ${playerState.character.name}, 种族: ${playerState.character.race}, 职业: ${playerState.character.class}`);
    
    // 根据类型构建提示
    let prompt = "";
    
    switch (compatRequest.type) {
      case ContentType.SCENE:
        console.log(`生成场景描述 - 位置: ${compatRequest.location}`);
        prompt = await createSceneForLocation(
          playerState, 
          compatRequest.location
        );
        break;
      case ContentType.DIALOGUE:
        console.log(`生成对话内容 - NPC: ${compatRequest.location}`);
        prompt = await createDialogueForNPC(
          playerState, 
          compatRequest.location
        );
        break;
      case ContentType.EVENT:
        console.log(`生成随机事件 - 位置: ${compatRequest.location}`);
        prompt = await createRandomEvent(
          playerState, 
          compatRequest.location
        );
        break;
      case ContentType.COMBAT:
        console.log(`生成战斗场景 - 位置: ${compatRequest.location}, 敌人: ${compatRequest.context || "敌人"}`);
        prompt = await createCombatScene(
          playerState, 
          compatRequest.location,
          compatRequest.context || "敌人"
        );
        break;
      default:
        throw new Error(`不支持的生成类型: ${compatRequest.type}`);
    }
    
    console.log(`提示词生成完成，准备调用AI服务`);
    
    // 添加重试机制
    const maxRetries = 2;
    let retries = 0;
    let responseText = "";
    let error = null;
    
    while (retries <= maxRetries) {
      try {
        // 调用AI生成内容
        responseText = await askAI(prompt);
        
        if (responseText) {
          break; // 成功获取响应，跳出循环
        } else {
          throw new Error("AI服务返回空响应");
        }
      } catch (err) {
        error = err;
        retries++;
        
        if (retries <= maxRetries) {
          const delay = 1000 * retries; // 1秒, 2秒, ...
          console.log(`第${retries}次重试请求失败，等待${delay}ms后重试...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    // 检查是否获得了有效响应
    if (!responseText) {
      console.error("达到最大重试次数，无法获取AI响应:", error);
      return createErrorResponse("无法连接到AI服务，请稍后重试");
    }
    
    console.log(`AI响应已获取，长度: ${responseText.length}字符`);
    
    // 使用parseAIResponse解析响应
    const parsedResponse = parseAIResponse(responseText);
    console.log(`响应解析完成 - 标题: ${parsedResponse.title}, 选项数: ${parsedResponse.choices.length}`);
    
    // 验证解析结果
    if (!validateAIResponse(parsedResponse)) {
      console.error("解析的响应无效，使用备用响应");
      return createErrorResponse("AI生成的内容格式无效，请重试");
    }
    
    // 缓存结果
    recentGenerations.set(cacheKey, parsedResponse);
    cleanupCache();
    console.log(`内容生成完成并已缓存`);
    
    return parsedResponse;
  } catch (error) {
    console.error("生成内容时出错:", error);
    return createErrorResponse(
      error instanceof Error ? error.message : String(error)
    );
  }
}

// 创建错误响应
function createErrorResponse(message: string): ContentGenerationResponse {
  return {
    title: "生成内容失败",
    content: `生成内容时出现错误: ${message}\n\n你可以尝试重新生成内容或选择其他操作。`,
    choices: [
      { text: "重试", effects: {} },
      { text: "返回", effects: {} }
    ],
    meta: {
      image_suggestion: "error.jpg",
      error: true
    }
  };
}

// 将游戏状态转换为AI生成所需的玩家状态
function convertStateToPlayerState(state: any): PlayerState {
  if (!state) {
    console.log("警告: 状态为空，使用默认玩家状态");
    return {
      character: {
        name: "无名冒险者",
        race: "人类",
        class: "冒险者"
      },
      attributes: { strength: 10, intelligence: 10, charisma: 10, luck: 10 },
      inventory: [],
      gold: 0,
      health: 100,
      history: [],
      current: ""
    };
  }
  
  return {
    character: {
      name: state.character?.name || "无名冒险者",
      race: state.character?.race || "人类",
      class: state.character?.class || "冒险者",
      backstory: state.character?.backstory
    },
    attributes: state.attributes || { strength: 10, intelligence: 10, charisma: 10, luck: 10 },
    inventory: state.inventory || [],
    gold: state.gold || 0,
    health: state.health || 100,
    history: state.history || [],
    current: state.current || "",
    // 添加可选字段
    reputation: state.reputation,
    relationships: state.relationships,
    quests: state.quests,
    skills: state.skills,
    knowledge: state.knowledge
  };
}

// 生成场景描述
async function createSceneForLocation(
  playerState: PlayerState,
  location: string
): Promise<string> {
  // 尝试加载位置的元数据
  let regionData: RegionMetadata | undefined;
  
  try {
    // 首先尝试从缓存中获取动态生成的元数据
    regionData = regionMetadataCache.get(location);
    
    // 如果缓存中没有，尝试从文件加载
    if (!regionData) {
      try {
        regionData = await loadRegionMetadata(location);
      } catch (error) {
        // 如果文件也没有，使用AI生成元数据
        console.log(`为区域 ${location} 动态生成元数据`);
        regionData = await generateRegionMetadata(location, playerState);
        
        // 将生成的元数据存入缓存
        regionMetadataCache.set(location, regionData);
      }
    }
  } catch (error) {
    console.error(`生成区域 ${location} 的元数据时出错:`, error);
    // 如果发生错误，使用增强的默认区域
    regionData = createEnhancedDefaultRegion(location);
  }
  
  return createScenePrompt(playerState, location, regionData);
}

// 用于缓存动态生成的区域元数据
const regionMetadataCache = new Map<string, RegionMetadata>();

// 使用AI生成区域元数据
async function generateRegionMetadata(location: string, playerState: PlayerState): Promise<RegionMetadata> {
  // 创建区域生成的提示词
  const prompt = `
${FANTASY_WORLD_SYSTEM}

请为奇幻世界中的位置"${location}"生成详细的区域元数据。考虑玩家角色(${playerState.character.name}，${playerState.character.race} ${playerState.character.class})和其历史行为。

以JSON格式返回一个包含以下字段的区域描述:
{
  "id": "${location}",
  "name": "${location}的完整名称",
  "description": "详细的区域描述（至少100字）",
  "climate": "区域气候",
  "danger_level": 数字（1-10）,
  "features": ["独特地形特征1", "独特地形特征2", ...],
  "npcs": ["可能出现的NPC类型1", "可能出现的NPC类型2", ...],
  "possible_events": ["可能发生的事件1", "可能发生的事件2", ...],
  "connected_regions": ["相邻区域1", "相邻区域2", ...],
  "mood": "区域整体氛围",
  "dangers": ["潜在危险1", "潜在危险2", ...],
  "opportunities": ["可能的机遇1", "可能的机遇2", ...],
  "points_of_interest": ["有趣地点1", "有趣地点2", ...]
}

创建一个独特、有深度且符合奇幻世界观的区域。确保其描述生动丰富，包含感官细节，并为玩家提供有趣的探索和互动机会。
`;

  try {
    // 调用AI生成内容
    const response = await askAI(prompt, {
      temperature: 0.8,  // 较高的随机性以获得更多样化的结果
      maxTokens: 1000    // 足够生成详细描述
    });
    
    // 尝试解析返回的JSON
    try {
      const jsonStart = response.indexOf('{');
      const jsonEnd = response.lastIndexOf('}') + 1;
      
      if (jsonStart >= 0 && jsonEnd > jsonStart) {
        const jsonStr = response.substring(jsonStart, jsonEnd);
        const metadata = JSON.parse(jsonStr) as RegionMetadata;
        
        // 确保所有必要的字段都存在
        return {
          id: metadata.id || location,
          name: metadata.name || formatRegionName(location),
          description: metadata.description || `一个名为${location}的神秘地方。`,
          climate: metadata.climate || "温和",
          danger_level: metadata.danger_level || Math.floor(Math.random() * 10) + 1,
          features: metadata.features || ["独特地形"],
          npcs: metadata.npcs || ["居民", "旅行者"],
          possible_events: metadata.possible_events || ["偶遇", "发现"],
          connected_regions: metadata.connected_regions || [],
          mood: metadata.mood || "神秘",
          dangers: metadata.dangers || ["未知威胁"],
          opportunities: metadata.opportunities || ["新的发现"],
          points_of_interest: metadata.points_of_interest || ["值得探索的地点"]
        };
      }
    } catch (parseError) {
      console.error("解析AI生成的区域元数据失败:", parseError);
    }
  } catch (error) {
    console.error("生成区域元数据时出错:", error);
  }
  
  // 如果AI生成失败，返回增强的默认区域
  return createEnhancedDefaultRegion(location);
}

// 创建增强的默认区域元数据（比原来的默认区域更丰富）
function createEnhancedDefaultRegion(regionId: string): RegionMetadata {
  // 随机选择一些NPC类型
  const possibleNpcs = [
    "商人", "卫兵", "冒险者", "旅店老板", "铁匠", "吟游诗人", "农夫",
    "贵族", "学者", "魔法师", "神秘旅人", "盗贼", "佣兵", "牧师"
  ];
  
  // 随机选择一些兴趣点
  const possiblePoi = [
    "古老的神殿", "繁忙的市场", "隐蔽的酒馆", "高耸的塔楼", "破旧的书店",
    "宏伟的喷泉", "秘密地下通道", "神秘的雕像", "华丽的宫殿", "古老的树林",
    "废弃的矿洞", "宁静的湖泊", "繁华的街道", "神秘的符文石"
  ];
  
  // 随机选择一些危险
  const possibleDangers = [
    "潜伏的盗贼", "野蛮生物", "腐败官员", "黑暗魔法", "古老诅咒",
    "自然灾害", "敌对势力", "秘密阴谋", "瘟疫威胁", "食物短缺"
  ];
  
  // 随机选择一些机遇
  const possibleOpportunities = [
    "珍贵宝藏", "稀有知识", "有益盟友", "神秘力量", "隐藏技能",
    "值得信赖的朋友", "有价值的情报", "重要线索", "特殊装备", "魔法道具"
  ];
  
  // 随机选择气候
  const climates = ["温暖", "寒冷", "干燥", "潮湿", "温带", "热带", "沙漠气候", "山地气候"];
  
  // 随机选择氛围
  const moods = ["神秘", "欢快", "压抑", "紧张", "平静", "繁忙", "危险", "安全", "古老", "神圣"];
  
  // 随机选择并返回一个更丰富的区域描述
  return {
    id: regionId,
    name: formatRegionName(regionId),
    description: `一个名为${formatRegionName(regionId)}的神秘地方，这里的居民对外来者既好奇又警惕。古老的建筑诉说着悠久历史，而街道上的低语则暗示着未知的秘密。空气中弥漫着冒险与机遇的气息，引人深入探索。`,
    climate: climates[Math.floor(Math.random() * climates.length)],
    danger_level: Math.floor(Math.random() * 10) + 1,
    features: ["古老建筑", "独特地形", "神秘符文"],
    npcs: possibleNpcs.sort(() => 0.5 - Math.random()).slice(0, 3 + Math.floor(Math.random() * 3)),
    possible_events: ["偶遇", "发现", "危险", "机遇", "交易"],
    connected_regions: [],
    mood: moods[Math.floor(Math.random() * moods.length)],
    dangers: possibleDangers.sort(() => 0.5 - Math.random()).slice(0, 2 + Math.floor(Math.random() * 3)),
    opportunities: possibleOpportunities.sort(() => 0.5 - Math.random()).slice(0, 2 + Math.floor(Math.random() * 3)),
    points_of_interest: possiblePoi.sort(() => 0.5 - Math.random()).slice(0, 3 + Math.floor(Math.random() * 4))
  };
}

// 生成NPC对话
async function createDialogueForNPC(
  playerState: PlayerState,
  npcName: string
): Promise<string> {
  // 尝试加载NPC元数据
  let npcData: NPCMetadata | undefined;
  
  try {
    npcData = await loadNPCMetadata(npcName);
  } catch (error) {
    // 如果找不到NPC数据，创建一个基本的NPC
    npcData = createGenericNPC(npcName);
  }
  
  return createDialoguePrompt(playerState, npcData);
}

// 生成随机事件
async function createRandomEvent(
  playerState: PlayerState,
  location: string
): Promise<string> {
  // 尝试加载一个随机事件类型
  let eventType: EventTypeMetadata | undefined;
  
  try {
    eventType = await loadRandomEventType();
  } catch (error) {
    console.log("未能加载随机事件类型");
  }
  
  return createEventPrompt(playerState, location, eventType);
}

// 生成战斗场景
async function createCombatScene(
  playerState: PlayerState,
  location: string,
  enemy: string
): Promise<string> {
  return createCombatPrompt(playerState, enemy, location);
}

// 生成选择结果
export async function generateChoiceResult(
  playerState: PlayerState,
  location: string,
  choiceId: string,
  choiceText: string,
  previousNode: string
): Promise<ContentGenerationResponse> {
  try {
    // 创建提示
    const prompt = createChoiceResultPrompt(
      playerState,
      location,
      choiceId,
      choiceText,
      previousNode
    );
    
    // 生成缓存键 - 添加关系信息和时间戳使缓存更具唯一性
    
    // 从关系中提取信息增强缓存键
    const relationshipInfo = playerState.relationships ?
      Object.entries(playerState.relationships)
        .map(([name, value]) => `${name}:${value}`)
        .slice(0, 3) // 只取前3个关系，避免键过长
        .join('_')
      : '';
    
    // 添加库存大小和金币状态
    const inventoryStatus = `inv:${playerState.inventory.length}:g${playerState.gold}`;
    
    // 添加时间戳组件避免缓存冲突
    const timeComponent = Math.floor(Date.now() / (1000 * 60 * 5)); // 每5分钟变化一次
    
    const cacheKey = `choice_result:${choiceId}:${location}:${previousNode}:${relationshipInfo}:${inventoryStatus}:${timeComponent}`;
    
    // 检查缓存
    if (recentGenerations.has(cacheKey)) {
      console.log(`使用缓存的选择结果 - 缓存键: ${cacheKey}`);
      return recentGenerations.get(cacheKey)!;
    }
    
    // 调用AI
    const responseText = await askAI(prompt);
    
    // 解析响应
    const parsedResponse = parseAIResponse(responseText);
    
    // 缓存结果
    recentGenerations.set(cacheKey, parsedResponse);
    
    return parsedResponse;
  } catch (error) {
    console.error("生成选择结果出错:", error);
    return createErrorResponse("生成选择结果失败，请重试");
  }
}

// 创建缓存键
function createCacheKey(request: ContentGenerationRequest): string {
  // 不包含完整状态，因为状态会经常变化
  // 而是使用关键状态信息创建缓存键
  let stateFingerprint = "no_state";
  
  if (request.state) {
    // 创建更丰富的状态指纹
    const race = request.state.character?.race || "";
    const characterClass = request.state.character?.class || "";
    const invSize = request.state.inventory?.length || 0;
    const goldAmount = request.state.gold || 0;
    const health = request.state.health || 100;
    
    // 添加最近的历史事件（最后3个）
    const recentHistory = request.state.history && request.state.history.length > 0
      ? request.state.history.slice(-3).join('-')
      : "no-history";
    
    stateFingerprint = `${race}_${characterClass}_inv:${invSize}_g:${goldAmount}_h:${health}_${recentHistory}`;
  }
  
  // 添加更多上下文信息以减少不恰当的缓存命中
  const context = request.context || "";
  const specialContext = request.state?.specialEventsContext || "";
  
  // 添加时间戳组件，每15分钟更新一次场景缓存
  const timeComponent = Math.floor(Date.now() / (1000 * 60 * 15));
  
  return `${request.type}:${request.location}:${stateFingerprint}:${context}:${specialContext}:${timeComponent}`;
}

// 加载区域元数据（从文件系统）
async function loadRegionMetadata(regionId: string): Promise<RegionMetadata> {
  try {
    const metadataPath = `./config/metadata/regions/${regionId}.yaml`;
    const metadataText = await Deno.readTextFile(metadataPath);
    return YAML.parse(metadataText) as RegionMetadata;
  } catch (error) {
    // 抛出错误，以便调用函数可以尝试其他方法
    throw new Error(`未找到区域 ${regionId} 的元数据文件`);
  }
}

// 创建默认区域元数据（已被createEnhancedDefaultRegion替代，但保留给向后兼容）
function createDefaultRegion(regionId: string): RegionMetadata {
  console.log(`警告：使用了旧的createDefaultRegion函数，应该使用createEnhancedDefaultRegion`);
  return createEnhancedDefaultRegion(regionId);
}

// 格式化区域名称
function formatRegionName(regionId: string): string {
  return regionId
    .replace(/_/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// 加载NPC元数据
async function loadNPCMetadata(npcId: string): Promise<NPCMetadata> {
  try {
    // 首先从缓存中检查
    if (npcMetadataCache.has(npcId)) {
      return npcMetadataCache.get(npcId)!;
    }
    
    // 尝试从文件加载
    try {
      const metadataPath = `./config/metadata/npcs/${npcId}.yaml`;
      const metadataText = await Deno.readTextFile(metadataPath);
      const metadata = YAML.parse(metadataText) as NPCMetadata;
      npcMetadataCache.set(npcId, metadata);
      return metadata;
    } catch (fileError) {
      // 如果文件不存在，使用AI生成
      console.log(`为NPC ${npcId} 动态生成元数据`);
      const generatedNpc = await generateNPCMetadata(npcId);
      npcMetadataCache.set(npcId, generatedNpc);
      return generatedNpc;
    }
  } catch (error) {
    console.error(`生成NPC ${npcId} 的元数据时出错:`, error);
    return createGenericNPC(npcId);
  }
}

// NPC元数据缓存
const npcMetadataCache = new Map<string, NPCMetadata>();

// 使用AI生成NPC元数据
async function generateNPCMetadata(npcId: string): Promise<NPCMetadata> {
  // 创建NPC生成的提示词
  const prompt = `
${FANTASY_WORLD_SYSTEM}

请为奇幻世界中名为"${npcId}"的NPC生成详细的元数据。

以JSON格式返回一个包含以下字段的NPC描述:
{
  "id": "${npcId}",
  "name": "${npcId}",
  "race": "NPC的种族",
  "profession": "NPC的职业或社会角色",
  "personality": "NPC的性格描述",
  "goals": ["目标1", "目标2", "目标3"],
  "knowledge": ["了解的信息1", "了解的信息2", "了解的信息3"],
  "attitude": "对玩家的初始态度",
  "possessions": ["随身物品1", "随身物品2", "随身物品3"],
  "description": "NPC的详细外观和行为描述"
}

创建一个有深度、有个性的NPC，具有明确的动机和背景故事。
`;

  try {
    // 调用AI生成内容
    const response = await askAI(prompt, {
      temperature: 0.7,
      maxTokens: 800
    });
    
    // 尝试解析返回的JSON
    try {
      const jsonStart = response.indexOf('{');
      const jsonEnd = response.lastIndexOf('}') + 1;
      
      if (jsonStart >= 0 && jsonEnd > jsonStart) {
        const jsonStr = response.substring(jsonStart, jsonEnd);
        const metadata = JSON.parse(jsonStr) as NPCMetadata;
        
        // 确保所有必要字段都存在
        return {
          id: metadata.id || npcId,
          name: metadata.name || formatName(npcId),
          race: metadata.race || "人类",
          profession: metadata.profession || "平民",
          personality: metadata.personality || "谨慎但友善",
          goals: metadata.goals || ["生存", "繁荣"],
          knowledge: metadata.knowledge || ["当地信息"],
          attitude: metadata.attitude || "中立",
          possessions: metadata.possessions || ["日常用品"],
          description: metadata.description || `一位名为${npcId}的当地居民`
        };
      }
    } catch (parseError) {
      console.error("解析AI生成的NPC元数据失败:", parseError);
    }
  } catch (error) {
    console.error("生成NPC元数据时出错:", error);
  }
  
  // 如果失败，返回通用NPC
  return createGenericNPC(npcId);
}

// 格式化名称工具函数
function formatName(nameId: string): string {
  return nameId
    .replace(/_/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// 加载随机事件类型
async function loadRandomEventType(): Promise<EventTypeMetadata> {
  try {
    const eventsDir = "./config/metadata/events/";
    const files = [];
    
    for await (const entry of Deno.readDir(eventsDir)) {
      if (entry.isFile && entry.name.endsWith(".yaml")) {
        files.push(entry.name);
      }
    }
    
    if (files.length === 0) throw new Error("No event files found");
    
    const randomFile = files[Math.floor(Math.random() * files.length)];
    const eventText = await Deno.readTextFile(`${eventsDir}${randomFile}`);
    return YAML.parse(eventText) as EventTypeMetadata;
  } catch (error) {
    console.log("加载随机事件类型失败", error);
    throw error;
  }
}

// 创建通用NPC
function createGenericNPC(name: string): NPCMetadata {
  // 将ID格式化为名称
  const formattedName = name
    .replace(/_/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
  
  return {
    id: name,
    name: formattedName,
    race: "未知",
    profession: "未知",
    personality: "神秘",
    goals: ["未知目标"],
    knowledge: ["当地信息"],
    attitude: "中立",
    possessions: [],
    description: `一个神秘的角色，你对他几乎一无所知。`
  };
}

// 初始化缓存系统
initCache().catch(err => {
  console.error("初始化缓存系统失败:", err);
}); 