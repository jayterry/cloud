const express = require('express');
const axios = require('axios');
const cors = require('cors');
const app = express();

// 1. CORS 配置 (允許前端連線)
app.use(cors());

// 解析 JSON 請求
app.use(express.json());

// ✅ 安全寫法：強制程式去讀取系統變數，程式碼裡完全不留痕跡
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// (選擇性) 加一個檢查，如果沒讀到 Key 就報錯，方便 Debug
if (!GEMINI_API_KEY) {
  console.error("❌ 嚴重錯誤：找不到 GEMINI_API_KEY，請確認 Render 環境變數是否已設定！");
  process.exit(1); // 強制停止伺服器
}
// Gemini 的模型設定
const GEMINI_MODEL = 'gemini-1.5-flash-001';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

// **🌟 健康檢查路由 (讓 Render 知道服務活著)**
app.get("/", (req, res) => {
  res.send("✅ Mood Gacha Gemini Server is running!");
});

// 路由：生成個性化任務與情緒加權
app.post('/generate-task', async (req, res) => {
  const { emotion, description } = req.body;

  console.log(`收到請求 - 心情: ${emotion}, 描述: ${description}`);

  if (!emotion) {
    return res.status(400).json({ error: "emotion is required" });
  }

  // 1. 構建給 Gemini 的提示詞 (Prompt)
  const prompt = `
你是一個心理健康輔導助手。請針對當前情緒「${emotion}」和描述「${description || '無'}」，生成一個自我療癒任務。

請嚴格遵守以下規則：
1. 任務要具體、輕量、可執行。
2. 輸出一律為 **純 JSON 格式**，不要包含 Markdown 標記 (如 \`\`\`json)。
3. JSON 結構必須如下：
{
  "task": {
    "t": "任務標題 (15字內)",
    "d": "任務說明 (具體步驟)",
    "c": "分類 (如: 放鬆, 感恩, 覺察)",
    "color": "適合該心情的HEX色碼"
  },
  "message": "一句溫暖的鼓勵語",
  "w": 情緒權重整數 (-2 到 2)
}
  `;

  try {
    // 2. 調用 Gemini API (使用 axios)
    const response = await axios.post(GEMINI_URL, {
      contents: [{
        parts: [{ text: prompt }]
      }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 500
      }
    }, {
      headers: { 'Content-Type': 'application/json' }
    });

    // 3. 解析 Gemini 回傳的資料
    const candidate = response.data.candidates?.[0];
    if (!candidate) {
      throw new Error("Gemini 沒有回傳任何內容");
    }

    let rawText = candidate.content.parts[0].text;
    
    // 清理可能存在的 Markdown 符號 (Gemini 有時會雞婆加上 ```json ...)
    rawText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();

    const result = JSON.parse(rawText);
    
    // 回傳成功結果給前端
    res.json(result);

  } catch (error) {
    // 錯誤處理
    const errorMsg = error.response?.data?.error?.message || error.message;
    console.error('❌ Gemini API 錯誤:', errorMsg);
    res.status(500).json({ error: '任務生成失敗', details: errorMsg });
  }
});

// **🌟 使用 Render 提供的 PORT**
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});




