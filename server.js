const express = require('express');
const axios = require('axios');
const cors = require('cors');

const recentMemory = {
  themes: [],
  activities: []
};

const MAX_RECENT = 3;

const app = express();
app.use(cors());
app.use(express.json());

const API_KEY = process.env.API_KEY;

const customOpenAIApi = axios.create({
  baseURL: 'https://free.v36.cm',
  headers: {
    Authorization: `Bearer ${API_KEY}`,
    'Content-Type': 'application/json'
  }
});

function pickWithCooldown(list, recentList) {
  if (!Array.isArray(list) || list.length === 0) return null;

  const filtered = list.filter(item => !recentList.includes(item));
  const pool = filtered.length ? filtered : list; // 全部被冷卻就放寬

  return randomPick(pool);
}

function randomPick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function normalizeContext(ctx) {
  if (!ctx) return null;
  const s = String(ctx).trim();
  const map = {
    '上課': '上課中',
    '上課中': '上課中',
    '開會': '開會中',
    '開會中': '開會中',
    '通勤': '通勤中',
    '通勤中': '通勤中',
    '辦公桌': '辦公桌工作',
    '辦公桌工作': '辦公桌工作',
    '工作': '辦公桌工作',
    '自習': '自習中',
    '自習中': '自習中',
    '在家': '在家',
    '家務': '在家處理家務',
    '在家處理家務': '在家處理家務',
    '睡前': '睡前',
    '起床': '剛起床',
    '午休': '午休',
    '駕車': '駕車中',
    '開車': '駕車中'
  };
  return map[s] || s;
}

function inferContextFromDescription(description) {
  const d = (description || '').toLowerCase();
  const hits = [];

  const rules = [
    { keys: ['上課', '教室', '老師'], ctx: '上課中' },
    { keys: ['開會', '會議', '簡報'], ctx: '開會中' },
    { keys: ['通勤', '捷運', '公車', '火車', '站牌', '月台'], ctx: '通勤中' },
    { keys: ['開車', '駕車', '方向盤'], ctx: '駕車中' },
    { keys: ['辦公', '工作', '公司', '桌前', '電腦'], ctx: '辦公桌工作' },
    { keys: ['自習', '圖書館'], ctx: '自習中' },
    { keys: ['家裡', '在家', '房間', '宿舍'], ctx: '在家' },
    { keys: ['家務', '打掃', '洗碗', '拖地'], ctx: '在家處理家務' },
    { keys: ['睡前', '要睡', '失眠'], ctx: '睡前' },
    { keys: ['剛起床', '起床', '早上剛醒'], ctx: '剛起床' },
    { keys: ['午休'], ctx: '午休' }
  ];

  for (const r of rules) {
    if (r.keys.some(k => d.includes(k))) hits.push(r.ctx);
  }

  return hits.length ? hits[0] : null;
}

