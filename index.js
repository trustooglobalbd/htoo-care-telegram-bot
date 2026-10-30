const crypto = require("crypto");
const express = require("express");
const TelegramBot = require("node-telegram-bot-api");
const { GoogleGenAI } = require("@google/genai");

const app = express();
const PORT = process.env.PORT || 8080;
const TOKEN = process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN;
const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_MODEL = (process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL).trim();
const APPS_SCRIPT_URL = process.env.GOOGLE_APPS_SCRIPT_URL;
const APPS_SCRIPT_SECRET = process.env.GOOGLE_APPS_SCRIPT_SECRET;

const LANGUAGES = {
  my: {
    welcome: "မင်္ဂလာပါ။ Htoo Care မှ ကြိုဆိုပါတယ်။",
    chooseLanguage: "ဘာသာစကား ရွေးချယ်ပါ။",
    health: "🩺 ကျန်းမာရေးအချက်အလက်",
    specialist: "🌍 Specialist Consultation",
    location: "သင်ဘယ်နေရာမှာ ရှိပါသလ���။",
    myanmar: "🇲🇲 မြန်မာနိုင်ငံအတွင်း",
    overseas: "🌏 ပြည်ပရောက် မြန်မာ",
    contact: "မြန်မာနိုင်ငံအတွင်းရှိပါက 7887 သို့ ဖုန်းခေါ်ဆိုနိုင်ပါသည်။",
    overseasContact: "ပြည်ပရောက် မြန်မာများအတွက် Specialist Consultation:\n09 442 111 110 (Phone / Viber / Telegram)",
    disclaimer: "ဤအချက်အလက်သည် ကျန်းမာရေးပညာပေးရန်သာ ဖြစ်ပြီး ရောဂါအတည်ပြုခြင်း သို့မဟုတ် ဆေးညွှန်းခြင်း မပြုပါ။"
  },
  en: {
    welcome: "Welcome to Htoo Care.",
    chooseLanguage: "Choose your language.",
    health: "🩺 Health Information",
    specialist: "🌍 Specialist Consultation",
    location: "Where are you currently located?",
    myanmar: "🇲🇲 Inside Myanmar",
    overseas: "🌏 Myanmar citizen abroad",
    contact: "If you are in Myanmar, call 7887.",
    overseasContact: "Specialist Consultation for Myanmar people abroad:\n09 442 111 110 (Phone / Viber / Telegram)",
    disclaimer: "This is general health education, not a diagnosis or prescription."
};
function getText(session, key) {
  const lang = session.language || "my";
  return LANGUAGES[lang]?.[key] || LANGUAGES.my[key] || key;
}

function getConsultationContact(session) {
  if (session.audience === "overseas") {
    return getText(session, "overseasContact");
  }
  return getText(session, "contact");
}

function showLanguageSelection(chatId) {
  return bot.sendMessage(
    chatId,
    "Choose your language / ဘာသာစကားရွေးချယ်ပါ / กรุณาเลือกภาษา",
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: "🇲🇲 မြန်မာ", callback_data: "language_my" }],
          [{ text: "🇬🇧 English", callback_data: "language_en" }],
          [{ text: "🇹🇭 ภาษาไทย", callback_data: "language_th" }]
        ]
      }
    }
  );
}

function showAudienceSelection(chatId, session) {
  return bot.sendMessage(chatId, getText(session, "location"), {
    reply_markup: {
      inline_keyboard: [
        [{
          text: getText(session, "myanmar"),
          callback_data: "audience_myanmar"
        }],
        [{
          text: getText(session, "overseas"),
          callback_data: "audience_overseas"
        }]
      ]
    }
  });
}

app.get("/", (_req, res) => {
  res.status(200).send("Htoo Care Bot is running");
});

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    telegramConfigured: Boolean(TOKEN),
    geminiConfigured: Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim()),
    googleSheetsConfigured: Boolean(APPS_SCRIPT_URL && APPS_SCRIPT_SECRET)
  });
});

app.listen(PORT, () => {
  console.log("Web server running on " + PORT);
});

if (!TOKEN) {
  console.error("Missing TELEGRAM_BOT_TOKEN");
  process.exit(1);
}

const ai = process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim()
  ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY.trim() })
  : null;

console.log("Gemini configuration:", ai ? "present" : "missing");
console.log("Gemini model:", GEMINI_MODEL);

const bot = new TelegramBot(TOKEN, { polling: true });
const sessions = new Map();

