// 游戏状态
let gameState = null;

// DOM 元素
const elements = {
  nodeTitle: document.getElementById('node-title'),
  sceneImg: document.getElementById('scene-img'),
  sidebarImage: document.getElementById('sidebar-image'),
  nodeText: document.getElementById('node-text'),
  choicesContainer: document.getElementById('choices-container'),
  randomEventResult: document.getElementById('random-event-result'),
  attrStrength: document.getElementById('attr-strength'),
  attrIntelligence: document.getElementById('attr-intelligence'),
  attrCharisma: document.getElementById('attr-charisma'),
  attrLuck: document.getElementById('attr-luck'),
  inventory: document.getElementById('inventory'),
  goldDisplay: document.getElementById('gold-display'),
  specialStatus: document.getElementById('special-status'),
  loadingText: document.getElementById('loading-text'),
  loadingProgress: document.getElementById('loading-progress'),
  newGameBtn: document.getElementById('new-game'),
  saveGameBtn: document.getElementById('save-game'),
  loadGameBtn: document.getElementById('load-game'),
  settingsBtn: document.getElementById('settings-btn'),
  savesModal: document.getElementById('saves-modal'),
  settingsModal: document.getElementById('settings-modal'),
  saveSlots: document.getElementById('save-slots'),
  closeModals: document.querySelectorAll('.close-modal'),
  startScreen: document.getElementById('start-screen'),
  startNewGameBtn: document.getElementById('start-new-game'),
  startContinueBtn: document.getElementById('start-continue'),
  // 设置相关元素
  aiProvider: document.getElementById('ai-provider'),
  aiKey: document.getElementById('ai-key'),
  aiEndpoint: document.getElementById('ai-endpoint'),
  aiModel: document.getElementById('ai-model'),
  aiTemperature: document.getElementById('ai-temperature'),
  temperatureValue: document.getElementById('temperature-value'),
  aiMaxTokens: document.getElementById('ai-max-tokens'),
  saveSettingsBtn: document.getElementById('save-settings'),
  testAiConnectionBtn: document.getElementById('test-ai-connection'),
  aiStatusMessage: document.getElementById('ai-status-message'),
  // 右下角弹窗元素
  cornerToast: document.getElementById('corner-toast'),
  cornerToastMessage: document.querySelector('.corner-toast-message'),
  cornerToastProgressBar: document.querySelector('.corner-toast-progress-bar')
};

// API 端点
const API = {
  node: (id) => `/api/node/${id}`,
  choice: '/api/choice',
  init: '/api/init',
  world: '/api/world',
  character: '/api/character',
  attributePoints: '/api/attribute-points',
  reset: '/api/reset',
  // AI相关API
  aiStatus: '/api/ai/status',
  aiConfig: '/api/ai/config',
  generate: '/api/generate',
  scene: '/api/scene'
};

// 世界配置缓存
let worldConfig = null;

// AI服务状态
let aiServiceAvailable = false;
let aiServiceConfig = {
  provider: 'gemini',
  apiKey: '',
  endpoint: '',
  model: '',
  temperature: 0.7,
  maxTokens: 1024
};

// 检查是否存在存档
function hasSaves() {
  const saves = JSON.parse(localStorage.getItem('eldra_saves') || '{}');
  return Object.keys(saves).length > 0;
}

// 隐藏启动屏幕并初始化游戏
function hideStartScreen() {
  if (elements.startScreen) {
    elements.startScreen.style.display = 'none';
  }
}

// 初始化游戏
async function initGame() {
  try {
    // 检查AI服务可用性
    await checkAIService();
    
    // 获取初始状态
    const response = await fetch(API.init);
    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.message);
    }
    
    gameState = result.data;
    
    // 加载世界配置
    await loadWorldConfig();
    
    // 加载当前节点
    await loadNode(gameState.current);
    
    // 更新UI
    updateCharacterPanel();
  } catch (error) {
    console.error('初始化游戏出错:', error);
    showError('游戏初始化失败，请刷新页面重试');
  }
}

// 检查AI服务可用性
async function checkAIService() {
  try {
    const config = loadAIConfigFromStorage();
    if (!config || !config.apiKey) {
      aiServiceAvailable = false;
      if (elements.aiStatusMessage) {
        elements.aiStatusMessage.textContent = '未配置AI服务API密钥';
        elements.aiStatusMessage.className = 'error';
      }
      return;
    }

    const testResult = await testAIConnection();
    aiServiceAvailable = testResult.success;
    
    if (elements.aiStatusMessage) {
      elements.aiStatusMessage.textContent = testResult.success 
        ? 'AI服务可用'
        : `AI服务不可用: ${testResult.message}`;
      elements.aiStatusMessage.className = testResult.success ? 'success' : 'error';
    }
  } catch (error) {
    console.error('检查AI服务出错:', error);
    aiServiceAvailable = false;
    if (elements.aiStatusMessage) {
      elements.aiStatusMessage.textContent = `检查AI服务出错: ${error.message}`;
      elements.aiStatusMessage.className = 'error';
    }
  }
}

// 配置AI服务
async function configureAIService(settings) {
  try {
    const response = await fetch(API.aiConfig, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(settings)
    });
    
    const result = await response.json();
    
    if (result.success) {
      // 保存设置到本地
      aiServiceConfig = { ...settings };
      // 保存到localStorage（API密钥需要额外加密处理）
      const storageConfig = { ...settings };
      if (storageConfig.apiKey) {
        // 简单加密存储API密钥（实际应用中可能需要更安全的方式）
        storageConfig.apiKey = btoa(storageConfig.apiKey);
      }
      localStorage.setItem('eldra_ai_config', JSON.stringify(storageConfig));
      // 重新检查服务可用性
      await checkAIService();
      return { success: true, message: "AI服务配置已更新" };
    } else {
      return { success: false, message: result.message };
    }
  } catch (error) {
    console.error('配置AI服务出错:', error);
    return { success: false, message: error.message };
  }
}

