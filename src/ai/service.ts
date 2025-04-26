import { AIProvider, AIRequest, AIResponse, AIServiceConfig } from "./types.ts";
import { getAIServiceConfig, hasAvailableService, getPreferredService, detectEndpointType } from "./config.ts";

// AI服务管理器类
export class AIService {
  private config: AIServiceConfig;
  private provider: AIProvider;

  constructor(provider?: AIProvider) {
    // 如果没有指定服务提供商，使用首选服务
    if (!provider) {
      const preferredService = getPreferredService();
      if (!preferredService) {
        throw new Error("没有可用的AI服务，请配置API密钥");
      }
      provider = preferredService;
    }
    
    this.provider = provider;
    this.config = getAIServiceConfig(provider);
  }
  
  // 发送请求到AI服务并获取响应
  async sendRequest(request: AIRequest): Promise<AIResponse> {
    // 确保有API密钥
    if (!this.config.apiKey) {
      throw new Error(`未配置${this.provider}的API密钥`);
    }
    
    // 根据不同服务提供商格式化请求
    switch (this.provider) {
      case AIProvider.GEMINI:
        return this.sendGeminiRequest(request);
      case AIProvider.XAI:
        return this.sendXAIRequest(request);
      default:
        throw new Error(`不支持的AI服务提供商: ${this.provider}`);
    }
  }
  