async function postToAppsScript(payload) {
  if (!APPS_SCRIPT_URL || !APPS_SCRIPT_SECRET) {
    throw new Error("Google Apps Script environment variables are missing");
  }

  if (!/^https:\/\/script\.google\.com\/macros\/s\/.+\/exec(?:\?.*)?$/.test(APPS_SCRIPT_URL)) {
    throw new Error("GOOGLE_APPS_SCRIPT_URL must be the deployed Apps Script /exec URL");
  }

  const response = await fetch(APPS_SCRIPT_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ ...payload, secret: APPS_SCRIPT_SECRET }),
    redirect: "follow",
    signal: AbortSignal.timeout(25000)
  });

  if (!response.ok) {
    throw new Error("Apps Script HTTP status: " + response.status);
  }

  let result;

  try {
    result = await response.json();
  } catch (_error) {
    throw new Error("Apps Script returned an unreadable response");
  }

  if (!result || result.success !== true || !result.range) {
    throw new Error((result && result.error) || "Google Sheets did not confirm the save");
  }

  console.log("Google Sheets save confirmed:", result.type, result.range);
  return result.range;
}

async function saveHealthRecord(session) {
  if (!session || !session.question || !session.topic) {
    throw new Error("Health record is incomplete");
  }

  return postToAppsScript({
    type: "health",
    requestId: crypto.randomUUID(),
    topic: session.topic,
    question: session.question,
    duration: session.duration || "",
    severity: session.severity || "",
    consent: true
  });
}

async function saveQuizRecord(session) {
  if (!session || !Array.isArray(session.questions) || !session.questions.length) {
    throw new Error("Quiz session is incomplete");
  }

  return postToAppsScript({
    type: "quiz",
    sessionId: session.sessionId,
    quizTopic: session.quizTopic || "Mixed health education",
    score: session.score,
    totalQuestions: session.questions.length,
    percentage: Math.round((session.score / session.questions.length) * 100),
    consent: true
  });
}

const mainMenu = {
  reply_markup: {
    keyboard: [
      ["🩺 ကျန်းမာရေးမေးမြန်းမယ်"],
      ["📚 ကျန်းမာရေးဗဟုသုတ"],
      ["🎯 ကျန်းမာရေး Quiz ဖြေမယ်"],
      ["🌍 ပြည်ပရောက် မြန်မာများအတွက်"],
      ["📞 7887 ကို ဖုန်းဆက်မယ်"]
    ],
    resize_keyboard: true
  }
};

function showMenu(chatId) {
  const current = sessions.get(chatId) || {};

  sessions.set(chatId, {
    language: current.language || "my",
    audience: current.audience || "myanmar"
  });

  return bot.sendMessage(
    chatId,
    "မင်္ဂလာပါ။ Htoo Care မှ ကြိုဆိုပါတယ်။\n\nဝန်ဆောင်မှုတစ်ခုကို ရွေးချယ်ပါ။",
    mainMenu
  );
}

async function sendLongMessage(chatId, message) {
  const chunks = String(message).match(/[\s\S]{1,3900}/g) || ["အဖြေမရရှိပါ။"];

  for (const chunk of chunks) {
    await bot.sendMessage(chatId, chunk);
  }
}

function extractGeminiText(response) {
  if (!response) {
    return "";
  }

  if (typeof response.text === "string" && response.text.trim()) {
    return response.text;
  }

  const candidates = response.candidates || [];
  for (const candidate of candidates) {
    const text = candidate?.content?.parts
      ?.map(part => (typeof part === "string" ? part : part?.text || ""))
      .join("")
      .trim();

    if (text) {
      return text;
    }
  }

  if (Array.isArray(response.parts)) {
    const text = response.parts
      .map(part => (typeof part === "string" ? part : part?.text || ""))
      .join("")
      .trim();
    if (text) {
      return text;
    }
  }

  return "";
}

function buildGeminiHealthPrompt(session) {
  return [
    "You are Htoo Care, a general health education assistant.",
    "Answer in the user's selected language: " +
      ({ my: "Burmese", en: "English", th: "Thai" }[session.language || "my"]) +
      ". Use clear, respectful language. For sexual and reproductive health (SRHR), menstruation, contraception, pregnancy, sexually transmitted infections (STIs) and HIV, use non-judgmental, stigma-free, evidence-based education.",
    "Do not diagnose, prescribe medicines or dosages, or claim to replace a qualified clinician. Do not invent facts or claim a clinician reviewed the response.",
    "Explain that HIV is not transmitted through ordinary everyday contact such as sharing food, hugging, or using the same toilet. Explain that testing and qualified clinical advice are appropriate for STI/HIV questions.",
    "For possible HIV exposure within the past 72 hours, advise urgent contact with a qualified health service to ask about PEP. Do not provide an individual prescription.",
    "If emergency symptoms are described (difficulty breathing, unconsciousness, severe chest pain, heavy bleeding, seizure), advise immediate emergency care.",
    "Avoid asking for names, exact addresses, identity numbers, or other unnecessary personal information.",
    "Topic: " + (session.topic || "General health"),
    "User question: " + (session.question || ""),
    "Duration (if provided): " + (session.duration || "not provided"),
    "Severity (if provided): " + (session.severity || "not provided"),
    "Structure: (1) General information, (2) Safe next steps, (3) When to seek professional or urgent care.",
    "Keep the answer clear and practical. This is education, not a diagnosis."
  ].join("\n");
}