// 加载世界配置
async function loadWorldConfig() {
  if (worldConfig) return worldConfig;
  
  try {
    const response = await fetch(API.world);
    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.message);
    }
    
    worldConfig = result.data;
    return worldConfig;
  } catch (error) {
    console.error('加载世界配置出错:', error);
    showError('无法加载游戏配置，请刷新页面重试');
  }
}

// 加载节点
async function loadNode(nodeId) {
  try {
    const response = await fetch(API.node(nodeId));
    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.message);
    }
    
    const node = result.data;
    
    // 特殊处理角色创建节点
    if (nodeId === 'character_creation') {
      // 确保character_creation表单只创建一次
      if (!document.getElementById('character-creation-form')) {
        showCharacterCreationUI();
      } else {
        console.log('角色创建表单已存在，不重复渲染');
      }
    } else {
      renderNode(node);
    }
    
    // 检查并显示随机事件结果
    if (gameState.randomEventResult) {
      elements.randomEventResult.textContent = gameState.randomEventResult;
      elements.randomEventResult.hidden = false;
      
      // 清除随机事件结果，以便下次不再显示
      delete gameState.randomEventResult;
    } else {
      elements.randomEventResult.hidden = true;
    }
  } catch (error) {
    console.error(`加载节点 ${nodeId} 出错:`, error);
    
    // 如果节点加载失败且AI服务可用，尝试生成内容
    if (aiServiceAvailable && nodeId.startsWith('generated_')) {
      showError(`加载节点失败，正在尝试生成内容...`);
      await generateScene('未知区域', '继续探索');
    } else {
      showError(`无法加载节点 ${nodeId}`);
    }
  }
}

// AI API请求函数
async function callAIAPI(prompt, options = {}) {
  // 显示加载状态
  showLoading('正在连接到AI服务...', 10);
  
  try {
    const config = loadAIConfigFromStorage();
    if (!config || !config.apiKey) {
      throw new Error('未配置AI服务API密钥');
    }

    const provider = config.provider || 'xai';
    const endpoint = provider === 'xai'
      ? 'https://api.x.ai/v1/chat/completions'
      : `https://generativelanguage.googleapis.com/v1beta/models/${config.model || 'gemini-pro'}:generateContent`;

    // 更新进度
    showLoading('正在准备请求数据...', 25);
    
    // 检查密钥格式
    let apiKey = config.apiKey;

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': provider === 'xai'
        ? `Bearer ${apiKey}`
        : `Bearer ${apiKey}`
    };

    // 使用配置中的模型名称
    let modelName = config.model;

    // 更新进度
    showLoading('构建AI请求中...', 40);
    
    const body = provider === 'xai'
      ? {
          model: modelName,
          messages: [{ role: 'user', content: prompt }],
          temperature: config.temperature || 0.7,
          max_tokens: config.maxTokens || 1024
        }
      : {
          contents: [{
            parts: [{ text: prompt }]
          }],
          generationConfig: {
            temperature: config.temperature || 0.7,
            maxOutputTokens: config.maxTokens || 1024
          }
        };

    try {
      // 更新进度
      showLoading(`正在发送请求到${provider}服务...`, 60);
      console.log(`正在使用${provider}服务发送请求，模型: ${modelName || config.model || '默认'}`);
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
      });

      // 更新进度
      showLoading('正在解析AI响应...', 80);

      if (!response.ok) {
        const errorData = await response.text();
        console.error(`API请求失败(${response.status}): ${errorData}`);
        
        // 尝试解析错误内容
        try {
          const errorJson = JSON.parse(errorData);
          if (errorJson.error && errorJson.error.message) {
            throw new Error(`AI服务错误: ${errorJson.error.message}`);
          }
        } catch (e) {
          // 如果解析失败，使用原始错误文本
        }
        
        throw new Error(`AI API请求失败: ${response.status} ${errorData}`);
      }

      // 更新进度
      showLoading('正在处理AI响应...', 90);
      
      const data = await response.json();
      const result = provider === 'xai'
        ? data.choices[0].message.content
        : data.candidates[0].content.parts[0].text;
      
      // 完成进度
      showLoading('内容生成完成!', 100);
      setTimeout(() => resetLoading(), 2000);
      
      return result;
    } catch (error) {
      showLoading(`错误: ${error.message}`, 100);
      console.error('调用AI API出错:', error);
      throw error;
    }
  } catch (error) {
    showLoading(`配置错误: ${error.message}`, 100);
    throw error;
  }
}

