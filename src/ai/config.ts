import { AIProvider, AIServiceConfig } from "./types.ts";

// 默认配置
const defaultConfig: Record<AIProvider, AIServiceConfig> = {
  [AIProvider.GEMINI]: {
    provider: AIProvider.GEMINI,
    apiEndpoint: "https://generativelanguage.googleapis.com/v1beta/models",
    defaultModel: "gemini-pro",
    maxTokens: 1024,
    temperature: 0.7,
    timeout: 30000, // 30秒
  },
  [AIProvider.XAI]: {
    provider: AIProvider.XAI,
    // 支持多种可能的API服务端点
    apiEndpoint: getXAIEndpoint(),
    defaultModel: getXAIModel(),
    maxTokens: 1024,
    temperature: 0.7,
    timeout: 45000, // 增加到45秒，防止复杂生成超时
  },
};

// 获取XAI服务端点，优先使用环境变量
function getXAIEndpoint(): string {
  return Deno.env.get("XAI_API_ENDPOINT") || 
         "https://api.x.ai/v1/chat/completions";
}

// 获取XAI默认模型，优先使用环境变量
function getXAIModel(): string {
  return Deno.env.get("XAI_API_MODEL") || 
         "grok-3-beta";
}

// 用户设置的API密钥，优先级高于环境变量
const customApiKeys: Record<AIProvider, string | undefined> = {
  [AIProvider.GEMINI]: undefined,
  [AIProvider.XAI]: undefined,
};

// 从环境变量或配置文件加载API密钥
function loadApiKeys(): Record<AIProvider, string | undefined> {
  return {
    [AIProvider.GEMINI]: customApiKeys[AIProvider.GEMINI] || Deno.env.get("GEMINI_API_KEY"),
    [AIProvider.XAI]: customApiKeys[AIProvider.XAI] || Deno.env.get("XAI_API_KEY"),
  };
}

// 合并API密钥到配置
export function getAIServiceConfig(provider: AIProvider): AIServiceConfig {
  const apiKeys = loadApiKeys();
  const config = { ...defaultConfig[provider] };
  
  // 设置API密钥
  config.apiKey = apiKeys[provider];
  
  return config;
}

// 判断服务是否可用（配置了API密钥）
export function isServiceAvailable(provider: AIProvider): boolean {
  const apiKeys = loadApiKeys();
  return Boolean(apiKeys[provider]);
}

// 获取所有可用的AI服务
export function getAvailableServices(): AIProvider[] {
  return Object.values(AIProvider).filter(isServiceAvailable);
}

// 获取首选AI服务（如果有多个可用，优先使用顺序为XAI > Gemini）
export function getPreferredService(): AIProvider | undefined {
  const availableServices = getAvailableServices();
  
  if (availableServices.includes(AIProvider.XAI)) {
    return AIProvider.XAI;
  }
  
  if (availableServices.includes(AIProvider.GEMINI)) {
    return AIProvider.GEMINI;
  }
  
  return undefined;
}

// 检查是否至少有一个AI服务可用
export function hasAvailableService(): boolean {
  return getAvailableServices().length > 0;
}

// 设置自定义API密钥
export function setApiKey(provider: AIProvider, apiKey: string): void {
  customApiKeys[provider] = apiKey;
  console.log(`已设置${provider}的API密钥`);
}

// 自定义API端点配置
export function setCustomEndpoint(provider: AIProvider, endpoint: string): void {
  defaultConfig[provider].apiEndpoint = endpoint;
  console.log(`已设置${provider}的API端点为: ${endpoint}`);
}

// 自定义模型配置
export function setCustomModel(provider: AIProvider, model: string): void {
  defaultConfig[provider].defaultModel = model;
  console.log(`已设置${provider}的默认模型为: ${model}`);
}

// 配置生成参数
export function setGenerationParams(provider: AIProvider, temperature?: number, maxTokens?: number): void {
  if (temperature !== undefined) {
    defaultConfig[provider].temperature = temperature;
  }
  
  if (maxTokens !== undefined) {
    defaultConfig[provider].maxTokens = maxTokens;
  }
  
  console.log(`已更新${provider}的生成参数: 温度=${defaultConfig[provider].temperature}, 最大Token=${defaultConfig[provider].maxTokens}`);
}

// 检测API端点类型 (用于适配不同API特性)
export function detectEndpointType(endpoint: string): string {
  if (!endpoint) return "unknown";
  
  if (endpoint.includes("openai.com")) return "openai";
  if (endpoint.includes("groq.com")) return "groq";
  if (endpoint.includes("xai.com") || endpoint.includes("grok")) return "grok";
  if (endpoint.includes("generativelanguage.googleapis")) return "gemini";
  
  return "unknown";
} 