const DATA = {
  "壓力": {
    "呼吸與放鬆": {
      activities: [
        "用計時器做 3 分鐘方形呼吸",
        "從腳到頭的全身伸展配合呼吸"
      ],
      allowed: ["上課中", "開會中", "通勤中", "辦公桌工作", "在家", "在家處理家務", "自習中", "午休", "睡前"],
      avoid: ["駕車中"]
    },
    "正念與覺察": {
      activities: [
        "正念飲食，專注咀嚼味道與口感",
        "3 分鐘自由書寫腦中正在想的事"
      ],
      allowed: ["通勤中", "走路中", "在家", "午休", "睡前", "自習中", "辦公桌工作", "上課中", "開會中"],
      avoid: ["駕車中"]
    },
    "身體活動": {
      activities: [
        "跟著 10 分鐘伸展或暖身影片活動",
        "固定時間做 20 次開合跳或原地踏步"
      ],
      allowed: ["在家", "辦公桌工作", "午休", "下課後", "下班後", "戶外", "公園"],
      avoid: ["上課中", "開會中", "通勤中", "駕車中"]
    },
    "休息與睡眠": {
      activities: [
        "設定晚上不再處理工作或學校訊息的界線",
        "寫下明天要做的三件事讓大腦放下"
      ],
      allowed: ["在家", "睡前", "下班後", "下課後"],
      avoid: ["上課中", "開會中", "通勤中", "駕車中", "辦公桌工作", "自習中", "午休"]
    },
    "時間與優先順序": {
      activities: [
        "寫下今天最重要的 1–3 件事，其他先放後面",
        "把一件大的待辦拆成三個可以在 10 分鐘內完成的小步驟",
        "用番茄鐘安排一輪：25 分鐘專注 + 5 分鐘休息，只做一件事",
        "畫一個簡單的『待辦矩陣』，區分重要/不重要、急/不急"
      ],
      allowed: ["辦公桌工作", "自習中", "在家", "午休", "下班後", "下課後"],
      avoid: ["上課中", "開會中", "通勤中", "駕車中"]
    },
    "環境微調與減壓": {
      activities: [
        "花 3 分鐘把桌面上最礙眼的一小堆東西整理乾淨",
        "調整座位與螢幕位置，讓身體坐得更舒服一點",
        "關掉一個不必要的通知來源（群組、APP 或提醒）",
        "在桌上放一個讓你覺得放鬆的小物（照片、植物、卡片）"
      ],
      allowed: ["辦公桌工作", "自習中", "在家", "午休", "下班後", "下課後"],
      avoid: ["通勤中", "駕車中", "正式開會中"]
    }
  },

  "焦慮": {
    "行為活化與行動": {
      activities: [
        "拍整理前後照片，只整理一小區",
        "設定 5 分鐘計時完成一件拖很久的小事"
      ],
      allowed: ["在家", "週末", "下班後", "下課後", "辦公桌工作", "自習中", "午休"],
      avoid: ["上課中", "開會中", "通勤中", "駕車中"]
    },
    "愉悅與興趣活動": {
      activities: [
        "重聽一張以前喜歡的專輯並回想畫面",
        "嘗試做一道簡單新菜或新飲品"
      ],
      allowed: ["在家", "週末", "下課後", "下班後", "通勤中", "午休"],
      avoid: ["上課中", "開會中", "駕車中"]
    },
    "社會連結與支持": {
      activities: [
        "在社群平台留下真誠的鼓勵留言",
        "詢問熟悉的人最近有沒有開心的小事"
      ],
      allowed: ["在家", "通勤中", "下課後", "下班後", "午休"],
      avoid: ["上課中", "開會中"]
    },
    "自我照顧": {
      activities: [
        "安排一段數位排毒時間",
        "寫一句對自己溫柔的話並貼在顯眼處"
      ],
      allowed: ["在家", "睡前", "週末", "午休", "下課後", "下班後"],
      avoid: ["上課中", "開會中", "通勤中", "駕車中"]
    },
    "擔憂界線與擔心時間": {
      activities: [
        "設定一個 10 分鐘的『擔心時間』，只在這段時間寫下所有擔心的事",
        "擔心時間之外出現焦慮念頭時，先寫在紙上，告訴自己『等到擔心時間再處理』",
        "把目前最擔心的一件事拆成：我能控制的事情 / 我不能控制的事情 兩欄",
        "選一個小行動處理『我能控制』欄位的一件事，其餘先暫時放下"
      ],
      allowed: ["在家", "自習中", "辦公桌工作", "午休", "下班後", "下課後", "週末"],
      avoid: ["上課中", "開會中", "通勤中", "駕車中"]
    },
    "身體覺察與穩定技巧": {
      activities: [
        "做一次 5-4-3-2-1 地面化練習：說出你看到 5 樣東西、摸到 4 樣、聽到 3 種聲音、聞到 2 種味道、想到 1 種味道或感覺",
        "從腳趾到頭頂做一輪身體掃描，注意哪裡緊，哪裡是放鬆的",
        "雙腳平放地面，感受腳掌踩在地上的重量，維持 1–2 分鐘",
        "雙手交握放在腹部，感受 10 次呼吸帶來的起伏感"
      ],
      allowed: ["在家", "辦公桌工作", "自習中", "午休", "睡前", "通勤中（不駕車）"],
      avoid: ["駕車中"]
    }
  },

  "開心": {
    "分享與社交": {
      activities: [
        "拍下喜歡的當下並分享給朋友",
        "和朋友一起玩簡單的小遊戲"
      ],
      allowed: ["在家", "通勤中", "下課後", "下班後", "聚會中", "聚會後", "週末", "午休"],
      avoid: ["上課中", "開會中", "駕車中"]
    },
    "感恩與肯定": {
      activities: [
        "感謝生活中一件平常卻重要的事",
        "把一個小成就說給他人聽"
      ],
      allowed: ["睡前", "在家", "通勤中", "午休", "下課後", "下班後"],
      avoid: ["上課中", "開會中", "駕車中"]
    },
    "創造與表達": {
      activities: [
        "錄一段只給自己聽的心情語音",
        "畫一張心情塗鴉或心情地圖"
      ],
      allowed: ["在家", "週末", "午休", "下課後", "下班後", "安靜角落"],
      avoid: ["上課中", "開會中", "通勤中", "駕車中"]
    },
    "品味與強化正向經驗": {
      activities: [
        "散步時停下來觀察天空或樹 30 秒",
        "用三個形容詞記錄一個開心瞬間"
      ],
      allowed: ["散步中", "喝飲料時", "用餐時", "睡前", "通勤中", "在家", "午休"],
      avoid: ["駕車中"]
    },
    "慶祝與儀式感": {
      activities: [
        "為今天完成的一件小事設計一個 1 分鐘的小慶祝，例如伸懶腰、大喊一聲『完成了』或喝一口喜歡的飲料",
        "拍下一個代表今天成就的畫面，存進『小小勝利』相簿",
        "寫下一句話記錄今天值得慶祝的事情，累積在同一頁",
        "為自己準備一個小小獎勵（例如看一集影集、吃一個點心），專心享受那幾分鐘"
      ],
      allowed: ["在家", "下課後", "下班後", "週末", "午休", "辦公桌工作（短暫休息）"],
      avoid: ["上課中", "開會中", "駕車中"]
    },
    "善行與回饋": {
      activities: [
        "對今天幫助你的人說一句真誠的謝謝，可以是訊息或當面",
        "在網路或生活中主動給出一個小小的鼓勵或讚美",
        "匿名做一件小好事，不求對方知道是你（例如幫忙整理公共空間）",
        "回想最近別人對你做的一件好事，決定用某種方式把這份善意傳下去"
      ],
      allowed: ["在家", "通勤中", "下課後", "下班後", "午休", "辦公桌工作（短暫）"],
      avoid: ["正式上課中", "正式開會中", "駕車中"]
    }
  },

  "疲憊": {
    "休息與充電": {
      activities: [
        "切換姿勢站立 5–10 分鐘",
        "什麼都不做的 5 分鐘發呆時間"
      ],
      allowed: ["辦公桌工作", "自習中", "在家", "下課後", "下班後", "通勤中", "午休"],
      avoid: ["上課中", "開會中"]
    },
    "睡眠與節奏": {
      activities: [
        "睡前一小時調暗燈光",
        "建立固定的起床小儀式"
      ],
      allowed: ["睡前", "剛起床", "在家"],
      avoid: ["上課中", "開會中", "通勤中", "駕車中", "辦公桌工作", "自習中", "午休"]
    },
    "溫和活動": {
      activities: [
        "睡前做腳踝手腕肩頸小幅度旋轉",
        "短距離改走樓梯一次"
      ],
      allowed: ["辦公桌工作", "下課後", "下班後", "在家", "午休"],
      avoid: ["通勤中", "駕車中", "上課中", "開會中"]
    },
    "身心舒緩": {
      activities: [
        "搭配喜歡氣味做深呼吸",
        "用溫熱毛巾熱敷眼睛或頸部"
      ],
      allowed: ["在家", "睡前", "午休", "下課後", "下班後"],
      avoid: ["上課中", "開會中", "通勤中", "駕車中", "辦公桌工作", "自習中"]
    },
    "能量管理與配速": {
      activities: [
        "畫一個簡單的時間軸，標出自己哪幾個時段通常最有精神，哪幾個最累",
        "把需要專注的任務盡量排在自己精神較好的時段，簡單任務排在累的時段",
        "檢查看看今天的行程，能不能刪掉或延後一件其實不那麼重要的安排",
        "為接下來 2 小時訂一個節奏：工作 25 分鐘、休息 5 分鐘，重複兩次"
      ],
      allowed: ["辦公桌工作", "自習中", "在家", "下班後", "下課後", "午休"],
      avoid: ["上課中", "開會中", "通勤中", "駕車中"]
    },
    "界線與說不": {
      activities: [
        "回想最近一次勉強答應的請求，寫下如果當時說『我現在可能沒辦法』會怎麼說",
        "為自己列出一條本週要守住的界線，例如『超過幾點不再回工作訊息』",
        "今天當有人再臨時請你幫忙時，先爭取時間說『我看一下行程再回覆你』",
        "寫下一句你願意用來溫和拒絕別人要求的句子，之後可以直接拿來用"
      ],
      allowed: ["在家", "下班後", "下課後", "週末", "午休", "辦公桌工作（安靜時）"],
      avoid: ["上課中", "開會中", "通勤中", "駕車中"]
    }
  },

  "迷茫": {
    "自我探索": {
      activities: [
        "寫下反覆出現的問題並列三種可能答案",
        "列出最有成就感的三件事找共同點"
      ],
      allowed: ["在家", "自習中", "圖書館", "咖啡廳", "週末", "安靜角落"],
      avoid: ["上課中", "開會中", "通勤中", "駕車中"]
    },
    "價值與方向": {
      activities: [
        "寫下羨慕他人的特質並反思自身價值",
        "想像理想的一天會把時間花在哪"
      ],
      allowed: ["在家", "週末", "安靜角落", "諮商前後", "較長空檔"],
      avoid: ["上課中", "開會中", "通勤中", "駕車中"]
    },
    "資訊與諮詢": {
      activities: [
        "閱讀一篇感興趣領域的介紹或訪談",
        "寫下希望顧問給你的建議"
      ],
      allowed: ["在家", "線上視訊", "學校諮商中心", "辦公室", "咖啡廳"],
      avoid: ["上課中", "開會中", "駕車中"]
    },
    "實驗與嘗試": {
      activities: [
        "留意一次引發好奇的事情並查資料",
        "刻意做一件不同的小選擇"
      ],
      allowed: ["課餘時間", "下班後", "下課後", "週末", "假期", "在家", "戶外"],
      avoid: ["上課中", "開會中", "駕車中"]
    },
    "角色盤點與期待": {
      activities: [
        "列出你現在在生活中扮演的角色（例如學生、朋友、子女、同事）",
        "在每個角色旁邊寫下：你覺得別人期待你是怎樣的人",
        "再寫一欄：你自己希望在這個角色中成為怎樣的人，看看有什麼差異",
        "選一個角色，寫下一個這週可以為自己做的小調整（而不是只滿足別人期待）"
      ],
      allowed: ["在家", "自習中", "圖書館", "咖啡廳", "週末", "安靜角落"],
      avoid: ["上課中", "開會中", "通勤中", "駕車中"]
    },
    "小實驗職涯探索": {
      activities: [
        "選一個你好奇的職業，搜尋一篇相關的訪談或工作日常來閱讀",
        "寫下三個你想像中會喜歡這份工作的原因，和三個可能不喜歡的地方",
        "找一個低成本的方式靠近這個領域，例如看一場線上講座或體驗課",
        "列出一個『本月的小實驗』，例如：和一個在該領域的人約一次資訊訪談"
      ],
      allowed: ["在家", "自習中", "圖書館", "咖啡廳", "週末", "下課後", "下班後"],
      avoid: ["上課中", "開會中", "駕車中"]
    }
  },

  "平靜": {
    "正念與冥想": {
      activities: [
        "1 分鐘只聽環境聲音並數種類",
        "洗手或洗臉時專注水的溫度"
      ],
      allowed: ["在家", "辦公桌工作", "睡前", "清晨", "安靜角落", "午休"],
      avoid: ["駕車中"]
    },
    "穩定日常節奏": {
      activities: [
        "睡前列出明天最重要的 1–3 件事",
        "每天固定做同一件小事"
      ],
      allowed: ["清晨", "晚上", "在家", "週計畫時間", "睡前"],
      avoid: ["上課中", "開會中", "通勤中", "駕車中"]
    },
    "溫和身體活動": {
      activities: [
        "在房間慢慢走一圈覺察腳步重量",
        "播放輕柔音樂做緩慢擺手轉身"
      ],
      allowed: ["在家", "戶外", "散步中", "公園", "辦公室旁空地", "午休"],
      avoid: ["上課中", "開會中", "通勤中", "駕車中"]
    },
    "寧靜環境與儀式": {
      activities: [
        "清理桌面一小塊區域",
        "點小燈或蠟燭安靜坐 3 分鐘"
      ],
      allowed: ["在家", "書桌", "睡前", "工作結束後", "安靜角落"],
      avoid: ["上課中", "開會中", "通勤中", "駕車中"]
    },
    "節奏感與儀式化": {
      activities: [
        "設計一個 3–5 分鐘的晨間小儀式，例如喝水＋伸展＋看窗外",
        "睡前固定做同一個短動作（關燈前深呼吸三次、整理桌面一小區）作為收心信號",
        "選一天，刻意在同一時間做同一個讓你覺得安定的小活動（散步、泡茶等）",
        "寫下你理想的一天節奏，用鉛筆標出一個你想先嘗試的小改變"
      ],
      allowed: ["在家", "清晨", "晚上", "睡前", "週末"],
      avoid: ["上課中", "開會中", "通勤中", "駕車中"]
    },
    "感官安撫": {
      activities: [
        "找一個你喜歡的氣味（茶、精油、乳液），用 1 分鐘專心聞幾次深呼吸",
        "播放一首讓你覺得安定的音樂，只專心聽完前 2–3 分鐘",
        "摸一個觸感讓你舒服的小物（毯子、抱枕、石頭），專注感受觸感 1 分鐘",
        "調整燈光變得柔和一點，或打開一盞小燈，安靜坐著 3 分鐘"
      ],
      allowed: ["在家", "書桌", "睡前", "工作結束後", "安靜角落", "午休"],
      avoid: ["駕車中", "正式會議中", "上課中"]
    }
  }
};