// 生成回退响应
function generateFallbackResponse() {
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

// 从localStorage加载AI配置
function loadAIConfigFromStorage() {
  try {
    const storedConfig = localStorage.getItem('eldra_ai_config');
    if (!storedConfig) return null;

    const config = JSON.parse(storedConfig);
    if (config.apiKey) {
      // 解密API密钥
      config.apiKey = atob(config.apiKey);
    }
    return config;
  } catch (error) {
    console.error('加载AI配置出错:', error);
    return null;
  }
}

// 保存AI配置到localStorage
function saveAIConfigToStorage(config) {
  try {
    const storageConfig = { ...config };
    if (storageConfig.apiKey) {
      // 加密API密钥
      storageConfig.apiKey = btoa(storageConfig.apiKey);
    }
    localStorage.setItem('eldra_ai_config', JSON.stringify(storageConfig));
    return true;
  } catch (error) {
    console.error('保存AI配置出错:', error);
    return false;
  }
}

// 修改生成场景函数，使用浏览器端API调用
async function generateScene(location, context) {
  try {
    // 显示初始加载状态
    showLoading(`正在生成场景: ${location}...`, 20);
    
    // 创建提示词
    const prompt = createScenePrompt(location, context);
    
    // 显示提示词创建完成状态
    showLoading(`正在将场景提示发送到AI...`, 40);
    
    // 调用AI API（内部会更新加载状态）
    const response = await callAIAPI(prompt);
    
    // 解析响应
    showLoading(`正在解析场景内容...`, 90);
    const parsedResponse = JSON.parse(response);
    
    // 完成
    showLoading(`场景已生成: ${parsedResponse.title}`, 100);
    setTimeout(() => resetLoading(), 2000);
    
    return parsedResponse;
  } catch (error) {
    console.error('生成场景出错:', error);
    showLoading(`生成场景失败: ${error.message}`, 100);
    showError(`生成场景失败: ${error.message}`);
    setTimeout(() => resetLoading(), 3000);
    return JSON.parse(generateFallbackResponse());
  }
}

// 创建场景提示
function createScenePrompt(location, context) {
  // 获取当前状态，如果有的话
  const specialStatus = context.specialStatus || 'none';
  
  // 检测特殊场景类型
  const isSpecialScene = location.includes('intimate') ||
                         location.includes('adult') ||
                         location.includes('slave') ||
                         location.includes('dungeon');
                         
  // 基础提示模板
  let prompt = `生成一个场景描述，地点: ${location}
角色信息:
${JSON.stringify(context, null, 2)}

请生成一个引人入胜的场景描述，包含:
1. 环境的生动描述
2. 当前的氛围和情绪
3. 可能的互动机会
4. 3-4个有意义的选择`;

  // 根据特殊状态增加提示
  if (specialStatus === 'lucky') {
    prompt += `\n\n角色当前处于"幸运"状态，请在场景中体现更多积极的机遇和可能性。`;
  } else if (specialStatus === 'blessed') {
    prompt += `\n\n角色当前处于"神眷"状态，场景中可以加入神秘力量的暗示和帮助。`;
  } else if (specialStatus === 'cursed') {
    prompt += `\n\n角色当前处于"诅咒"状态，场景描述应带有不祥之兆或微妙的危险。`;
  } else if (specialStatus === 'poisoned') {
    prompt += `\n\n角色当前处于"中毒"状态，应在描述中体现角色的不适和虚弱。`;
  } else if (specialStatus === 'dying') {
    prompt += `\n\n角色当前处于"濒死"状态，场景描述应突出紧迫感和寻求救助的需要。`;
  }

  // 特殊场景类型的额外提示
  if (isSpecialScene) {
    prompt += `\n\n这是一个成人向场景，请提供更详细和直接的描述，包括:
1. 人物的外表和穿着细节
2. 肢体接触和互动的具体描述
3. 情感和感官体验
4. 可能的亲密发展方向

内容可以包含成人主题，但保持描述的文学性和沉浸感。`;
  }

  // 如果是换地图类型的场景
  if (location.includes('travel') || location.includes('journey')) {
    prompt += `\n\n这是一个旅途/过渡场景，应当包含:
1. 新旧环境的对比
2. 旅途中的见闻和事件
3. 到达新地点后的初始印象
4. 暗示新地点可能的冒险`;
  }

  // 返回格式说明
  prompt += `\n\n以JSON格式返回:
{
  "title": "场景标题",
  "description": "场景描述",
  "choices": [
    {"id": "choice1", "text": "选择1"},
    {"id": "choice2", "text": "选择2"},
    {"id": "choice3", "text": "选择3"}
  ],
  "image_suggestion": "场景图片描述"
}`;

  return prompt;
}

// 渲染节点内容
function renderNode(node) {
  // 设置标题
  elements.nodeTitle.textContent = node.title;
  
  // 设置场景图片
  if (node.image) {
    elements.sceneImg.src = node.image.startsWith('/') ? node.image : `/images/${node.image}`;
    elements.sidebarImage.hidden = false;
  } else {
    elements.sidebarImage.hidden = true;
  }
  
  // 设置正文
  elements.nodeText.innerHTML = processText(node.text);
  
  // 清空并重建选项
  elements.choicesContainer.innerHTML = '';
  node.choices.forEach(choice => {
    const button = document.createElement('button');
    button.className = 'choice';
    button.textContent = choice.text;
    
    // 检查选项条件
    let conditionMet = true;
    if (choice.condition) {
      try {
        // 评估条件
        conditionMet = evaluateCondition(choice.condition, gameState);
      } catch (error) {
        console.error(`评估条件出错: ${error}`);
        conditionMet = false;
      }
    }
    
    if (conditionMet) {
      button.addEventListener('click', () => makeChoice(choice.id));
    } else {
      // 禁用不满足条件的选项
      button.disabled = true;
      button.classList.add('disabled-choice');
      button.title = '不满足选择条件';
    }
    
    elements.choicesContainer.appendChild(button);
  });
}

// 添加前端条件评估函数
function evaluateCondition(condition, state) {
  if (!condition.trim()) {
    return true; // 空条件始终为真
  }
  
  try {
    // 安全地评估条件
    return Function('state', `return ${condition};`)(state);
  } catch (error) {
    console.error(`评估条件出错: ${condition}`, error);
    return false;
  }
}

// 处理文本中的变量替换
function processText(text) {
  if (!text) return '';
  
  // 替换${state.xxx}格式的变量
  return text.replace(/\${state\.([^}]+)}/g, (match, path) => {
    try {
      // 分解路径
      const keys = path.split('.');
      let value = gameState;
      
      // 逐层查找
      for (const key of keys) {
        if (value === undefined || value === null) {
          return match; // 如果中间有层级不存在，返回原文本
        }
        value = value[key];
      }
      
      // 如果找到值，返回它
      return value !== undefined ? value : match;
    } catch (error) {
      console.error(`处理文本变量出错:`, error);
      return match;
    }
  });
}