  // 发送请求到Gemini API
  private async sendGeminiRequest(request: AIRequest): Promise<AIResponse> {
    try {
      const model = request.model || this.config.defaultModel;
      const url = `${this.config.apiEndpoint}/${model}:generateContent?key=${this.config.apiKey}`;
      
      const requestBody = {
        contents: [
          {
            parts: [
              {
                text: request.prompt
              }
            ]
          }
        ],
        generationConfig: {
          temperature: request.temperature || this.config.temperature,
          maxOutputTokens: request.maxTokens || this.config.maxTokens,
        }
      };
      
      // 使用重试机制发送请求
      const response = await this.sendRequestWithRetry(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(this.config.timeout || 30000)
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini API返回错误 (${response.status}): ${errorText}`);
      }
      
      const data = await response.json();
      
      // 检查返回的是否为错误
      if (data.error) {
        throw new Error(`Gemini API返回错误: ${data.error.message || JSON.stringify(data.error)}`);
      }
      
      // 格式化响应
      return {
        text: data.candidates[0].content.parts[0].text,
        usage: {
          promptTokens: data.usageMetadata?.promptTokenCount,
          completionTokens: data.usageMetadata?.candidatesTokenCount,
          totalTokens: data.usageMetadata?.totalTokenCount,
        }
      };
    } catch (error) {
      console.error(`Gemini API请求失败:`, error);
      
      // 区分超时和其他错误
      if (error instanceof DOMException && error.name === "TimeoutError") {
        return {
          text: "",
          error: "请求超时，请稍后重试"
        };
      }
      
      return {
        text: "",
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
  
  // 发送请求到XAI API (支持多种兼容的API提供商)
  private async sendXAIRequest(request: AIRequest): Promise<AIResponse> {
    try {
      const model = request.model || this.config.defaultModel;
      const url = this.config.apiEndpoint as string;
      const endpointType = detectEndpointType(url);
      
      // 基础请求体 - 适用于大多数OpenAI兼容API
      const requestBody: Record<string, any> = {
        model: model,
        messages: [
          {
            role: "user",
            content: request.prompt
          }
        ],
        temperature: request.temperature || this.config.temperature,
        max_tokens: request.maxTokens || this.config.maxTokens,
      };
      
      // 根据不同API提供商调整请求
      if (endpointType === "grok") {
        // Grok可能需要的特殊调整
        requestBody.top_p = 1;
        requestBody.stream = false;
      } else if (endpointType === "groq") {
        // Groq可能需要的特殊调整
        requestBody.response_format = { type: "text" };
      }
      
      // 准备适当的授权头
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      
      // 大多数API使用Bearer认证
      headers.Authorization = `Bearer ${this.config.apiKey}`;
      
      // 使用重试机制发送请求
      const response = await this.sendRequestWithRetry(url, {
        method: "POST",
        headers,
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(this.config.timeout || 45000)
      });
      
      if (!response.ok) {
        const errorData = await response.text();
        let errorMessage = `API返回错误 (${response.status})`;
        
        try {
          // 尝试解析错误JSON
          const parsedError = JSON.parse(errorData);
          errorMessage += `: ${parsedError.error?.message || parsedError.message || errorData}`;
        } catch {
          errorMessage += `: ${errorData}`;
        }
        
        throw new Error(errorMessage);
      }
      
      const data = await response.json();
      
      // 检查返回数据格式，适应不同API可能的响应结构
      let responseText = "";
      let usage = {};
      
      if (data.choices && data.choices.length > 0) {
        if (data.choices[0].message) {
          responseText = data.choices[0].message.content;
        } else if (data.choices[0].text) {
          responseText = data.choices[0].text;
        }
      } else if (data.content) {
        responseText = data.content;
      }
      
      // 尝试提取使用统计信息
      if (data.usage) {
        usage = {
          promptTokens: data.usage.prompt_tokens,
          completionTokens: data.usage.completion_tokens,
          totalTokens: data.usage.total_tokens,
        };
      }
      
      // 格式化响应
      return {
        text: responseText,
        usage
      };
    } catch (error) {
      console.error(`XAI API请求失败:`, error);
      
      // 区分超时和其他错误
      if (error instanceof DOMException && error.name === "TimeoutError") {
        return {
          text: "",
          error: "请求超时，请稍后重试"
        };
      }
      
      return {
        text: "",
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
  
  // 通用请求发送方法，带重试机制
  private async sendRequestWithRetry(
    url: string,
    options: RequestInit,
    retries = 3,
    backoff = 1000
  ): Promise<Response> {
    // 检查代理环境变量
    const httpProxy = Deno.env.get("HTTP_PROXY");
    const httpsProxy = Deno.env.get("HTTPS_PROXY");
    const noProxy = Deno.env.get("NO_PROXY");
    
    // 输出代理配置信息（仅在第一次尝试时）
    if (retries === 3) {
      if (httpProxy || httpsProxy) {
        console.log(`使用系统代理: HTTP_PROXY=${httpProxy || '未设置'}, HTTPS_PROXY=${httpsProxy || '未设置'}, NO_PROXY=${noProxy || '未设置'}`);
      } else {
        console.log('未检测到系统代理环境变量(HTTP_PROXY/HTTPS_PROXY)，API请求可能无法通过防火墙');
      }
    }
    
    try {
      // 使用系统代理发送请求
      const response = await fetch(url, options);
      
      // 检查限流错误
      if (response.status === 429) {
        console.log(`请求被限流，状态码: ${response.status}`);
        
        // 尝试从响应中获取重试时间
        let retryAfter = 1;
        const retryHeader = response.headers.get("Retry-After");
        
        if (retryHeader) {
          retryAfter = parseInt(retryHeader, 10) || 1;
        }
        
        if (retries > 0) {
          console.log(`请求被限流，等待${retryAfter * 1000}ms后重试. 剩余重试次数: ${retries}`);
          await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
          return this.sendRequestWithRetry(url, options, retries - 1, backoff * 2);
        }
      }
      
      return response;
    } catch (error) {
      // 处理网络错误
      if (error instanceof TypeError && error.message.includes('fetch failed') && retries > 0) {
        console.log(`网络错误，等待${backoff}ms后重试. 剩余重试次数: ${retries}. 错误: ${error.message}`);
        
        // 如果是网络连接问题且没有设置代理，提示用户
        if (error.message.includes('tcp connect error') && !httpProxy && !httpsProxy && retries === 3) {
          console.log('提示: 您可能需要设置HTTP_PROXY或HTTPS_PROXY环境变量来使用系统代理访问API');
        }
        
        await new Promise(resolve => setTimeout(resolve, backoff));
        return this.sendRequestWithRetry(url, options, retries - 1, backoff * 2);
      }
      throw error;
    }
  }
}

// 创建默认AI服务实例
let defaultService: AIService | null = null;

// 获取默认AI服务实例
export function getDefaultAIService(): AIService {
  if (!defaultService) {
    if (!hasAvailableService()) {
      throw new Error("没有可用的AI服务，请配置API密钥");
    }
    defaultService = new AIService();
  }
  return defaultService;
}

// 创建指定服务商的AI服务实例
export function createAIService(provider: AIProvider): AIService {
  return new AIService(provider);
}

// 简化的AI请求函数
export async function askAI(prompt: string, options: Partial<AIRequest> = {}): Promise<string> {
  try {
    // 检查是否有可用的AI服务
    if (!hasAvailableService()) {
      console.error("没有可用的AI服务");
      return generateFallbackResponse();
    }

    const service = getDefaultAIService();
    const response = await service.sendRequest({
      prompt,
      ...options
    });
    
    if (response.error) {
      console.error(`AI请求出错: ${response.error}`);
      // 如果是网络错误，提供更具体的错误信息
      if (response.error.includes("fetch failed") || response.error.includes("tcp connect error")) {
        console.error("网络连接失败，请检查网络设置或代理配置");
      } else if (response.error.includes("timeout")) {
        console.error("请求超时，可能是服务器负载过高或网络延迟大");
      }
      return generateFallbackResponse();
    }
    
    return response.text;
  } catch (error) {
    console.error(`调用AI服务出错:`, error);
    return generateFallbackResponse();
  }
}

// 生成回退响应
function generateFallbackResponse(): string {
  return JSON.stringify({
    title: "生成的场景",
    description: "在这个神秘的地方，你感受到了无限的可能。周围的景象若隐若现，等待着你去探索。",
    choices: [
      {
        id: "choice_continue",
        text: "继续探索"
      }
    ],
    image_suggestion: "default.jpg"
  });
} 