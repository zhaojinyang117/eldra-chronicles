import { Router } from "https://deno.land/x/oak/mod.ts";
import { 
  loadNode, 
  loadWorld, 
  applyChoice, 
  initState, 
  createCharacter, 
  getAvailableAttributePoints,
  resetGame,
  GameState,
  GameNode
} from "./logic.ts";
import { hasAvailableService, getAvailableServices, setCustomEndpoint, setCustomModel, setGenerationParams, setApiKey } from "./ai/config.ts";
import { ContentGenerationRequest, ContentType } from "./ai/types.ts";
import { generateContent } from "./ai/generator.ts";
import { v4 as uuid } from "uuid";

const router = new Router();

// 获取世界配置
router.get("/api/world", async (ctx) => {
  try {
    const world = await loadWorld();
    ctx.response.body = { success: true, data: world };
  } catch (err: unknown) {
    console.error(`获取世界配置出错: ${err instanceof Error ? err.message : String(err)}`);
    ctx.response.status = 500;
    ctx.response.body = { success: false, message: err instanceof Error ? err.message : String(err) };
  }
});

// 获取节点内容
router.get("/api/node/:id", async (ctx) => {
  try {
    const nodeId = ctx.params.id;
    if (!nodeId) {
      throw new Error("节点ID不能为空");
    }
    
    const node = await loadNode(nodeId);
    ctx.response.body = { success: true, data: node };
  } catch (err: unknown) {
    console.error(`获取节点出错: ${err instanceof Error ? err.message : String(err)}`);
    ctx.response.status = 404;
    ctx.response.body = { success: false, message: err instanceof Error ? err.message : String(err) };
  }
});

// 处理选择
router.post("/api/choice", async (ctx) => {
  try {
    if (!ctx.request.hasBody) {
      throw new Error("请求体不能为空");
    }
    
    const body = await ctx.request.body.json();
    const { state, choiceId } = body;
    
    if (!state || !choiceId) {
      throw new Error("缺少必要参数");
    }
    
    // 应用选择，获取新状态和下一个节点
    const result = await applyChoice(state, choiceId);
    ctx.response.body = { success: true, data: result };
  } catch (err: unknown) {
    console.error(`处理选择出错: ${err instanceof Error ? err.message : String(err)}`);
    ctx.response.status = 400;
    ctx.response.body = { success: false, message: err instanceof Error ? err.message : String(err) };
  }
});

// 获取初始化游戏状态
router.get("/api/init", async (ctx) => {
  try {
    const state = await initState();
    ctx.response.body = { success: true, data: state };
  } catch (err: unknown) {
    console.error(`初始化状态出错: ${err instanceof Error ? err.message : String(err)}`);
    ctx.response.status = 500;
    ctx.response.body = { success: false, message: err instanceof Error ? err.message : String(err) };
  }
});

// 获取可用属性点数量
router.get("/api/attribute-points", async (ctx) => {
  try {
    const points = await getAvailableAttributePoints();
    ctx.response.body = { success: true, data: { points } };
  } catch (err: unknown) {
    console.error(`获取属性点出错: ${err instanceof Error ? err.message : String(err)}`);
    ctx.response.status = 500;
    ctx.response.body = { success: false, message: err instanceof Error ? err.message : String(err) };
  }
});

// 创建角色
router.post("/api/character", async (ctx) => {
  try {
    if (!ctx.request.hasBody) {
      throw new Error("请求体不能为空");
    }
    
    const body = await ctx.request.body.json();
    const { name, race, characterClass, backstory, attributePoints } = body;
    
    if (!name || !race || !characterClass) {
      throw new Error("缺少必要参数：角色名称、种族或职业");
    }
    
    // 创建角色并获取初始化的游戏状态
    const state = await createCharacter(
      name,
      race,
      characterClass,
      backstory,
      attributePoints
    );
    
    // 加载起始节点
    const startNode = await loadNode(state.current);
    
    ctx.response.body = { 
      success: true, 
      data: { 
        state,
        node: startNode
      } 
    };
  } catch (err: unknown) {
    console.error(`创建角色出错: ${err instanceof Error ? err.message : String(err)}`);
    ctx.response.status = 400;
    ctx.response.body = { 
      success: false, 
      message: err instanceof Error ? err.message : String(err)
    };
  }
});

// 重置游戏
router.post("/api/reset", async (ctx) => {
  try {
    if (!ctx.request.hasBody) {
      throw new Error("请求体不能为空");
    }
    
    const body = await ctx.request.body.json();
    const { state } = body;
    
    if (!state) {
      throw new Error("缺少必要参数：游戏状态");
    }
    
    // 重置游戏状态
    const newState = await resetGame(state);
    
    // 加载起始节点
    const startNode = await loadNode(newState.current);
    
    ctx.response.body = { 
      success: true, 
      data: { 
        state: newState,
        node: startNode
      } 
    };
  } catch (err: unknown) {
    console.error(`重置游戏出错: ${err instanceof Error ? err.message : String(err)}`);
    ctx.response.status = 400;
    ctx.response.body = { 
      success: false, 
      message: err instanceof Error ? err.message : String(err)
    };
  }
});

// 检查AI服务状态
router.get("/api/ai/status", async (ctx) => {
  try {
    const available = hasAvailableService();
    const services = getAvailableServices();
    
    ctx.response.body = { 
      success: true, 
      data: { 
        available,
        services
      } 
    };
  } catch (err: unknown) {
    console.error(`检查AI服务状态出错: ${err instanceof Error ? err.message : String(err)}`);
    ctx.response.status = 500;
    ctx.response.body = { 
      success: false, 
      message: err instanceof Error ? err.message : String(err)
    };
  }
});