function getStealthHint(emotion, theme, context) {
  const ctx = context || '';
  const stealthContexts = new Set(['上課中', '開會中']);
  if (!stealthContexts.has(ctx)) return '';

  if (emotion === '壓力') {
    if (theme === '呼吸與放鬆' || theme === '正念與覺察') {
      return '使用者可能在上課或開會中，請提供超低調版本：坐姿即可完成、動作幅度極小、不引人注意、不需要拿出紙筆。';
    }
    return '使用者可能在上課或開會中，請避免需要站立、走動、伸展或任何明顯動作，改為坐姿微小動作或注意力引導。';
  }

  if (emotion === '疲憊') {
    if (theme === '休息與充電') {
      return '使用者可能在上課或開會中，請提供不打斷場合的版本：坐姿、短於 60 秒、微小動作或只做注意力切換。';
    }
    return '使用者可能在上課或開會中，請避免任何明顯動作或需要離席的任務，改為更低調版本。';
  }

  if (emotion === '焦慮' || emotion === '開心' || emotion === '迷茫' || emotion === '平靜') {
    return '使用者可能在上課或開會中，請避免需要出聲通話、長時間書寫或拿出工具的任務，改為安靜、低干擾的版本。';
  }

  return '';
}

function chooseThemeAndActivity(emotion, context) {
  const emotionData = DATA[emotion];
  if (!emotionData) return null;

  const themes = Object.keys(emotionData);
  const ctx = context ? normalizeContext(context) : null;

  const eligibleThemes = themes.filter(t => {
    const item = emotionData[t];
    if (!ctx) return true;
    if (Array.isArray(item.avoid) && item.avoid.includes(ctx)) return false;
    if (Array.isArray(item.allowed) && item.allowed.length > 0) return item.allowed.includes(ctx);
    return true;
  });

  const pickThemes = eligibleThemes.length ? eligibleThemes : themes;
  const selectedTheme = pickWithCooldown(
  pickThemes,
  recentMemory.themes
);

  ㄥconst selectedActivity = pickWithCooldown(
  emotionData[selectedTheme].activities,
  recentMemory.activities
);

  return { selectedTheme, selectedActivity, context: ctx };
}