// 显示角色创建界面
async function showCharacterCreationUI() {
  // 确保已加载世界配置
  await loadWorldConfig();
  
  // 获取可用属性点
  let availablePoints = 5;
  try {
    const response = await fetch(API.attributePoints);
    const result = await response.json();
    
    if (result.success) {
      availablePoints = result.data.points;
    }
  } catch (error) {
    console.error('获取可用属性点出错:', error);
  }
  
  // 设置标题
  elements.nodeTitle.textContent = "创建你的冒险者";
  
  // 设置场景图片
  elements.sceneImg.src = "/images/character_creation.jpg";
  elements.sidebarImage.hidden = false;
  
  // 清空文本和选项容器
  elements.nodeText.textContent = "请创建你的角色，选择种族、职业，并分配属性点。";
  elements.choicesContainer.innerHTML = '';
  
  // 创建角色表单
  const form = document.createElement('form');
  form.id = 'character-creation-form';
  form.className = 'character-creation-form';
  
  // 添加表单内容
  form.innerHTML = `
    <div class="form-group">
      <label for="character-name">角色名称:</label>
      <input type="text" id="character-name" required>
    </div>
    
    <div class="form-group">
      <label for="character-race">种族:</label>
      <div class="select-with-info">
        <select id="character-race">
          ${worldConfig.races.map(race => `<option value="${race.id}">${race.name}</option>`).join('')}
        </select>
        <button type="button" id="race-info-btn" class="info-btn">查看详情</button>
      </div>
    </div>
    
    <div class="form-group">
      <label for="character-class">职业:</label>
      <div class="select-with-info">
        <select id="character-class">
          ${worldConfig.classes.map(cls => `<option value="${cls.id}">${cls.name}</option>`).join('')}
        </select>
        <button type="button" id="class-info-btn" class="info-btn">查看详情</button>
      </div>
    </div>
    
    <div class="form-group">
      <label for="character-backstory">背景故事:</label>
      <textarea id="character-backstory" rows="3"></textarea>
    </div>
    
    <div class="attributes-group">
      <h4>属性点分配 (剩余: <span id="remaining-points">${availablePoints}</span>)</h4>
      
      <div class="attribute-row">
        <div class="attribute-name">力量:</div>
        <div class="attribute-controls">
          <button type="button" class="attr-btn decrease" data-attr="strength">-</button>
          <span id="attr-strength-value" class="attr-value">0</span>
          <button type="button" class="attr-btn increase" data-attr="strength">+</button>
        </div>
      </div>
      
      <div class="attribute-row">
        <div class="attribute-name">智力:</div>
        <div class="attribute-controls">
          <button type="button" class="attr-btn decrease" data-attr="intelligence">-</button>
          <span id="attr-intelligence-value" class="attr-value">0</span>
          <button type="button" class="attr-btn increase" data-attr="intelligence">+</button>
        </div>
      </div>
      
      <div class="attribute-row">
        <div class="attribute-name">魅力:</div>
        <div class="attribute-controls">
          <button type="button" class="attr-btn decrease" data-attr="charisma">-</button>
          <span id="attr-charisma-value" class="attr-value">0</span>
          <button type="button" class="attr-btn increase" data-attr="charisma">+</button>
        </div>
      </div>
      
      <div class="attribute-row">
        <div class="attribute-name">幸运:</div>
        <div class="attribute-controls">
          <button type="button" class="attr-btn decrease" data-attr="luck">-</button>
          <span id="attr-luck-value" class="attr-value">0</span>
          <button type="button" class="attr-btn increase" data-attr="luck">+</button>
        </div>
      </div>
    </div>
    
    <div class="submit-group">
      <button type="submit" class="submit-btn">创建角色</button>
    </div>
  `;
  
  elements.choicesContainer.appendChild(form);
  
  // 初始化属性分配系统
  const attributePoints = {
    strength: 0,
    intelligence: 0,
    charisma: 0,
    luck: 0
  };
  
  // 剩余点数显示
  const remainingPointsDisplay = document.getElementById('remaining-points');
  let remainingPoints = availablePoints;
  
  // 属性值显示
  const attributeValueDisplays = {
    strength: document.getElementById('attr-strength-value'),
    intelligence: document.getElementById('attr-intelligence-value'),
    charisma: document.getElementById('attr-charisma-value'),
    luck: document.getElementById('attr-luck-value')
  };
  
  // 增加属性点
  document.querySelectorAll('.attr-btn.increase').forEach(btn => {
    btn.addEventListener('click', () => {
      const attr = btn.dataset.attr;
      if (remainingPoints > 0) {
        attributePoints[attr]++;
        remainingPoints--;
        updateAttributeDisplay();
      }
    });
  });
        
  // 减少属性点
  document.querySelectorAll('.attr-btn.decrease').forEach(btn => {
    btn.addEventListener('click', () => {
      const attr = btn.dataset.attr;
      if (attributePoints[attr] > 0) {
        attributePoints[attr]--;
        remainingPoints++;
        updateAttributeDisplay();
      }
    });
  });
        
  // 更新属性显示
  function updateAttributeDisplay() {
    remainingPointsDisplay.textContent = remainingPoints;
    
    for (const attr in attributePoints) {
      attributeValueDisplays[attr].textContent = attributePoints[attr];
    }
  }
  
  // 查看种族信息
  document.getElementById('race-info-btn').addEventListener('click', async () => {
    const raceId = document.getElementById('character-race').value;
    const race = worldConfig.races.find(r => r.id === raceId);
    
    if (race) {
      showInfoDialog(
        `${race.name}种族信息`,
        `${race.description}\n\n基础属性修正:\n力量: ${race.attributes.strength}\n智力: ${race.attributes.intelligence}\n魅力: ${race.attributes.charisma}\n幸运: ${race.attributes.luck}`
      );
    }
  });
  
  // 查看职业信息
  document.getElementById('class-info-btn').addEventListener('click', async () => {
    const classId = document.getElementById('character-class').value;
    const characterClass = worldConfig.classes.find(c => c.id === classId);
    
    if (characterClass) {
      showInfoDialog(
        `${characterClass.name}职业信息`,
        `${characterClass.description}\n\n属性修正:\n力量: ${characterClass.attributes.strength}\n智力: ${characterClass.attributes.intelligence}\n魅力: ${characterClass.attributes.charisma}\n幸运: ${characterClass.attributes.luck}`
      );
    }
  });
  
  // 处理表单提交
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const name = document.getElementById('character-name').value;
    const race = document.getElementById('character-race').value;
    const characterClass = document.getElementById('character-class').value;
    const backstory = document.getElementById('character-backstory').value;
    
    // 显示加载进度条
    showLoading('正在创建角色...', 20);
    
    // 显示角落提示
    showCornerToast('创建角色并生成世界中...', 20);
    
    try {
      // 更新进度 - 发送请求前
      showLoading('发送角色数据...', 30);
      updateCornerToast('正在处理角色数据...', 30);
      
      const response = await fetch(API.character, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name,
          race,
          characterClass,
          backstory,
          attributePoints
        })
      });
      
      // 更新进度 - 等待服务器处理
      showLoading('服务器正在处理角色数据...', 50);
      updateCornerToast('正在生成游戏世界与场景...', 50);
      
      const result = await response.json();
      
      // 更新进度 - 接收到响应
      showLoading('角色创建完成，准备进入游戏世界...', 80);
      updateCornerToast('准备进入游戏世界...', 80);
      
      if (result.success) {
        // 更新进度 - 完成
        showLoading('加载完成！欢迎来到埃尔德拉世界！', 100);
        updateCornerToast('欢迎来到埃尔德拉世界！', 100);
        
        // 更新游戏状态
        gameState = result.data.state;
        
        // 短暂延迟后渲染节点，让用户看到进度条完成状态
        setTimeout(() => {
          renderNode(result.data.node);
          updateCharacterPanel();
          resetLoading();
          hideCornerToast();
        }, 1000);
      } else {
        showLoading(`创建失败: ${result.message}`, 100);
        showError(`创建角色失败: ${result.message}`);
        setTimeout(resetLoading, 3000);
      }
    } catch (error) {
      console.error('创建角色出错:', error);
      showLoading(`创建失败: ${error.message}`, 100);
      showError(`创建角色失败: ${error.message}`);
      setTimeout(resetLoading, 3000);
    }
  });
}

