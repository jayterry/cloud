const express = require('express');
const axios = require('axios');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

// ✅ Render 自動提供 PORT（不可硬寫 3000）
const port = process.env.PORT || 3000;

// ✅ 用環境變數存放金鑰
const API_KEY = process.env.API_KEY;

// ✅ 設置第三方 API 請求
const customOpenAIApi = axios.create({
  baseURL: 'https://free.v36.cm',
  headers: {
    'Authorization': `Bearer ${API_KEY}`,
    'Content-Type': 'application/json'
  }
});

// 🎯 路由：生成個性化任務與情緒加權
app.post('/generate-task', async (req, res) => {
  const { emotion, description } = req.body;

  const systemPrompt = `你是一個溫暖、具啟發性的心理健康輔導助手。請根據用戶的情緒生成一個任務與情緒加權，格式為：
  {"task": {"t": "...", "d": "...", "c": "..."}, "w": ...}`;

  const userPrompt = `當前情緒：「${emotion}」，描述：「${description || '無額外描述'}」`;

  try {
    const response = await customOpenAIApi.post('/v1/chat/completions', {
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.7,
      response_format: { type: "json_object" }
    });

    const content = response.data.choices[0].message.content;
    const result = JSON.parse(content);
    res.json(result);

  } catch (error) {
    console.error("第三方 API 錯誤:", error.response?.data || error.message);
    res.status(500).json({ error: "AI 任務生成失敗，請稍後再試。" });
  }
});

app.listen(port, () => {
  console.log(`✅ Server running on port ${port}`);
});