app.get('/', (req, res) => {
  res.send('✅ Mood Gacha AI Server is running');
});

app.post('/generate-task', async (req, res) => {
  const { emotion, description, retry, context } = req.body;

  if (!API_KEY) return res.status(500).json({ error: 'API_KEY 未設定' });
  if (!emotion) return res.status(400).json({ error: '缺少 emotion' });

  const inferred = normalizeContext(context) || inferContextFromDescription(description);
  const picked = chooseThemeAndActivity(emotion, inferred);

  if (!picked) return res.status(400).json({ error: '不支援的情緒類型' });

  const { selectedTheme, selectedActivity } = picked;
  const ctx = picked.context || null;

  let systemPrompt = `你是一個溫暖、具啟發性的心理健康輔導助手。
你的任務是根據用戶選擇的情緒與描述，生成：
1️⃣ 一個個性化的行動任務（具體、有創意、有實際可行步驟、簡單、能快速完成）
2️⃣ 一段真誠的鼓勵或安慰語
3️⃣ 一個介於 -10 到 10 的情緒加權數值

請保持高創意與多樣性：
- 避免重複、籠統、或過於常見的建議
- 若真的適合使用常見活動，請用新的場景或細節呈現
- 可以結合五感、環境、人物互動或創造活動

任務格式：
{
  "task": { "t": "任務標題", "d": "具體步驟（1–3句）", "c": "任務類別" },
  "message": "鼓勵或安慰語",
  "w": -10~10
}

請以純 JSON 格式輸出。`;

  if (retry) {
    systemPrompt += `

這是使用者覺得「不太適合」的情況。
請生成更保守、陪伴型、低負擔、可中斷的任務，避免任何需要努力或提升表現的內容。`;
  }

  const stealthHint = getStealthHint(emotion, selectedTheme, ctx);
  const contextLine = ctx ? `使用者可能處於情境：「${ctx}」。` : '使用者情境未知，請避免需要大動作或依賴特定場地的任務。';

  const userPrompt = `使用者選擇的情緒是：「${emotion}」。
${contextLine}
本次任務主題是：「${selectedTheme}」。
行為提示：「${selectedActivity}」。
使用者補充描述：「${description || '無額外描述'}」。

${stealthHint}

請根據以上條件生成以下 JSON：
{
  "task": { "t": "任務標題", "d": "具體步驟（1–3 句）", "c": "任務類別" },
  "message": "溫柔、不說教的陪伴語",
  "w": -10 到 10 的整數
}`;

  try {
    const response = await customOpenAIApi.post('/v1/chat/completions', {
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      max_tokens: 500,
      temperature: 0.7,
      response_format: { type: 'json_object' }
    });

    const aiContent = response.data.choices?.[0]?.message?.content || '{}';
    const result = JSON.parse(aiContent);

    result.meta = {
      emotion,
      context: ctx || null,
      selectedTheme,
      selectedActivity,
      retry: !!retry
    };
   recentMemory.themes.push(selectedTheme);
  if (recentMemory.themes.length > MAX_RECENT) {
    recentMemory.themes.shift();
  }

  recentMemory.activities.push(selectedActivity);
  if (recentMemory.activities.length > MAX_RECENT) {
    recentMemory.activities.shift();
  }


    res.json(result);
  } catch (error) {
    const errorMessage = error.response ? JSON.stringify(error.response.data) : error.message;
    res.status(500).json({ error: '無法生成任務', details: errorMessage });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});