function getGeminiFailureMessage(error) {
  const message = String((error && error.message) || "").toLowerCase();

  if (message.includes("api key") || message.includes("authentication") || message.includes("unauthorized") || message.includes("invalid key")) {
    return "The Gemini API key is invalid or not configured. Please check the deployment environment variables and try again.";
  }

  if (message.includes("quota") || message.includes("rate limit") || message.includes("429")) {
    return "The Gemini service is temporarily unavailable because the request quota limit was reached. Please try again later.";
  }

  if (message.includes("model") || message.includes("not found") || message.includes("404")) {
    return "The configured Gemini model is unavailable or unsupported. Please update GEMINI_MODEL to a supported model.";
  }

  if (message.includes("timed out") || message.includes("network") || message.includes("fetch") || message.includes("failed to fetch")) {
    return "The Gemini service could not be reached right now. Please try again in a moment.";
  }

  if (message.includes("empty response")) {
    return "The AI service returned no usable answer. Please try again.";
  }

  return "The health assistant is temporarily unavailable. Please try again later or contact a qualified healthcare professional.";
}

async function getGeminiHealthAnswer(session) {
  if (!process.env.GEMINI_API_KEY || !process.env.GEMINI_API_KEY.trim()) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  if (!ai) {
    throw new Error("Gemini client is not initialized");
  }

  const prompt = buildGeminiHealthPrompt(session);
  let timeoutId;

  try {
    const response = await Promise.race([
      ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: prompt
      }),
      new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error("Gemini request timed out after 30 seconds"));
        }, 30000);
      })
    ]);

    const answer = extractGeminiText(response);

    if (!answer || !answer.trim()) {
      throw new Error("Gemini returned an empty response");
    }

    return answer.trim();
  } catch (error) {
    console.error("Gemini request failed:", {
      model: GEMINI_MODEL,
      message: error && error.message,
      status: error && error.status,
      name: error && error.name
    });
    throw error;
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

const articles = {
  "🌞 အပူဒဏ်ကာကွယ်ရေး": "အပူပြင်းချိန်တွင် ရေကို ပုံမှန်သောက်ပါ၊ အရိပ်ရပြီ အရိပ်ရပါ။ အပူဒဏ်သက်ရောက်မှုကို တိုးနည်းအောင် တင်းကျပ်တဲ့ အဝတ်အစား ဝတ်ဆင်ပါ။",
  "🥗 အာဟာရနှင့် ကျန်းမာရေး": "အာဟာရမျှတစေရန် အစားအစာအမျိုးမျိုးကို သင့်တော်တဲ့ အရည်အချင်းဖြင့် စားသုံးပါ။",
  "🌸 SRHR": "လိင်နှင့် မျိုးဆက်ပွားကျန်းမာရေး (SRHR) တွင် ရာသီလာခြင်း၊ သန္ဓေတားနည်းရွေးချယ်မှု၊ မိခင်နှင့်ကလေးကျန်းမာရေးနှင့် အခွင့်အရေးများ ပါဝင်သည်။",
  "🛡️ STI/HIV": "STI/HIV အကြောင်း သိထားရန် — STI အချို့တွင် လက္ခဏာမပြနိုင်ပါ။ စစ်ဆေးမှုနှင့် ကျန်းမာရေးဝန်ထမ်း၏ အကြံပြုချက်ကို မေးမြန်းပါ။",
  "🤰 မိခင်နှင့် ကလေးကျန်းမာရေး": "ကိုယ်ဝန်ဆောင်စောင့်ရှောက်မှုနှင့် ကလေးကျန်းမာရေးကို မိခင်နှင့်ကလေးစောင့်ရှောက်မှု ပါ ငဲ့ရရန်ကျန်ပါသည်။",
  "🩺 လက္ခဏာများရှိလျှင်": "ဤ Bot သည် ရောဂါအတည်ပြုခြင်း သို့မဟုတ် ဆေးညွှန်းခြင်း မပြုပါ။ အရေးပေါ်လက္ခဏာများရှိပါက ချက်ချင်း ကျန်းမာရေးဝန်ထမ်းနှင့် ဆက်သွယ်ပါ။"
};

const quizBank = [
  {
    topic: "SRHR",
    q: "SRHR ဆိုသည်မှာ ဘာကို အဓိကထားသနည်း။",
    options: ["လိင်နှင့် မျိုးဆက်ပွားကျန်းမာရေးနှင့် အခွင့်အရေး", "အစားအသောက်တစ်ခုတည်း", "ခြင်းတစ်ခု အပင်", "သိုင်းအမူအရာများ"],
    answer: 0,
    explain: "SRHR သည် လိင်နှင့် မျိုးဆက်ပွားကျန်းမာရေး၊ သတင်းအချက်အလက်နှင့် အခွင့်အရေးများ ပါဝင်သော ကျန်းမာရေးကို ဆိုလိုသည်။"
  },
  {
    topic: "STI/HIV",
    q: "HIV သည် အောက်ပါတို့အနက် ဘယ်အရာမှ ပုံမှန်အားဖြင့် မကူးစက်သနည်း။",
    options: ["အန္တရာယ်ရှိသော သွေးထိတွေ့မှု", "အတူစားသောက်ခြင်းနှင့် ပွေ့ဖက်ခြင်း", "မိတ်ဆက်ဆက်ဆံခြင်း", "မစစ်ဆေးထားသည့် လိင်ဆက်ဆံမှု"],
    answer: 1,
    explain: "အတူစားသောက်ခြင်း၊ ပွေ့ဖက်ခြင်း၊ အိမ်သာအတူသုံးခြင်းတို့မှ HIV မကူးစေပါ။"
  },
  {
    topic: "STI/HIV",
    q: "STI အချို့တွင် ဘာဖြစ်နိုင်သနည်း။",
    options: ["လက္ခဏာမပြနိုင်ပါ", "အမြဲတမ်း ချက်ချင်းလက္ခဏာပြသည်", "စစ်ဆေးစရာမလိုပေ", "အစာမစားနိုင်"],
    answer: 0,
    explain: "STI အချို့သည် လက္ခဏာမပြနိုင်သဖြင့် လိုအပ်ပါက စစ်ဆေးမှုနှင့် ကျန်းမာရေးဝန်ထမ်းဆိုင်ရာအကြံဉာဏ်ကို မေးမြန်းပါ။"
  },
  {
    topic: "STI/HIV",
    q: "ဖြစ်နိုင်သော HIV ထိတွေ့မှုသည် 72 နာရီအတွင်း ဖြစ်ခဲ့လျှင် ဘာလုပ်သင့်သနည်း။",
    options: ["ဘာမှမလုပ်ဘဲ စောင့်ပါ", "PEP အကြောင်း မေးမြန်းရန် ကျန်းမာရေးဝန်ဆောင်မှုသို့ ချက်ချင်းဆက်သွယ်ပါ", "အတူစားမယ်", "မလုပ်ပါ"],
    answer: 1,
    explain: "PEP သည် အချိန်မီ စတင်ရန်လိုအပ်နိုင်သဖြင့် ချက်ချင်း ကျန်းမာရေးဝန်ဆောင်မှုနှင့် တိုင်ပင်ပါ။"
  },
  {
    topic: "SRHR",
    q: "သန္ဓေတားနည်းရွေးချယ်ရာတွင် ဘယ်နည်းလမ်းက သင့်တော်သနည်း။",
    options: ["လူတိုင်းအတွက် နည်းတစ်မျိုးတည်း", "မိမိကျန်းမာရေးနှင့် လိုအပ်ချက်အရ ရွေးချယ်ခြင်း", "တစ်ခြားသူက ရွေးထားတဲ့ပုံစံ", "မရွေးချယ်ဘဲထားပါ"],
    answer: 1,
    explain: "နည်းလမ်းများတွင် အကျိုးကျေးဇူးနှင့် ကန့်သတ်ချက်များ ကွာခြားနိုင်သဖြင့် မိမိအခြေအနေအရ စဉ်းစားသင့်သည်။"
  },
  {
    topic: "SRHR",
    q: "လိင်ဆက်ဆံမှုတွင် သဘောတူညီမှုသည် မည်သို့ဖြစ်သင့်သနည်း။",
    options: ["လွတ်လပ်စွာ၊ ဖိအားမရှိဘဲ ပေးထားရမည်", "တစ်ကြိမ်ပေးလျှင် အမြဲတမ်းဖြစ်ပေမည်", "မပေးလည်းရမည်", "အတူဆက်ဆံသည့်အချိန်တွင်ပင် ပြောရန်မလို"],
    answer: 0,
    explain: "သဘောတူညီမှုသည် လွတ်လပ်စွာပေးရပြီး အချိန်မရွေး ပြန်လည်ရုပ်သိမ်းနိုင်ပါသည်။"
  },
  {
    topic: "Menstrual health",
    q: "ရာသီလာခြင်းနှင့်ပတ်သက်၍ စိုးရိမ်ရသော လက္ခဏာတစ်ခုရှိပါက ဘာလုပ်သင့်သနည်း။",
    options: ["အမြဲလျစ်လျူရှုပါ", "ကျန်းမာရေးဝန်ထမ်းနှင့် တိုင်ပင်ပါ", "အခြားသူ၏ဆေးကို စမ်းသပ်ပါ", "အချိန်မရွေးမရ"],
    answer: 1,
    explain: "သွေးထွက်အလွန်များခြင်း၊ ပြင်းထန်သောနာကျင်မှု သို့မဟုတ် မူးဝေခြင်းရှိပါက ကျန်းမာရေးဝန်ထမ်းနှင့် တိုင်ပင်ရန် လိုအပ်သည်။"
  },
  {
    topic: "General health",
    q: "ကျန်းမာရေး Bot မှ အဖြေကို ဘယ်လိုအသုံးပြုသင့်သနည်း။",
    options: ["ဆရာဝန်အစား အမြဲတမ်းအသုံးပြုပါ", "အထွေထွေပညာပေးအဖြစ်သာယူပြီး လိုအပ်ပါက ကျန်းမာရေးဝန်ထမ်းနှင့် တိုင်ပင်ပါ", "မသုံးပါ", "အတတ်ပညာမဟုတ်"],
    answer: 1,
    explain: "Bot အဖြေသည် ပညာပေးအတွက်သာဖြစ်ပြီး ရောဂါအတည်ပြုခြင်း သို့မဟုတ် ဆေးညွှန်းခြင်းမပြုပါ။"
  },
  {
    topic: "STI/HIV",
    q: "HIV အခြေအနေကို သိရှိရန် အထောက်အကူအဖြစ် ဘာက အရေးကြီးသနည်း။",
    options: ["အခြားသူကိုကြည့်ပြီး ခန့်မှန်းခြင်း", "သင့်တော်သော HIV စစ်ဆေးမှု", "အတုအယောင်သတင်း", "မစစ်ဆေးဘဲ နေမည်"],
    answer: 1,
    explain: "HIV အခြေအနေကို ခန့်မှန်း၍မရပါ။ သင့်တော်သောစစ်ဆေးမှုနှင့် ကျန်းမာရေးဝန်ထမ်း၏ အကြံပြုချက်ကို ရယူရန် လိုအပ်သည်။"
  },
  {
    topic: "SRHR",
    q: "ကျန်းမာရေးအကြောင်းအရာမေးမြန်းရာတွင် ဘယ်အချက်အလက်တွေကို မပို့သင့်သနည်း။",
    options: ["ကျန်းမာရေးမေးခွန်း", "မလိုအပ်သော အမည်၊ မှတ်ပုံတင်နံပါတ်နှင့် လိပ်စာအချက်အလက်", "အချိန်အတိုင်းအတာ", "ပြင်းထန်မှု"],
    answer: 1,
    explain: "ကိုယ်ရေးအချက်အလက်ကို ကာကွယ်ရန် မလိုအပ်သော အမည်၊ ID နှင့် လိပ်စာများ မပို့သင့်ပါ။"
  }
];

function shuffle(items) {
  const arr = items.map(item => ({ ...item }));

  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }

  return arr;
}

