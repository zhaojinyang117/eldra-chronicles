import { ContentGenerationResponse, GeneratedChoice } from "./types.ts";

// 解析AI生成的JSON响应
export function parseAIResponse(responseText: string): ContentGenerationResponse {
  console.log(`AI响应已获取，长度: ${responseText.length}字符`);
  
  // 预先检查响应是否过短或明显不完整
  if (responseText.length < 20) {
    console.log("AI响应过短，使用默认结构");
    return {
      title: "探索场景",
      content: "你向前走去，周围的环境需要进一步探索。",
      choices: [{ text: "继续探索", effects: {} }],
      meta: {
        note: "AI响应过短，使用了默认内容"
      }
    };
  }
  
  try {
    // 尝试直接解析JSON
    const jsonData = JSON.parse(responseText);
    return formatResponseData(jsonData);
  } catch (e) {
    console.log("直接JSON解析失败，尝试提取JSON...");
    
    // 如果直接解析失败，尝试从文本中提取JSON
    try {
      // 查找可能的JSON开始和结束位置
      const jsonStartIndex = responseText.indexOf('{');
      const jsonEndIndex = responseText.lastIndexOf('}') + 1;
      
      // 检查是否找到了看起来像JSON的内容
      if (jsonStartIndex >= 0 && jsonEndIndex > jsonStartIndex) {
        const jsonString = responseText.substring(jsonStartIndex, jsonEndIndex);
        try {
          const jsonData = JSON.parse(jsonString);
          return formatResponseData(jsonData);
        } catch (jsonError) {
          console.log("提取的JSON无效，尝试修复...");
          
          // 尝试修复常见的JSON错误
          const fixedJson = fixBrokenJson(jsonString);
          if (fixedJson) {
            return formatResponseData(fixedJson);
          }
        }
      } else {
        console.log("未找到有效的JSON结构");
      }
      
      // 检查特殊格式（不同AI提供商可能有不同格式）
      const specialFormats = checkSpecialFormats(responseText);
      if (specialFormats) {
        return specialFormats;
      }
      
      console.log("无法提取有效JSON，使用文本回退解析");
      // 如果仍然无法解析，使用文本回退方法
      return fallbackTextParsing(responseText);
    } catch (innerError) {
      console.error("解析AI响应出错:", innerError);
      // 使用文本回退方法
      return fallbackTextParsing(responseText);
    }
  }
}

