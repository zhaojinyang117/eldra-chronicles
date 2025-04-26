/**
 * AI内容生成系统类型定义
 */

// AI服务提供商类型
export enum AIProvider {
  GEMINI = "gemini",
  XAI = "xai"
}

// 内容类型枚举
export enum ContentType {
  SCENE = "scene",        // 场景描述
  DIALOGUE = "dialogue",  // NPC对话
  EVENT = "event",        // 随机事件
  COMBAT = "combat"       // 战斗场景
}

// AI服务配置接口
export interface AIServiceConfig {
  provider: AIProvider;
  apiKey?: string;
  apiEndpoint?: string;
  defaultModel?: string;
  maxTokens?: number;
  temperature?: number;
  timeout?: number;
}

// AI请求接口
export interface AIRequest {
  prompt: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

// AI响应接口
export interface AIResponse {
  text: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
  error?: string;
}

// 节点内容接口
export interface GameNodeContent {
  title: string;
  text: string;
  image?: string;
  choices: NodeChoice[];
}

// 节点选择接口
export interface NodeChoice {
  id: string;
  text: string;
  target?: string; // 不再直接指向预定义节点，而是描述下一步情境
  condition?: string;
  effects?: Record<string, any>;
}

// 世界区域元数据接口
export interface RegionMetadata {
  // 区域唯一标识符
  id: string;
  
  // 区域名称
  name: string;
  
  // 区域描述
  description: string;
  
  // 区域气候
  climate?: string;
  
  // 区域危险度
  danger_level?: number;
  
  // 区域特点
  features?: string[];
  
  // 可能出现的NPC类型
  npcs?: string[];
  
  // 可能出现的事件类型
  possible_events?: string[];
  
  // 连接的区域
  connected_regions?: string[];
  
  // 区域图片
  image?: string;
  
  // 区域氛围
  mood?: string;
  
  // 区域危险
  dangers?: string[];
  
  // 区域机遇
  opportunities?: string[];
  
  // 区域兴趣点
  points_of_interest?: string[];
  
  // 区域事件
  ambient_events?: string[];
}

// NPC元数据接口
export interface NPCMetadata {
  // NPC唯一标识符
  id: string;
  
  // NPC名称
  name: string;
  
  // NPC种族
  race: string;
  
  // NPC职业
  profession: string;
  
  // NPC性格
  personality: string;
  
  // NPC目标
  goals: string[];
  
  // NPC知识/信息
  knowledge: string[];
  
  // 对玩家的态度
  attitude: string;
  
  // 拥有的物品
  possessions: string[];
  
  // NPC描述（可选）
  description?: string;
  
  // NPC图片（可选）
  image?: string;
}

// 事件类型元数据接口
export interface EventTypeMetadata {
  // 事件类型唯一标识符
  id: string;
  
  // 事件类型名称
  name: string;
  
  // 事件描述
  description: string;
  
  // 事件类别
  category: string;
  
  // 事件频率权重
  weight?: number;
  
  // 事件可能的结果
  outcomes?: string[];
  
  // 事件要求的最低属性
  required_attributes?: Partial<Attributes>;
  
  // 可能获得的物品
  possible_items?: string[];
}

// 内容生成请求接口
export interface ContentGenerationRequest {
  // 生成内容的类型
  type: ContentType;
  
  // 位置标识符（场景ID、NPC ID等）
  location: string;
  
  // 可选上下文信息
  context?: string;
  
  // 玩家当前游戏状态
  state?: any;
  
  // 节点ID，用于追踪内容生成
  nodeId?: string;
}

// 内容效果接口
export interface ContentEffect {
  health_change?: number;
  gold_change?: number;
  add_items?: string[];
  remove_items?: string[];
  attribute_changes?: Record<string, number>;
  relationship_changes?: Record<string, number>;
  special_event?: string;
}

// 生成的选项接口
export interface GeneratedChoice {
  // 选项文本
  text: string;
  
  // 选择该选项的效果/状态改变
  effects: Record<string, any>;
  
  // 选项的额外元数据
  meta?: Record<string, any>;
}

// 内容生成响应接口
export interface ContentGenerationResponse {
  // 内容标题
  title: string;
  
  // 主要内容文本
  content: string;
  
  // 可选的选项列表
  choices: GeneratedChoice[];
  
  // 额外元数据（图片建议、情绪、位置等）
  meta?: {
    image_suggestion?: string;
    location?: string;
    mood?: string;
    npcs?: string[];
    items?: string[];
    [key: string]: any;
  };
}

// 角色信息接口
export interface Character {
  name: string;
  race: string;
  class: string;
  backstory?: string;
}

// 玩家属性接口
export interface Attributes {
  strength: number;
  intelligence: number;
  charisma: number;
  luck: number;
  [key: string]: number;
}

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

// 玩家状态接口
export interface PlayerState {
  // 角色基本信息
  character: Character;
  
  // 角色属性
  attributes: Attributes;
  
  // 物品栏
  inventory: string[];
  
  // 金币
  gold: number;
  
  // 生命值
  health: number;
  
  // 历史记录
  history: string[];
  
  // 当前状态描述
  current: string;
  
  // 特殊状态
  specialStatus?: SpecialStatus;
  
  // 特殊状态持续时间
  statusDuration?: number;
  
  // 声望（可选）
  reputation?: Record<string, number>;
  
  // 关系（可选）
  relationships?: Record<string, number>;
  
  // 任务（可选）
  quests?: Record<string, any>;
  
  // 技能（可选）
  skills?: Record<string, number>;
  
  // 已获得的知识（可选）
  knowledge?: string[];
}