function sendQuizQuestion(chatId, session) {
  const q = session.questions[session.index];
  const keyboard = q.options.map((option, i) => [
    { text: option, callback_data: "quiz_answer_" + i }
  ]);

  return bot.sendMessage(
    chatId,
    "🎯 Quiz (" + (session.index + 1) + "/" + session.questions.length + ")\nအကြောင်းအရာ: " + q.topic + "\n\n" + q.q,
    { reply_markup: { inline_keyboard: keyboard } }
  );
}

bot.onText(/^\/start$/, msg => {
  sessions.set(msg.chat.id, {
    language: "my",
    audience: "myanmar"
  });

  return showLanguageSelection(msg.chat.id);
});

bot.onText(/^\/cancel$/, msg => showMenu(msg.chat.id));
bot.onText(/^\/quiz$/, msg => startQuizConsent(msg.chat.id));

function startQuizConsent(chatId) {
  const current = sessions.get(chatId) || {};

  sessions.set(chatId, {
    ...current,
    step: "quiz_consent",
    sessionId: crypto.randomUUID()
  });

  return bot.sendMessage(
    chatId,
    "Quiz ကို အကြိမ်အကန့်အသတ်မရှိ ထပ်ဖြေနိုင်ပါတယ်။ မေးခွန်းအစုံကို ပြန်လည်ရယူနိုင်ပြီး အမှတ်ကို အမည်မပါဘဲ သိမ်းဆည်းနိုင်ပါသည်။",
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: "အမှတ်ကို အမည်မပါဘဲ သိမ်းမယ်", callback_data: "quiz_save_yes" }],
          [{ text: "မသိမ်းဘဲ Quiz ဖြေမယ်", callback_data: "quiz_save_no" }]
        ]
      }
    }
  );
}