// 尝试修复损坏的JSON
function fixBrokenJson(jsonString: string): any {
  try {
    // 记录原始字符串长度以进行诊断
    console.log(`尝试修复JSON，原始长度: ${jsonString.length}`);
    
    // 处理极短响应
    if (jsonString.length < 20) {
      console.log("JSON响应过短，返回默认结构");
      return {
        title: "探索场景",
        description: "周围的环境模糊不清，需要进一步探索。",
        choices: [{ text: "继续探索" }]
      };
    }
    
    // 检查JSON结构完整性
    const openBraces = (jsonString.match(/{/g) || []).length;
    const closeBraces = (jsonString.match(/}/g) || []).length;
    
    // 如果大括号不平衡，尝试补全
    if (openBraces > closeBraces) {
      const missingBraces = openBraces - closeBraces;
      jsonString = jsonString + "}".repeat(missingBraces);
      console.log(`添加了 ${missingBraces} 个缺失的结束大括号`);
    }
    
    // 修复常见问题：缺少引号的键
    let fixed = jsonString.replace(/(\w+):/g, '"$1":');
    
    // 修复单引号替换为双引号（但避免改变已经正确的双引号中的内容）
    fixed = fixed.replace(/'/g, '"');
    
    // 修复可能的末尾多余逗号
    fixed = fixed.replace(/,\s*}/g, '}').replace(/,\s*\]/g, ']');
    
    // 修复末尾不完整的引号和属性
    const truncatedPropertyMatch = fixed.match(/"([^"]+)":\s*"([^"]*)$/);
    if (truncatedPropertyMatch) {
      fixed = fixed + '"';
      console.log("修复了末尾未闭合的字符串");
    }
    
    // 修复未闭合的属性值
    const unclosedPropertyRegex = /"([^"]+)":\s*$/;
    const unclosedProperty = fixed.match(unclosedPropertyRegex);
    if (unclosedProperty) {
      fixed = fixed + '""';
      console.log("修复了未闭合的属性值");
    }
    
    // 修复content/description中可能包含的转义问题
    const contentKeys = ["content", "description", "text", "narrative"];
    for (const key of contentKeys) {
      const contentRegex = new RegExp(`"${key}":\\s*"([^"]*?[^\\\\])"(,?)\\s*"`, 'g');
      fixed = fixed.replace(contentRegex, (match, content, comma) => {
        return `"${key}":"${content.replace(/"/g, '\\"')}"${comma} "`;
      });
    }

    // 如果仍然无法解析，尝试提取有意义的部分
    try {
      return JSON.parse(fixed);
    } catch (e) {
      console.log("第一次修复尝试失败，尝试进一步修复...");
      
      // 尝试从开头找到一个有效的JSON对象
      let validObject = "{";
      let depth = 1;
      let inString = false;
      let escaped = false;
      
      for (let i = 1; i < fixed.length; i++) {
        const char = fixed[i];
        validObject += char;
        
        if (escaped) {
          escaped = false;
          continue;
        }
        
        if (char === '\\' && inString) {
          escaped = true;
          continue;
        }
        
        if (char === '"' && !escaped) {
          inString = !inString;
          continue;
        }
        
        if (!inString) {
          if (char === '{') depth++;
          if (char === '}') {
            depth--;
            if (depth === 0) break;
          }
        }
      }
      
      // 确保JSON结构完整
      if (depth !== 0) {
        validObject += "}".repeat(depth);
      }
      
      // 再次尝试解析
      try {
        const result = JSON.parse(validObject);
        console.log("通过构建有效对象成功修复JSON");
        return result;
      } catch (innerError) {
        // 如果所有修复尝试都失败，返回一个默认结构
        console.log("所有修复尝试都失败，返回默认结构");
        return {
          title: "探索继续",
          description: "你继续前进，周围的环境逐渐变得清晰。",
          choices: [{ text: "继续探索" }]
        };
      }
    }
  } catch (e) {
    console.log("修复JSON失败:", e);
    return {
      title: "冒险场景",
      description: "你站在未知的道路上，前方等待着探索。",
      choices: [{ text: "继续前进" }]
    };
  }
}