// 配置AI服务端点
router.post("/api/ai/config", async (ctx) => {
  try {
    if (!ctx.request.hasBody) {
      throw new Error("请求体不能为空");
    }
    
    const body = await ctx.request.body.json();
    const { provider, apiKey, endpoint, model, temperature, maxTokens } = body;
    
    if (!provider) {
      throw new Error("缺少必要参数：提供商");
    }
    
    // 设置API密钥（新增）
    if (apiKey) {
      setApiKey(provider, apiKey);
    }
    
    // 设置自定义端点
    if (endpoint) {
      setCustomEndpoint(provider, endpoint);
    }
    
    // 设置自定义模型
    if (model) {
      setCustomModel(provider, model);
    }
    
    // 设置生成参数
    if (temperature !== undefined || maxTokens !== undefined) {
      setGenerationParams(provider, temperature, maxTokens);
    }
    
    ctx.response.body = { 
      success: true, 
      data: { 
        message: "AI服务配置已更新"
      } 
    };
  } catch (err: unknown) {
    console.error(`配置AI服务出错: ${err instanceof Error ? err.message : String(err)}`);
    ctx.response.status = 400;
    ctx.response.body = { 
      success: false, 
      message: err instanceof Error ? err.message : String(err)
    };
  }
});

// 直接生成内容（用于测试和调试）
router.post("/api/generate", async (ctx) => {
  try {
    if (!ctx.request.hasBody) {
      throw new Error("请求体不能为空");
    }
    
    const request = await ctx.request.body.json() as ContentGenerationRequest;
    
    // 检查必要参数
    if (!request.playerState || !request.currentLocation || !request.generationType) {
      throw new Error("缺少必要参数");
    }
    
    // 生成内容
    const content = await generateContent(request);
    
    ctx.response.body = { 
      success: true, 
      data: content
    };
  } catch (err: unknown) {
    console.error(`生成内容出错: ${err instanceof Error ? err.message : String(err)}`);
    ctx.response.status = 400;
    ctx.response.body = { 
      success: false, 
      message: err instanceof Error ? err.message : String(err)
    };
  }
});

// 获取自定义场景
router.post("/api/scene", async (ctx) => {
  try {
    if (!ctx.request.hasBody) {
      throw new Error("请求体不能为空");
    }
    
    const body = await ctx.request.body.json();
    const { state, location, context } = body;
    
    if (!state || !location) {
      throw new Error("缺少必要参数：游戏状态或位置");
    }
    
    // 转换为PlayerState
    const playerState = {
      character: state.character!,
      attributes: state.attributes,
      inventory: state.inventory,
      gold: state.gold,
      history: state.history,
      health: state.health,
      current: state.current
    };
    
    // 创建内容生成请求
    const request: ContentGenerationRequest = {
      type: ContentType.SCENE,
      location: location,
      state: playerState,
      context: context || "探索场景"
    };
    
    // 生成内容
    const content = await generateContent(request);
    
    // 创建自定义节点
    const customNode: GameNode = {
      id: `custom_${Date.now()}`,
      title: content.title,
      text: content.content,
      image: content.meta?.image_suggestion || "exploration.jpg",
      choices: content.choices.map((choice, index) => ({
        id: `choice_${index}`,
        text: choice.text,
        target: `generated_${Math.floor(Math.random() * 1000)}`,
        condition: "",
        effect: JSON.stringify(choice.effects)
      }))
    };
    
    // 更新状态
    const newState: GameState = {
      ...state,
      current: customNode.id,
      location: {
        id: `loc_${Date.now()}`,
        name: location,
        type: "custom"
      }
    };
    
    ctx.response.body = { 
      success: true, 
      data: {
        state: newState,
        node: customNode
      }
    };
  } catch (err: unknown) {
    console.error(`获取自定义场景出错: ${err instanceof Error ? err.message : String(err)}`);
    ctx.response.status = 400;
    ctx.response.body = { 
      success: false, 
      message: err instanceof Error ? err.message : String(err)
    };
  }
});

// 生成场景
router.post("/api/scene", async (ctx) => {
  try {
    const { state, location, context } = await ctx.request.body.json();
    
    if (!state || !location) {
      ctx.response.status = 400;
      ctx.response.body = {
        success: false,
        message: "缺少必要参数"
      };
      return;
    }
    
    // 生成唯一ID
    const nodeId = `generated_${uuid().substring(0, 8)}`;
    
    // 构建内容生成请求
    const request: ContentGenerationRequest = {
      type: ContentType.SCENE,
      location,
      state,
      context: context || "探索场景",
      nodeId
    };
    
    // 生成内容
    const content = await generateContent(request);
    
    // 创建新节点
    const node = {
      id: nodeId,
      title: content.title || `${location}`,
      text: content.content,
      image: content.meta?.image_suggestion || "exploration.jpg",
      choices: content.choices.map((choice, index) => ({
        id: `${nodeId}_choice_${index}`,
        text: choice.text,
        effects: choice.effects || {}
      }))
    };
    
    // 更新游戏状态
    state.current = nodeId;
    state.lastNode = state.current;
    state.visited.push(nodeId);
    
    // 如果有位置变化，更新状态中的位置
    if (content.meta?.location) {
      state.location = content.meta.location;
    }
    
    // 返回更新后的状态和节点
    ctx.response.body = {
      success: true,
      data: {
        state,
        node
      }
    };
  } catch (err: unknown) {
    console.error("生成场景出错:", err);
    ctx.response.status = 500;
    ctx.response.body = {
      success: false,
      message: err instanceof Error ? err.message : String(err)
    };
  }
});

export default router;