// 显示信息对话框
function showInfoDialog(title, content) {
  // 创建对话框元素
  const dialog = document.createElement('div');
  dialog.className = 'info-dialog';
  
  dialog.innerHTML = `
    <div class="info-dialog-content">
      <h3>${title}</h3>
      <p>${content.replace(/\n/g, '<br>')}</p>
      <button class="close-dialog">关闭</button>
    </div>
  `;
  
  // 添加到页面
  document.body.appendChild(dialog);
  
  // 关闭按钮事件
  dialog.querySelector('.close-dialog').addEventListener('click', () => {
    document.body.removeChild(dialog);
  });
}

// 处理选择
async function makeChoice(choiceId) {
  try {
    // 获取选择的文本描述，用于流式显示
    const choiceElement = document.querySelector(`.choice[onclick*="${choiceId}"]`);
    const choiceText = choiceElement ? choiceElement.textContent : '选择选项';
    
    // 显示加载状态
    showLoading(`正在处理选择: ${choiceText}...`, 20);
    
    // 禁用所有选择按钮，防止重复点击
    document.querySelectorAll('.choice').forEach(btn => {
      btn.disabled = true;
    });
    
    // 添加加载提示
    const loadingIndicator = document.createElement('div');
    loadingIndicator.className = 'loading-indicator';
    loadingIndicator.textContent = '正在加载...';
    elements.choicesContainer.appendChild(loadingIndicator);
    
    // 更新加载状态
    showLoading(`向服务器发送选择...`, 40);
    
    const response = await fetch(API.choice, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        state: gameState,
        choiceId
      })
    });
    
    // 更新加载状态
    showLoading(`正在解析选择结果...`, 60);
    
    const result = await response.json();
    
    if (result.success) {
      // 更新加载状态
      showLoading(`正在生成场景内容...`, 80);
      
      // 保存之前的特殊状态，以便比较变化
      const previousStatus = gameState.specialStatus;
      
      // 更新游戏状态
      gameState = result.data.state;
      
      // 检查特殊状态变化
      if (gameState.specialStatus !== previousStatus) {
        // 如果状态发生了变化，显示一个提示
        const statusText = getStatusDisplayText(gameState.specialStatus);
        showLoading(`状态变化: ${statusText}`, 90);
      }
      
      // 渲染新节点和更新角色面板
      renderNode(result.data.node);
      updateCharacterPanel();
      
      // 完成加载
      showLoading(`选择完成`, 100);
      setTimeout(() => resetLoading(), 1000);
    } else {
      // 更友好的错误提示
      if (result.message.includes("不满足选择条件")) {
        showError("你不满足选择该选项的条件。请选择其他选项。");
        showLoading(`条件不满足: 无法进行该选择`, 100);
      } else {
        showError(`处理选择失败: ${result.message}`);
        showLoading(`错误: ${result.message}`, 100);
      }
      
      // 重新加载当前节点以恢复选项
      loadNode(gameState.current);
      setTimeout(() => resetLoading(), 2000);
    }
  } catch (error) {
    console.error('处理选择出错:', error);
    showError(`处理选择失败: ${error.message}`);
    showLoading(`错误: ${error.message}`, 100);
    
    // 重新加载当前节点以恢复选项
    loadNode(gameState.current);
    setTimeout(() => resetLoading(), 2000);
  } finally {
    // 移除加载提示
    const loadingIndicator = document.querySelector('.loading-indicator');
    if (loadingIndicator) {
      loadingIndicator.remove();
    }
  }
}

// 获取状态的显示文本
function getStatusDisplayText(status) {
  switch (status) {
    case 'blessed': return '神眷';
    case 'lucky': return '幸运';
    case 'cursed': return '诅咒';
    case 'poisoned': return '中毒';
    case 'dying': return '濒死';
    case 'dead': return '死亡';
    default: return '无';
  }
}