// 检查特殊格式的响应
function checkSpecialFormats(text: string): ContentGenerationResponse | null {
  // 检查是否包含grok特定格式
  if (text.includes('grok_response') || text.includes('```json')) {
    try {
      // 提取代码块中的JSON
      const codeBlockMatch = text.match(/```(?:json)?\s*\n([\s\S]*?)```/);
      if (codeBlockMatch && codeBlockMatch[1]) {
        const jsonData = JSON.parse(codeBlockMatch[1].trim());
        return formatResponseData(jsonData);
      }
      
      // 尝试其他可能的格式
      const grokMatch = text.match(/grok_response\s*:\s*({[\s\S]*})/);
      if (grokMatch && grokMatch[1]) {
        const jsonData = JSON.parse(grokMatch[1].trim());
        return formatResponseData(jsonData);
      }
    } catch (error) {
      console.log("特殊格式提取失败:", error);
    }
  }
  
  // 检查是否是键值对格式（如title: xxx, text: xxx）
  try {
    // 检测是否存在键值对格式
    if (text.match(/(?:title|text|description|content)[：:]\s*.*?(?:\n|$)/i)) {
      console.log("检测到键值对格式，尝试解析");
      const extractedData: Record<string, any> = {};
      
      // 提取标题
      const titleMatch = text.match(/(?:title|标题)[：:]\s*(.*?)(?:\n|$)/i);
      if (titleMatch) extractedData.title = titleMatch[1].trim();
      
      // 提取描述/内容
      const contentMatch = text.match(/(?:text|description|content|描述|内容)[：:]\s*(.*?)(?:\n|(?:choices|选择|选项)[：:]|$)/is);
      if (contentMatch) extractedData.description = contentMatch[1].trim();
      
      // 提取选择项
      const choices: Array<{text: string}> = [];
      const choiceLines = text.match(/(?:choices|选择|选项)[：:]\s*([\s\S]*?)(?:$|(?:meta|元数据)[：:])/i);
      
      if (choiceLines && choiceLines[1]) {
        // 处理选择行
        const choiceTexts = choiceLines[1].split('\n').filter(line => line.trim());
        choiceTexts.forEach(line => {
          // 移除行号、破折号等前缀
          const cleanChoice = line.replace(/^\s*(?:\d+[\.、]|-|\*)\s*/, '').trim();
          if (cleanChoice) {
            choices.push({ text: cleanChoice });
          }
        });
      }
      
      // 从引号格式提取选择项，如 "text": "xxx"
      const quotedChoices = text.match(/"text"\s*[：:]\s*"([^"]+)"/g);
      if (quotedChoices) {
        quotedChoices.forEach(choiceText => {
          const match = choiceText.match(/"text"\s*[：:]\s*"([^"]+)"/);
          if (match && match[1]) {
            choices.push({ text: match[1].trim() });
          }
        });
      }
      
      // 如果找不到选择项但有简单的文本片段，也尝试提取
      if (choices.length === 0) {
        const simpleChoices = text.match(/"([^"]{5,100})"/g);
        if (simpleChoices) {
          simpleChoices.forEach(choice => {
            // 只提取看起来像选择项的文本（例如，不太短的引号文本）
            const cleanChoice = choice.replace(/^"|"$/g, '').trim();
            if (cleanChoice.length > 5 && cleanChoice.length < 100 && 
                !extractedData.title?.includes(cleanChoice) && 
                !extractedData.description?.includes(cleanChoice)) {
              choices.push({ text: cleanChoice });
            }
          });
        }
      }
      
      // 确保至少有一个选择项
      if (choices.length === 0) {
        choices.push({ text: "继续探索" });
      }
      
      extractedData.choices = choices;
      
      // 如果成功提取了数据，则返回格式化的响应
      if (extractedData.title || extractedData.description) {
        console.log("成功从键值对格式提取数据");
        return formatResponseData(extractedData);
      }
    }
  } catch (error) {
    console.log("键值对格式提取失败:", error);
  }
  
  return null;
}

// 格式化返回的JSON数据，确保符合要求的格式
function formatResponseData(data: any): ContentGenerationResponse {
  // 创建基本响应内容
  const response: ContentGenerationResponse = {
    title: extractTitle(data),
    content: extractContent(data),
    choices: []
  };
  
  // 处理选择
  if (Array.isArray(data.choices)) {
    response.choices = data.choices.map((choice: any, index: number) => {
      const formattedChoice: GeneratedChoice = {
        text: choice.text || `选择 ${index + 1}`,
        effects: choice.effects || {}
      };
      
      return formattedChoice;
    });
  } else {
    // 默认选择
    response.choices = [
      { text: "继续探索", effects: {} }
    ];
  }
  
  // 处理元数据
  const meta: any = {};
  
  // 处理图像建议
  if (data.image_suggestion) {
    meta.image_suggestion = data.image_suggestion;
  } else if (data.image) {
    meta.image_suggestion = data.image;
  }
  
  if (data.location) meta.location = data.location;
  if (data.mood) meta.mood = data.mood;
  if (Array.isArray(data.npcs)) meta.npcs = data.npcs;
  if (Array.isArray(data.items)) meta.items = data.items;
  
  // 处理效果
  if (data.effect) {
    meta.effect = data.effect;
  } else if (data.effects) {
    meta.effect = data.effects;
  }
  
  // 处理下一个场景建议
  if (data.next_scene_suggestion) {
    meta.next_scene_suggestion = data.next_scene_suggestion;
  } else if (data.next_scene) {
    meta.next_scene_suggestion = data.next_scene;
  }
  
  if (Object.keys(meta).length > 0) {
    response.meta = meta;
  }
  
  return response;
}

// 从多种可能的字段中提取标题
function extractTitle(data: any): string {
  return data.title || 
         data.heading || 
         data.name || 
         "未命名场景";
}

// 从多种可能的字段中提取内容
function extractContent(data: any): string {
  return data.description || 
         data.content || 
         data.text || 
         data.narrative || 
         data.story ||
         "没有可用的描述。";
}