bot.on("message", async msg => {
  if (!msg.text) return;

  const chatId = msg.chat.id;
  const text = msg.text.trim();

  if (text.startsWith("/")) return;

  if (text === "🩺 ကျန်းမာရေးမေးမြန်းမယ်") {
    const current = sessions.get(chatId) || {};

    sessions.set(chatId, {
      ...current,
      step: "health_topic"
    });

    return bot.sendMessage(
      chatId,
      "အကြောင်းအရာကို ရွေးပါ။",
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: "အထွေထွေကျန်းမာရေး", callback_data: "healthtopic_general" }],
            [{ text: "🌸 SRHR", callback_data: "healthtopic_srhr" }],
            [{ text: "🩸 ရာသီလာခြင်း", callback_data: "healthtopic_menstrual" }],
            [{ text: "🤰 ကိုယ်ဝန်ဆောင်ကျန်းမာရေး", callback_data: "healthtopic_pregnancy" }],
            [{ text: "🛡️ STI/HIV", callback_data: "healthtopic_sti" }]
          ]
        }
      }
    );
  }

  if (text === "📚 ကျန်းမာရေးဗဟုသုတ") {
    return bot.sendMessage(
      chatId,
      "ဖတ်ရှုလိုသော အကြောင်းအရာကို ရွေးပါ။",
      {
        reply_markup: {
          keyboard: [
            ["🌞 အပူဒဏ်ကာကွယ်ရေး"],
            ["🥗 အာဟာရနှင့် ကျန်းမာရေး"],
            ["🌸 SRHR"],
            ["🛡️ STI/HIV"],
            ["🤰 မိခင်နှင့် ကလေးကျန်းမာရေး"],
            ["🩺 လက္ခဏာများရှိလျှင်"],
            ["🏠 ပင်မမီနူး"]
          ],
          resize_keyboard: true
        }
      }
    );
  }

  if (articles[text]) {
    return bot.sendMessage(chatId, articles[text], mainMenu);
  }

  if (text === "🎯 ကျန်းမာရေး Quiz ဖြေမယ်") {
    return startQuizConsent(chatId);
  }

  if (text === "🌍 ပြည်ပရောက် မြန်မာများအတွက်") {
    const session = sessions.get(chatId) || {
      language: "my",
      audience: "overseas"
    };

    session.audience = "overseas";
    sessions.set(chatId, session);

    return bot.sendMessage(
      chatId,
      getConsultationContact(session),
      mainMenu
    );
  }

  if (text === "📞 7887 ကို ဖုန်းဆက်မယ်") {
    return bot.sendMessage(
      chatId,
      "မြန်မာနိုင်ငံအတွင်းမှ ကျန်းမာရေးတိုင်ပင်ရန် 7887 သို့ ဖုန်းဆက်နိုင်ပါသည်။",
      mainMenu
    );
  }

  if (text === "🏠 ပင်မမီနူး") {
    return showMenu(chatId);
  }

  const session = sessions.get(chatId);
  if (!session) return;

  if (session.step === "health_question") {
    if (text.length < 2 || text.length > 1500) {
      return bot.sendMessage(chatId, "မေးခွန်းကို စာလုံး 2 မှ 1500 အတွင်း ရေးပေးပါ။");
    }

    session.question = text;
    session.step = "health_duration";

    return bot.sendMessage(
      chatId,
      "ဤပြဿနာဖြစ်လာတာ ဘယ်လောက်ကြာပြီလဲ။ မသက်ဆိုင်ပါက “မသက်ဆိုင်” ဟုရေးပါ။"
    );
  }

  if (session.step === "health_duration") {
    session.duration = text.slice(0, 100);
    session.step = "health_severity";

    return bot.sendMessage(
      chatId,
      "ပြင်းထန်မှုကို ရွေးပါ။",
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: "အနည်းငယ်", callback_data: "severity_mild" }],
            [{ text: "အလယ်အလတ်", callback_data: "severity_moderate" }],
            [{ text: "ပြင်းထန်", callback_data: "severity_severe" }],
            [{ text: "မသက်ဆိုင်", callback_data: "severity_na" }]
          ]
        }
      }
    );
  }
});