// 更新角色面板
function updateCharacterPanel() {
  if (!gameState) return;
  
  // 更新属性值
  elements.attrStrength.textContent = gameState.attributes.strength || 0;
  elements.attrIntelligence.textContent = gameState.attributes.intelligence || 0;
  elements.attrCharisma.textContent = gameState.attributes.charisma || 0;
  elements.attrLuck.textContent = gameState.attributes.luck || 0;
  
  // 更新金币显示
  elements.goldDisplay.textContent = `${gameState.gold} 金币`;
  
  // 更新物品列表
  elements.inventory.innerHTML = '';
  if (gameState.inventory.length === 0) {
    const emptyItem = document.createElement('li');
    emptyItem.textContent = '空';
    elements.inventory.appendChild(emptyItem);
  } else {
    gameState.inventory.forEach(item => {
      const listItem = document.createElement('li');
      listItem.textContent = item;
      elements.inventory.appendChild(listItem);
    });
  }
  
  // 更新特殊状态显示
  if (gameState.specialStatus) {
    updateSpecialStatus(gameState.specialStatus);
  } else {
    updateSpecialStatus('none');
  }
  
  // 更新生命值显示（如有需要可添加生命值HTML元素）
  if (gameState.health <= 0) {
    updateSpecialStatus('dead');
  }
}

// 更新特殊状态显示
function updateSpecialStatus(status) {
  if (!elements.specialStatus) return;
  
  // 移除所有状态类名
  elements.specialStatus.className = 'special-status';
  
  // 添加当前状态类名
  elements.specialStatus.classList.add(status.toLowerCase());
  
  // 根据状态设置显示文本
  let statusText = '无';
  switch (status.toLowerCase()) {
    case 'blessed':
      statusText = '神眷';
      break;
    case 'lucky':
      statusText = '幸运';
      break;
    case 'cursed':
      statusText = '诅咒';
      break;
    case 'poisoned':
      statusText = '中毒';
      break;
    case 'dying':
      statusText = '濒死';
      break;
    case 'dead':
      statusText = '死亡';
      break;
    default:
      statusText = '无';
  }
  
  // 更新显示文本
  elements.specialStatus.textContent = statusText;
}

// 流式加载进度显示函数
function showLoading(message, progress = 0) {
  if (!elements.loadingText || !elements.loadingProgress) return;
  
  // 更新加载消息
  elements.loadingText.textContent = message || '加载中...';
  
  // 更新进度条
  elements.loadingProgress.style.width = `${progress}%`;
}

// 更新加载进度
function updateLoadingProgress(progress) {
  if (!elements.loadingProgress) return;
  elements.loadingProgress.style.width = `${progress}%`;
}

// 重置加载显示
function resetLoading() {
  showLoading('准备就绪', 0);
}

// 右下角弹窗函数
function showCornerToast(message, progress = 0) {
  if (elements.cornerToast && elements.cornerToastMessage && elements.cornerToastProgressBar) {
    elements.cornerToastMessage.textContent = message;
    elements.cornerToastProgressBar.style.width = `${progress}%`;
    elements.cornerToast.hidden = false;
    elements.cornerToast.classList.remove('hidden');
  }
}

function updateCornerToast(message, progress) {
  if (elements.cornerToastMessage && elements.cornerToastProgressBar) {
    if (message) {
      elements.cornerToastMessage.textContent = message;
    }
    if (progress !== undefined) {
      elements.cornerToastProgressBar.style.width = `${progress}%`;
    }
  }
}

function hideCornerToast() {
  if (elements.cornerToast) {
    elements.cornerToast.classList.add('hidden');
    setTimeout(() => {
      elements.cornerToast.hidden = true;
    }, 300);
  }
}

// 显示设置模态窗口
function showSettingsModal() {
  // 填充当前设置
  if (elements.aiProvider) elements.aiProvider.value = aiServiceConfig.provider || 'gemini';
  if (elements.aiKey) elements.aiKey.value = aiServiceConfig.apiKey || '';
  if (elements.aiEndpoint) elements.aiEndpoint.value = aiServiceConfig.endpoint || '';
  if (elements.aiModel) elements.aiModel.value = aiServiceConfig.model || '';
  if (elements.aiTemperature) {
    elements.aiTemperature.value = aiServiceConfig.temperature || 0.7;
    if (elements.temperatureValue) elements.temperatureValue.textContent = aiServiceConfig.temperature || 0.7;
  }
  if (elements.aiMaxTokens) elements.aiMaxTokens.value = aiServiceConfig.maxTokens || 1024;
  
  // 显示模态窗口
  elements.settingsModal.hidden = false;
}

// 保存设置
async function saveSettings() {
  try {
    const provider = elements.aiProvider.value;
    const apiKey = elements.aiKey.value;
    
    // 验证API密钥格式
    // if (provider === 'xai' && apiKey.startsWith('xai-')) {
    //   showError('检测到xai-开头的API密钥，请使用有效的OpenAI API密钥(sk-开头)');
    //   return;
    // }
    
    // 当选择XAI时验证有效的模型
    let model = elements.aiModel.value;
    // 如果用户使用XAI提供商，可以自由输入任何模型名称
    if (provider === 'xai') {
      // 保留用户输入的模型名称，不做限制
      console.log(`使用XAI提供商和模型: ${model}`);
    }
    
    const config = {
      provider,
      apiKey,
      model,
      temperature: parseFloat(elements.aiTemperature.value),
      maxTokens: parseInt(elements.aiMaxTokens.value)
    };

    // 保存到localStorage
    if (saveAIConfigToStorage(config)) {
      // 同步到后端
      try {
        // 首先将配置发送到后端
        const serverResult = await configureAIService(config);
        if (!serverResult.success) {
          showError(`服务器配置失败: ${serverResult.message}`);
          return;
        }
        
        // 然后测试连接
        const testResult = await testAIConnection();
        showInfoDialog('设置已保存', '设置已成功保存到本地和服务器，并测试通过');
        // 更新全局配置
        aiServiceConfig = config;
        // 重新检查服务可用性
        await checkAIService();
      } catch (error) {
        showError(`设置保存成功，但服务器同步或连接测试失败: ${error.message}`);
      }
    } else {
      showError('保存设置失败');
    }
  } catch (error) {
    showError(`保存设置错误: ${error.message}`);
  }
}