// 文本回退解析方法，当JSON解析失败时使用
function fallbackTextParsing(text: string): ContentGenerationResponse {
  console.log("使用文本回退解析方法");
  
  // 提取标题 (支持中英文标题格式)
  let title = "生成的场景";
  // 增加对英文标题格式的支持
  const titleMatch = text.match(/(?:标题[：:]\s*|^#\s*|^题目[：:]\s*|^场景[：:]\s*|title[：:]\s*|^"title"\s*[：:]\s*)([^"\n]+)(?:\n|$|")/i);
  if (titleMatch) {
    title = titleMatch[1].trim();
  } else {
    // 检查是否有引号包围的标题
    const quotedTitleMatch = text.match(/"([^"]+)"/);
    if (quotedTitleMatch && quotedTitleMatch.index && quotedTitleMatch.index < 50) {
      // 只采用文本开头附近的引号内容作为可能的标题
      title = quotedTitleMatch[1].trim();
    }
  }
  
  // 截取正文部分 (假设选择前的所有文本是描述)
  let description = text;
  
  // 增加对文本中包含JSON键的处理
  const jsonKeyIndex = text.search(/"(?:description|content|text|narrative|story)"[\s:]*"?/i);
  if (jsonKeyIndex > 0) {
    // 找到可能的JSON内容值开始位置
    const contentStart = text.indexOf('"', jsonKeyIndex + 10) + 1;
    if (contentStart > 0) {
      // 找到内容的结束引号
      let contentEnd = -1;
      for (let i = contentStart; i < text.length; i++) {
        if (text[i] === '"' && text[i-1] !== '\\') {
          contentEnd = i;
          break;
        }
      }
      
      if (contentEnd > contentStart) {
        description = text.substring(contentStart, contentEnd);
      }
    }
  }
  
  const choicesIndex = Math.max(
    text.search(/(?:选择|选项|choices)[：:]/i),
    text.search(/(?:你可以|你能够|你可|你应该)[：:]/i),
    text.search(/(?:\d+[\.、])/i),
    text.search(/(?:options|actions)[：:]/i)  // 增加英文选项标识
  );
  
  if (choicesIndex > 0 && description.length > choicesIndex) {
    description = text.substring(0, choicesIndex).trim();
  }
  
  // 处理截断的内容
  if (text.length > 100 && !description.endsWith('.') && !description.endsWith('。')) {
    description += "...";  // 为截断的文本添加省略号
  }
  
  // 提取选择 (使用多种可能的格式查找选择项)
  const choices: GeneratedChoice[] = [];
  
  // 扩展支持的选择格式
  const patterns = [
    /(\d+)[\.、]?\s*([^\n]+)/g,
    /选择\s*(\d+)[：:]\s*([^\n]+)/g,
    /([A-D])[\s\.、]+(.*?)(?=\n|$|\s+[A-D][\s\.、]+)/g,
    /选项\s*(\d+|[A-D])[：:]\s*([^\n]+)/g,
    /"text"\s*[：:]\s*"([^"]+)"/g,     // 支持JSON格式的选择文本
    /Option\s*(\d+)[：:]\s*([^\n]+)/gi, // 支持英文选项格式
    /Choice\s*(\d+)[：:]\s*([^\n]+)/gi  // 支持英文选择格式
  ];
  
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      // 检查是否已经有相同文本的选择
      const choiceText = match[2] ? match[2].trim() : match[1].trim();
      if (!choices.some(c => c.text === choiceText)) {
        choices.push({
          text: choiceText,
          effects: {}
        });
      }
    }
    
    // 如果找到了选择，就不再使用其他模式
    if (choices.length > 0) break;
  }
  
  // 添加一些常见的选择项检测，特别是对于截断的内容
  const commonChoices = ["继续探索", "离开", "调查", "前进", "交谈", "战斗", 
                         "Explore", "Leave", "Investigate", "Proceed", "Talk", "Fight"];
  
  for (const choice of commonChoices) {
    if (text.includes(choice) && !choices.some(c => c.text.includes(choice))) {
      const choiceIndex = text.indexOf(choice);
      // 仅当该选项看起来是一个选择项时才添加
      if (choiceIndex > 0 && 
          (text[choiceIndex-1] === '"' || text[choiceIndex-1] === ':' || 
           text[choiceIndex-1] === '：' || /\d/.test(text[choiceIndex-1]))) {
        choices.push({
          text: choice,
          effects: {}
        });
      }
    }
  }
  
  // 如果没有找到选择，添加一个默认选择
  if (choices.length === 0) {
    choices.push({
      text: "继续探索",
      effects: {}
    });
  }
  
  // 限制选择数量到最多4个
  const limitedChoices = choices.slice(0, 4);
  
  return {
    title,
    content: description,
    choices: limitedChoices,
    meta: {
      suggestions: ["根据当前情境继续探索"],
      note: "通过文本解析生成的内容，可能不完全准确",
      is_fallback: true // 标记这是一个回退解析结果
    }
  };
}

