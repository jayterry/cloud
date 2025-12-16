const express = require('express'); // 補上這行，這是伺服器的核心
const axios = require('axios');
const cors = require('cors'); 
const app = express();

// 1. CORS 配置
app.use(cors()); 

// 解析 JSON 請求
app.use(express.json());

// **🌟 修正 1：確保從 Render 環境變數讀取 API_KEY**
const API_KEY = process.env.API_KEY; 

// 設置第三方 OpenAI 兼容 API 請求 (保留你原本的 URL 設定)
const customOpenAIApi = axios.create({
  baseURL: 'https://free.v36.cm', // 🌟 如果你用正版 Key 請改回此項，若用轉發站請改回 'https://free.v36.cm'
  headers: {
    'Authorization': `Bearer ${API_KEY}`, 
    'Content-Type': 'application/json',
  }
});

// **🌟 健康檢查路由**
app.get("/", (req, res) => {
  res.send("✅ Mood Gacha AI Server is running with your original logic!");
});

// 路由：生成個性化任務與情緒加權 (完全保留你原本的 Prompt)
app.post('/generate-task', async (req, res) => {
  const { emotion, description } = req.body;

  if (!API_KEY) {
    console.error("❌ 錯誤：API_KEY 未設定。");
    return res.status(500).json({ error: "伺服器配置錯誤：未設定 API 金鑰。" });
  }

  // --- 完全保留你原本的系統提示詞 ---
  const systemPrompt = `你是一個溫暖、具啟發性的心理健康輔導助手。  
你的任務是根據用戶選擇的情緒與描述，生成：
1️⃣ 一個個性化的行動任務（具體、有創意、有實際可行步驟、簡單、能快速完成）  
2️⃣ 一段真誠的鼓勵或安慰語  
3️⃣ 一個介於 -10 到 10 的情緒加權數值  

🌟 請保持高創意與多樣性：
- 避免重複、籠統、或過於常見的建議（如深呼吸、寫感恩日記、冥想等）。  
- 若真的適合使用這些活動，請用**新的場景或細節呈現**（例如「在陽台對天空做三次深呼吸」）。
- 讓每次任務在主題、行為或感官焦點上與前幾次不同。
- 可以結合五感（視覺、聽覺、觸覺、嗅覺、味覺）、環境、人物互動或創造活動。

🧩 任務格式：
{
  "task": { "t": "任務標題", "d": "具體步驟（1–3句）", "c": "任務類別" },
  "message": "鼓勵或安慰語",
  "w": -10~10
}

範例任務類別（可擴充）：放鬆、感恩、自我照顧、反思、創造、社交、專注、身體覺察
在生成任務前，先檢查與最近的任務是否相似，若太接近請重新構思。
請以**純 JSON 格式**輸出。`;

  const userPrompt = `當前情緒為：「${emotion}」。用戶描述為：「${description || '無額外描述'}」。請生成任務與加權，格式必須為：{"task": {"t": "...", "d": "...", "c": "..."}, "w": ...}`;

  try {
    const response = await customOpenAIApi.post('/v1/chat/completions', {
      model: "gpt-4o-mini", 
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      max_tokens: 500,
      temperature: 0.7,
      response_format: { type: "json_object" } 
    });
    
    const aiContent = response.data.choices[0].message.content;
    const result = JSON.parse(aiContent);
    res.json(result); 

  } catch (error) {
    const errorMessage = error.response ? JSON.stringify(error.response.data) : error.message;
    console.error('API 錯誤:', errorMessage);
    res.status(500).json({ error: '無法生成任務', details: errorMessage });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