// 测试AI连接
async function testAIConnection() {
  try {
    const testPrompt = "测试连接，请回复: OK";
    const response = await callAIAPI(testPrompt);
    return { success: true, message: "连接测试成功" };
  } catch (error) {
    console.error('AI连接测试失败:', error);
    throw error;
  }
}

// 开始新游戏
async function startNewGame() {
  // 先显示右下角弹窗
  showCornerToast('正在加载游戏...', 10);
  
  // 然后隐藏启动屏幕
  hideStartScreen();
  
  try {
    // 加载世界配置
    updateCornerToast('正在加载世界配置...', 30);
    await loadWorldConfig();
    
    // 更新弹窗进度
    updateCornerToast('正在初始化游戏状态...', 50);
    
    // 直接跳转到角色创建节点
    const response = await fetch(API.init);
    const result = await response.json();
    
    if (result.success) {
      gameState = result.data;
      
      // 显式设置当前节点为角色创建节点
      gameState.current = 'character_creation';
      
      // 更新弹窗进度
      updateCornerToast('正在加载角色创建...', 80);
      
      // 加载角色创建节点
      await loadNode('character_creation');
      
      // 更新UI
      updateCharacterPanel();
      
      // 更新弹窗进度并在一段时间后隐藏
      updateCornerToast('游戏加载完成！', 100);
      setTimeout(() => {
        hideCornerToast();
      }, 1500);
    } else {
      throw new Error(result.message);
    }
  } catch (error) {
    console.error('开始新游戏出错:', error);
    showError('无法开始新游戏，请刷新页面重试');
    
    // 出错时也更新并隐藏弹窗
    updateCornerToast('加载失败', 100);
    setTimeout(() => {
      hideCornerToast();
    }, 1500);
  }
}

// 保存游戏
function saveGame(slotName = null) {
  if (!gameState) return;
  
  // 如果没有提供存档名，显示输入对话框
  if (!slotName) {
    const saveName = prompt('请输入存档名称:', `冒险 ${new Date().toLocaleString()}`);
    if (!saveName) return; // 用户取消
    slotName = saveName;
  }
  
  // 获取现有存档
  const saves = JSON.parse(localStorage.getItem('eldra_saves') || '{}');
  
  // 添加新存档
  saves[slotName] = {
    state: gameState,
    timestamp: Date.now(),
    date: new Date().toLocaleString()
  };
  
  // 保存到本地存储
  localStorage.setItem('eldra_saves', JSON.stringify(saves));
  
  // 显示成功消息
  alert(`游戏已保存: ${slotName}`);
}

// 显示存档模态框
function showSavesModal(isLoading = false) {
  // 获取存档
  const saves = JSON.parse(localStorage.getItem('eldra_saves') || '{}');
  
  // 清空存档槽容器
  elements.saveSlots.innerHTML = '';
  
  if (Object.keys(saves).length === 0) {
    elements.saveSlots.innerHTML = '<p>没有可用的存档</p>';
  } else {
    // 按时间戳排序（最新的在前）
    const sortedSaves = Object.entries(saves).sort((a, b) => b[1].timestamp - a[1].timestamp);
    
    sortedSaves.forEach(([name, save]) => {
      const slot = document.createElement('div');
      slot.className = 'save-slot';
      
      slot.innerHTML = `
        <div class="save-slot-info">
          <h4>${name}</h4>
          <p>${save.date}</p>
          <p>${save.state.character ? `角色: ${save.state.character.name}` : '无角色'}</p>
        </div>
        <div class="save-slot-actions">
          <button class="load-save-btn">${isLoading ? '加载' : '覆盖'}</button>
          <button class="delete-save-btn">删除</button>
        </div>
      `;
      
      // 加载按钮事件
      slot.querySelector('.load-save-btn').addEventListener('click', () => {
        if (isLoading) {
          loadGame(name);
        } else {
          if (confirm(`是否要覆盖存档 "${name}"？`)) {
            saveGame(name);
            elements.savesModal.hidden = true;
          }
        }
      });
      
      // 删除按钮事件
      slot.querySelector('.delete-save-btn').addEventListener('click', () => {
        if (confirm(`是否要删除存档 "${name}"？`)) {
          delete saves[name];
          localStorage.setItem('eldra_saves', JSON.stringify(saves));
          showSavesModal(isLoading);
        }
      });
      
      elements.saveSlots.appendChild(slot);
    });
  }
  
  // 显示模态框
  elements.savesModal.hidden = false;
}

// 加载游戏
function loadGame(saveName) {
  // 获取存档
  const saves = JSON.parse(localStorage.getItem('eldra_saves') || '{}');
  
  if (saves[saveName]) {
    // 加载游戏状态
    gameState = saves[saveName].state;
    
    // 加载节点
    loadNode(gameState.current);
    
    // 更新角色面板
    updateCharacterPanel();
    
    // 隐藏模态框
    elements.savesModal.hidden = true;
    
    // 隐藏启动屏幕
    hideStartScreen();
  } else {
    showError(`找不到存档: ${saveName}`);
  }
}

// 显示错误信息
function showError(message) {
  alert(`错误: ${message}`);
}