bot.on("callback_query", async query => {
  const chatId = query.message && query.message.chat && query.message.chat.id;
  if (!chatId) return;

  const data = query.data || "";
  let session = sessions.get(chatId) || {
    language: "my",
    audience: "myanmar"
  };

  await bot.answerCallbackQuery(query.id).catch(() => {});

  if (data.startsWith("language_")) {
    const selected = data.slice("language_".length);

    if (!LANGUAGES[selected]) return;

    session.language = selected;
    session.step = "choose_audience";
    sessions.set(chatId, session);

    return showAudienceSelection(chatId, session);
  }

  if (data === "audience_myanmar" || data === "audience_overseas") {
    session.audience = data === "audience_overseas" ? "overseas" : "myanmar";
    delete session.step;

    sessions.set(chatId, session);

    await bot.sendMessage(chatId, getConsultationContact(session));
    return showMenu(chatId);
  }

  if (!sessions.has(chatId)) return;

  if (data.startsWith("healthtopic_") && session.step === "health_topic") {
    const map = {
      healthtopic_general: "General health",
      healthtopic_srhr: "SRHR",
      healthtopic_menstrual: "Menstrual health",
      healthtopic_pregnancy: "Maternal health",
      healthtopic_sti: "STI/HIV"
    };

    if (!map[data]) return;

    session.topic = map[data];
    session.step = "health_ai_consent";

    return bot.sendMessage(
      chatId,
      "ကိုယ်ရေးလုံခြုံမှု အသိပေးချက် — သင့်မေးခွန်းကို AI ဝန်ဆောင်မှုသို့ ပို့ပေးရမည်ဖြစ်ပြီး ကျန်းမာရေးပညာပေးအဖြစ်သာ အသုံးပြုမည်။",
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: "နားလည်ပါပြီ၊ ဆက်လုပ်မယ်", callback_data: "health_ai_yes" }],
            [{ text: "မဆက်လုပ်တော့ပါ", callback_data: "health_ai_no" }]
          ]
        }
      }
    );
  }

  if (data === "health_ai_no" && session.step === "health_ai_consent") {
    sessions.delete(chatId);

    return bot.sendMessage(
      chatId,
      "AI သို့ မေးခွန်းမပို့ပါ။ ကျန်းမာရေးဗဟုသုတကို ဖတ်ရှုနိုင်သည် သို့မဟုတ် 7887 ကို ဆက်သွယ်နိုင်ပါသည်။",
      mainMenu
    );
  }

  if (data === "health_ai_yes" && session.step === "health_ai_consent") {
    session.step = "health_question";

    return bot.sendMessage(
      chatId,
      "မေးခွန်းကို ရေးပေးပါ။ အမည်၊ မှတ်ပုံတင်နံပါတ်၊ ဖုန်းနံပါတ်၊ လိပ်စာကဲ့သို့ မလိုအပ်သော ကိုယ်ရေးအချက်အလက် မပို့ပါရန် သတိပေးထားပါသည်။"
    );
  }

  if (data.startsWith("severity_") && session.step === "health_severity") {
    const map = {
      severity_mild: "Mild",
      severity_moderate: "Moderate",
      severity_severe: "Severe",
      severity_na: "Not applicable"
    };

    if (!map[data]) return;

    session.severity = map[data];

    if (data === "severity_severe") {
      await bot.sendMessage(
        chatId,
        "ပြင်းထန်သည်ဟု ရွေးထားပါသည်။ အသက်ရှူရခက်ခြင်း၊ သတိလစ်ခြင်း၊ ရင်ဘတ်နာခြင်း၊ ကြွက်သားအတော်များများ ရုတ်တရက်ရှိပါက ချက်ချင်း ကျန်းမာရေးဝန်ထမ်းနှင့် ဆက်သွယ်ပါ။"
      );
    }

    session.step = "health_consent";

    try {
      await bot.sendMessage(chatId, "အထွေထွေကျန်းမာရေးအချက်အလက်ကို ပြင်ဆင်နေပါတယ်။");

      let answer = await getGeminiHealthAnswer(session);

      answer += "\n\n" + getConsultationContact(session);
      answer += "\n\n" + getText(session, "disclaimer");

      await sendLongMessage(chatId, answer);
    } catch (error) {
      const friendlyMessage = getGeminiFailureMessage(error);
      console.error("Gemini response failed:", { message: error && error.message, model: GEMINI_MODEL });

      await bot.sendMessage(
        chatId,
        friendlyMessage + "\n\n" + getConsultationContact(session)
      );

      sessions.delete(chatId);

      return bot.sendMessage(
        chatId,
        "ပင်မမီနူးသို့ ပြန်သွားနိုင်ပါသည်။",
        mainMenu
      );
    }

    return bot.sendMessage(
      chatId,
      "သင်၏ မေးခွန်းနှင့် အကြောင်းအရာကို Google Sheets ထဲ အမည်နှင့် Telegram ID မပါဘဲ သိမ်းဆည်းနိုင်ပါသည်။",
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: "သဘောတူပြီး သိမ်းမယ်", callback_data: "health_save_yes" }],
            [{ text: "မသိမ်းပါနဲ့", callback_data: "health_save_no" }]
          ]
        }
      }
    );
  }

  if (data === "health_save_no" && session.step === "health_consent") {
    sessions.delete(chatId);

    return bot.sendMessage(
      chatId,
      "ဒေတာကို Google Sheets ထဲ မသိမ်းပါ။",
      mainMenu
    );
  }

  if (data === "health_save_yes" && session.step === "health_consent") {
    try {
      const range = await saveHealthRecord(session);

      sessions.delete(chatId);

      return bot.sendMessage(
        chatId,
        "ဒေတာသိမ်းဆည်းမှု အောင်မြင်ပါပြီ။\nမှတ်တမ်းနေရာ: " +
          range +
          "\n\nBot သည် ရောဂါအတည်ပြုခြင်း သို့မဟုတ် ဆေးညွှန်းခြင်း မပြုပါ။",
        mainMenu
      );
    } catch (error) {
      console.error("Google Sheets health save failed:", error && error.message);

      return bot.sendMessage(
        chatId,
        "ဒေတာသိမ်းဆည်းမှု မအောင်မြင်ပါ။ အောင်မြင်ကြောင်း မအတည်ပြုနိုင်သေးပါ။",
        mainMenu
      );
    }
  }

  if (
    (data === "quiz_save_yes" || data === "quiz_save_no") &&
    session.step === "quiz_consent"
  ) {
    session.saveQuiz = data === "quiz_save_yes";
    session.step = "quiz";
    session.questions = shuffle(quizBank);
    session.quizTopic = "Mixed health education";
    session.index = 0;
    session.score = 0;
    session.sessionId = crypto.randomUUID();

    return sendQuizQuestion(chatId, session);
  }

  if (data.startsWith("quiz_answer_") && session.step === "quiz") {
    const chosen = Number(data.slice("quiz_answer_".length));
    const q = session.questions[session.index];

    if (!q || !Number.isInteger(chosen) || chosen < 0 || chosen >= q.options.length) {
      return;
    }

    const correct = chosen === q.answer;

    if (correct) {
      session.score += 1;
    }

    await bot.sendMessage(
      chatId,
      (correct ? "✅ မှန်ပါတယ်။\n" : "❌ မမှန်သေးပါ။\n") + q.explain
    );

    session.index += 1;

    if (session.index < session.questions.length) {
      return sendQuizQuestion(chatId, session);
    }

    const percent = Math.round(
      (session.score / session.questions.length) * 100
    );

    let ending =
      "🎉 Quiz ပြီးပါပြီ။\nအမှတ်: " +
      session.score +
      "/" +
      session.questions.length +
      " (" +
      percent +
      "%)\n\nQuiz ကို ထပ်ဖြေလိုပါက “🎯 ကျန်းမာရေး Quiz ဖြေမယ်” ကို နှိပ်ပါ။";

    if (session.saveQuiz) {
      try {
        const range = await saveQuizRecord(session);

        ending +=
          "\n\nအမည်/Telegram ID မပါသော အမှတ်မှတ်တမ်းကို သိမ်းဆည်းပြီးပါပြီ (" +
          range +
          ")။";
      } catch (error) {
        console.error("Google Sheets quiz save failed:", error && error.message);

        ending +=
          "\n\nမှတ်ချက်: Quiz အမှတ်ကို Google Sheets ထဲ သိမ်းဆည်းမရသေးပါ။ Hosting Variables နှင့် Google Sheet permission ကို စစ်ဆေးပါ။";
      }
    } else {
      ending +=
        "\n\nသင်ရွေးချယ်ထားသည့်အတိုင်း အမှတ်ကို Google Sheets ထဲ မသိမ်းပါ။";
    }

    sessions.delete(chatId);

    return bot.sendMessage(chatId, ending, mainMenu);
  }
});

bot.on("polling_error", error => {
  console.error("Telegram polling error:", error && error.message);
});

bot.on("error", error => {
  console.error("Telegram bot error:", error && error.message);
});

console.log("Htoo Care Telegram Bot started.");
