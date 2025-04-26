import { useState } from "preact/hooks";
import { ContentType, ContentGenerationRequest, ContentGenerationResponse } from "./types.ts";
import { generateContent, generateChoiceResult } from "./generator.ts";
import { validateAIResponse } from "./parser.ts";

// AI内容生成钩子
export function useAIContentGeneration() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<ContentGenerationResponse | null>(null);

  // 生成AI内容
  async function generateAIContent(
    type: ContentType,
    location: string,
    context: Record<string, any>,
    retries = 2
  ): Promise<ContentGenerationResponse | null> {
    setLoading(true);
    setError(null);
    
    try {
      const request: ContentGenerationRequest = {
        type,
        location,
        state: context,
        context: JSON.stringify(context)
      };
      
      const result = await generateContent(request);
      
      // 验证结果
      if (!validateAIResponse(result)) {
        throw new Error("AI生成的内容格式无效");
      }
      
      setResponse(result);
      return result;
    } catch (e) {
      console.error("AI内容生成失败:", e);
      const errorMessage = e instanceof Error ? e.message : "未知错误";
      
      // 尝试重试
      if (retries > 0) {
        console.log(`重试AI生成 (剩余尝试: ${retries})...`);
        return generateAIContent(type, location, context, retries - 1);
      }
      
      setError(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  }
  
  // 生成选择结果
  async function generateAIChoiceResult(
    type: ContentType,
    choiceText: string,
    location: string,
    context: Record<string, any>,
    retries = 2
  ): Promise<ContentGenerationResponse | null> {
    setLoading(true);
    setError(null);
    
    try {
      const playerState = {
        character: context.character || { name: "冒险者", race: "人类", class: "冒险者" },
        attributes: context.attributes || {},
        inventory: context.inventory || [],
        gold: context.gold || 0,
        health: context.health || 100,
        history: context.history || [],
        current: context.current || ""
      };
      
      const result = await generateChoiceResult(
        playerState,
        location,
        context.choiceId || "unknown_choice",
        choiceText,
        context.previousNode || "unknown_node"
      );
      
      // 验证结果
      if (!validateAIResponse(result)) {
        throw new Error("AI生成的选择结果格式无效");
      }
      
      setResponse(result);
      return result;
    } catch (e) {
      console.error("AI选择结果生成失败:", e);
      const errorMessage = e instanceof Error ? e.message : "未知错误";
      
      // 尝试重试
      if (retries > 0) {
        console.log(`重试AI选择结果生成 (剩余尝试: ${retries})...`);
        return generateAIChoiceResult(type, choiceText, location, context, retries - 1);
      }
      
      setError(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  }
  
  // 重置状态
  function reset() {
    setLoading(false);
    setError(null);
    setResponse(null);
  }
  
  return {
    loading,
    error,
    response,
    generateAIContent,
    generateAIChoiceResult,
    reset
  };
} 