// 游戏初始化
document.addEventListener('DOMContentLoaded', async () => {
  // 确保右下角弹窗元素已正确获取
  if (!elements.cornerToast) {
    elements.cornerToast = document.getElementById('corner-toast');
  }
  if (!elements.cornerToastMessage) {
    elements.cornerToastMessage = document.querySelector('.corner-toast-message');
  }
  if (!elements.cornerToastProgressBar) {
    elements.cornerToastProgressBar = document.querySelector('.corner-toast-progress-bar');
  }

  // 加载AI配置并更新全局配置变量
  const savedConfig = loadAIConfigFromStorage();
  if (savedConfig) {
    aiServiceConfig = savedConfig;
    // 同步到后端
    try {
      await configureAIService(savedConfig);
      console.log('已从浏览器加载并应用AI服务配置');
    } catch (error) {
      console.error('应用已保存的AI配置时出错:', error);
    }
  }
  
  // 启动屏幕按钮事件
  if (elements.startNewGameBtn) {
    elements.startNewGameBtn.addEventListener('click', (e) => {
      // 阻止事件冒泡和默认行为
      e.preventDefault();
      e.stopPropagation();
      
      // 禁用按钮防止重复点击
      elements.startNewGameBtn.disabled = true;
      
      // 先显示弹窗
      showCornerToast('正在加载游戏...', 10);
      
      // 短暂延迟后执行后续操作，确保弹窗显示
      setTimeout(async () => {
        // 隐藏启动屏幕
        hideStartScreen();
        
        // 调用游戏加载逻辑(删除弹窗调用，因为已经提前调用了)
        try {
          // 加载世界配置
          updateCornerToast('正在加载世界配置...', 30);
          await loadWorldConfig();
          
          // 更新弹窗进度
          updateCornerToast('正在初始化游戏状态...', 50);
          
          // 直接跳转到角色创建节点
          const response = await fetch(API.init);
          const result = await response.json();
          
          if (result.success) {
            gameState = result.data;
            
            // 显式设置当前节点为角色创建节点
            gameState.current = 'character_creation';
            
            // 更新弹窗进度
            updateCornerToast('正在加载角色创建...', 80);
            
            // 加载角色创建节点
            await loadNode('character_creation');
            
            // 更新UI
            updateCharacterPanel();
            
            // 更新弹窗进度并在一段时间后隐藏
            updateCornerToast('游戏加载完成！', 100);
            setTimeout(() => {
              hideCornerToast();
              // 重新启用按钮
              elements.startNewGameBtn.disabled = false;
            }, 1500);
          } else {
            throw new Error(result.message);
          }
        } catch (error) {
          console.error('开始新游戏出错:', error);
          showError('无法开始新游戏，请刷新页面重试');
          
          // 出错时也更新并隐藏弹窗
          updateCornerToast('加载失败', 100);
          setTimeout(() => {
            hideCornerToast();
            // 重新启用按钮
            elements.startNewGameBtn.disabled = false;
          }, 1500);
        }
      }, 100); // 100ms延迟确保弹窗显示
    });
  }
  
  if (elements.startContinueBtn) {
    if (hasSaves()) {
      elements.startContinueBtn.addEventListener('click', () => {
        hideStartScreen();
        showSavesModal(true);
      });
    } else {
      elements.startContinueBtn.disabled = true;
      elements.startContinueBtn.title = '没有找到存档';
    }
  }
  
  // 游戏控制按钮事件
  if (elements.newGameBtn) {
    elements.newGameBtn.addEventListener('click', (e) => {
      // 阻止事件冒泡和默认行为
      e.preventDefault();
      e.stopPropagation();
      
      // 禁用按钮防止重复点击
      elements.newGameBtn.disabled = true;
      
      // 先显示弹窗
      showCornerToast('正在加载游戏...', 10);
      
      // 短暂延迟后执行后续操作，确保弹窗显示
      setTimeout(async () => {
        try {
          // 加载世界配置
          updateCornerToast('正在加载世界配置...', 30);
          await loadWorldConfig();
          
          // 更新弹窗进度
          updateCornerToast('正在初始化游戏状态...', 50);
          
          // 直接跳转到角色创建节点
          const response = await fetch(API.init);
          const result = await response.json();
          
          if (result.success) {
            gameState = result.data;
            
            // 显式设置当前节点为角色创建节点
            gameState.current = 'character_creation';
            
            // 更新弹窗进度
            updateCornerToast('正在加载角色创建...', 80);
            
            // 加载角色创建节点
            await loadNode('character_creation');
            
            // 更新UI
            updateCharacterPanel();
            
            // 更新弹窗进度并在一段时间后隐藏
            updateCornerToast('游戏加载完成！', 100);
            setTimeout(() => {
              hideCornerToast();
              // 重新启用按钮
              elements.newGameBtn.disabled = false;
            }, 1500);
          } else {
            throw new Error(result.message);
          }
        } catch (error) {
          console.error('开始新游戏出错:', error);
          showError('无法开始新游戏，请刷新页面重试');
          
          // 出错时也更新并隐藏弹窗
          updateCornerToast('加载失败', 100);
          setTimeout(() => {
            hideCornerToast();
            // 重新启用按钮
            elements.newGameBtn.disabled = false;
          }, 1500);
        }
      }, 100); // 100ms延迟确保弹窗显示
    });
  }
  
  if (elements.saveGameBtn) {
    elements.saveGameBtn.addEventListener('click', () => saveGame());
  }
  
  if (elements.loadGameBtn) {
    elements.loadGameBtn.addEventListener('click', () => showSavesModal(true));
  }
  
  // 设置按钮事件
  if (elements.settingsBtn) {
    elements.settingsBtn.addEventListener('click', showSettingsModal);
  }
  
  // 关闭模态窗口按钮
  if (elements.closeModals) {
    elements.closeModals.forEach(btn => {
      btn.addEventListener('click', (event) => {
        // 找到父模态窗口
        const modal = event.target.closest('.modal');
        if (modal) {
          modal.hidden = true;
        }
      });
    });
  }
  
  // 温度滑块实时更新显示
  if (elements.aiTemperature && elements.temperatureValue) {
    elements.aiTemperature.addEventListener('input', () => {
      elements.temperatureValue.textContent = elements.aiTemperature.value;
    });
  }
  
  // 保存设置按钮
  if (elements.saveSettingsBtn) {
    elements.saveSettingsBtn.addEventListener('click', saveSettings);
  }
  
  // 测试连接按钮
  if (elements.testAiConnectionBtn) {
    elements.testAiConnectionBtn.addEventListener('click', testAIConnection);
  }
  
  // 初始化游戏，但不显示启动屏幕
  if (!elements.startScreen) {
    await initGame();
  }
});