// 验证AI响应是否有效
export function validateAIResponse(response: ContentGenerationResponse): boolean {
  // 检查必要字段
  if (!response.title) return false;
  if (!response.content) return false;
  if (!Array.isArray(response.choices) || response.choices.length === 0) return false;
  
  // 检查选择
  for (const choice of response.choices) {
    if (!choice.text) return false;
  }
  
  return true;
} 

// 从AI响应中提取效果
export function extractEffectsFromResponse(response: ContentGenerationResponse): {
  health_change?: number;
  gold_change?: number;
  add_items?: string[];
  remove_items?: string[];
  attribute_changes?: Record<string, number>;
  relationship_changes?: Record<string, number>;
  special_event?: string;
} | null {
  if (!response || !response.meta) {
    return null;
  }
  
  const effects: {
    health_change?: number;
    gold_change?: number;
    add_items?: string[];
    remove_items?: string[];
    attribute_changes?: Record<string, number>;
    relationship_changes?: Record<string, number>;
    special_event?: string;
  } = {};
  
  // 从meta或选择中提取效果
  // 首先检查meta.effect
  if (response.meta.effect) {
    const effect = response.meta.effect;
    
    // 健康值变化
    if (typeof effect.health_change === 'number') {
      effects.health_change = effect.health_change;
    }
    
    // 金币变化
    if (typeof effect.gold_change === 'number') {
      effects.gold_change = effect.gold_change;
    }
    
    // 物品添加
    if (Array.isArray(effect.add_items)) {
      effects.add_items = effect.add_items;
    }
    
    // 物品移除
    if (Array.isArray(effect.remove_items)) {
      effects.remove_items = effect.remove_items;
    }
    
    // 属性变化
    if (effect.attribute_changes && typeof effect.attribute_changes === 'object') {
      effects.attribute_changes = effect.attribute_changes;
    }
    
    // 关系变化
    if (effect.relationship_changes && typeof effect.relationship_changes === 'object') {
      effects.relationship_changes = effect.relationship_changes;
    }
    
    // 特殊事件
    if (effect.special_event && typeof effect.special_event === 'string') {
      effects.special_event = effect.special_event;
    }
  }
  
  // 如果某些效果字段直接在meta中
  if (typeof response.meta.health_change === 'number') {
    effects.health_change = response.meta.health_change;
  }
  
  if (typeof response.meta.gold_change === 'number') {
    effects.gold_change = response.meta.gold_change;
  }
  
  if (Array.isArray(response.meta.add_items)) {
    effects.add_items = response.meta.add_items;
  }
  
  if (Array.isArray(response.meta.remove_items)) {
    effects.remove_items = response.meta.remove_items;
  }
  
  if (response.meta.attribute_changes && typeof response.meta.attribute_changes === 'object') {
    effects.attribute_changes = response.meta.attribute_changes;
  }
  
  // 如果关系变化直接在meta中
  if (response.meta.relationship_changes && typeof response.meta.relationship_changes === 'object') {
    effects.relationship_changes = response.meta.relationship_changes;
  }
  
  // 如果特殊事件直接在meta中
  if (response.meta.special_event && typeof response.meta.special_event === 'string') {
    effects.special_event = response.meta.special_event;
  }
  
  // 检查是否有任何效果被提取
  const hasEffects = Object.keys(effects).length > 0;
  return hasEffects ? effects : null;
}