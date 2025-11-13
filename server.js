const express = require('express');
const axios = require('axios');
const cors = require('cors'); 
const app = express();
const port = 3000;

// 1. CORS 配置 (解決前端連線問題)
app.use(cors()); 

// 解析 JSON 請求
app.use(express.json());

// **重要：請將此處的 API_KEY 替換為您從 https://free.v36.cm 服務獲得的真實令牌**
const API_KEY = 'sk-G6e4tZ4DDFga8daJ9c031c6939Ec4619AcC43fCeBd11Eb4f'; 

// 設置第三方 OpenAI 兼容 API 請求
const customOpenAIApi = axios.create({
  baseURL: 'https://free.v36.cm', // 使用您提供的 URL
  headers: {
    // 這次我們傳遞 Authorization 標頭來解決 "未提供令牌" 錯誤
    'Authorization': `Bearer ${API_KEY}`, 
    'Content-Type': 'application/json',
  }
});

// 路由：生成個性化任務與情緒加權
app.post('/generate-task', async (req, res) => {
  const { emotion, description } = req.body;

  // 1. 定義系統提示詞 (System Prompt) - 保持 JSON 輸出要求
  const systemPrompt = `你是一個溫暖、具啟發性的心理健康輔導助手。你的任務是根據用戶選擇的情緒和提供的額外描述，生成一個個性化的行動任務與鼓勵或安慰，以及一個介於 -10 到 10 之間的情緒加權數值。
  - **🌟 創意要求 **：請盡量提供**多樣化且具體**的任務。**避免**重複生成常見的任務，例如「深呼吸練習」或「寫下感恩」（例如「分享快樂」），除非用戶的描述非常具體地指向它。
  - **任務 (Task):**
    - 任務標題 (t): 簡短、具體的任務名稱。
    - 任務描述 (d): 執行任務的具體步驟或額外說明。
    - 任務類別 (c): 任務的目標（如：放鬆、感恩、自我照顧、專注）。

  - **情緒加權 (Weight):**
    - 數值 (w): 介於 -10 到 10 之間的整數。
      - 負數表示任務傾向於「改善」或「調節」情緒。
      - 正數表示任務傾向於「放大」或「鼓勵」情緒。

  請以純 JSON 格式回覆，不要包含任何額外文字。`;

  // 2. 用戶提示詞 (User Prompt)
  const userPrompt = `當前情緒為：「${emotion}」。用戶描述為：「${description || '無額外描述'}」。請生成任務與加權，格式必須為：{"task": {"t": "...", "d": "...", "c": "..."}, "w": ...}`;

  try {
    // 3. 調用 API (使用標準的 /v1/chat/completions 接口路徑，並指定 gpt-3.5-turbo)
    const response = await customOpenAIApi.post('/v1/chat/completions', {
      model: "gpt-4o-mini", // 使用標準的 GPT-3.5 模型名稱
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      max_tokens: 500,
      temperature: 0.7,
      // 強制 JSON 輸出
      response_format: { type: "json_object" } 
    });
    
    // 4. 解析 AI 回應
    const aiContent = response.data.choices[0].message.content;
    
    // 解析 JSON
    const result = JSON.parse(aiContent);

    res.json(result); 

  } catch (error) {
    // 輸出詳細錯誤到終端機
    const errorMessage = error.response ? JSON.stringify(error.response.data) : error.message;
    console.error('第三方 API 錯誤:', errorMessage);
    res.status(500).json({ error: '無法生成任務，請檢查 API 服務是否運行或接口路徑是否正確。' });
  }
});

// 啟動伺服器
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});