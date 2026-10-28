const crypto = require("crypto");
const express = require("express");
const TelegramBot = require("node-telegram-bot-api");
const { GoogleGenAI } = require("@google/genai");
const { google } = require("googleapis");

const app = express();
const PORT = process.env.PORT || 8080;
const TOKEN = process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.8-flash";
const SHEET_ID = process.env.GOOGLE_SHEET_ID;
const HEALTH_TAB = "HealthRecords";
const QUIZ_TAB = "QuizResults";
const DASHBOARD_TAB = "Dashboard";

app.get("/", (_req, res) => res.status(200).send("Htoo Care Bot is running"));
app.get("/health", (_req, res) => res.json({
  status: "ok",
  telegramConfigured: Boolean(TOKEN),
  geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
  googleSheetsConfigured: Boolean(SHEET_ID && (process.env.GOOGLE_SERVICE_ACCOUNT_JSON || process.env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64))
}));
app.listen(PORT, () => console.log("Web server running on " + PORT));

if (!TOKEN) {
  console.error("Missing TELEGRAM_BOT_TOKEN");
  process.exit(1);
}

const ai = process.env.GEMINI_API_KEY
  ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
  : null;
const bot = new TelegramBot(TOKEN, { polling: true });
const sessions = new Map();
let sheetsApi = null;
let sheetsReady = false;

const healthHeaders = ["Timestamp UTC", "Request ID", "Topic", "Question / Concern", "Duration", "Severity", "Consent"];
const quizHeaders = ["Timestamp UTC", "Session ID", "Quiz Topic", "Score", "Total Questions", "Percentage", "Consent"];

function parseServiceAccountCredentials() {
  const b64 = process.env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64;
  const rawValue = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  const raw = b64 && b64.trim()
    ? Buffer.from(b64.trim(), "base64").toString("utf8")
    : (rawValue || "").trim();
  if (!raw) throw new Error("Missing Google service account credentials");
  let credentials;
  try { credentials = JSON.parse(raw); }
  catch (_e) { throw new Error("Google service account credentials are not valid JSON"); }
  if (!credentials || credentials.type !== "service_account" || !credentials.client_email || !credentials.private_key) {
    throw new Error("Google service account JSON is missing required fields");
  }
  return credentials;
}

async function getSheetsApi() {
  if (sheetsApi) return sheetsApi;
  if (!SHEET_ID) throw new Error("Missing GOOGLE_SHEET_ID");
  const auth = new google.auth.GoogleAuth({
    credentials: parseServiceAccountCredentials(),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"]
  });
  sheetsApi = google.sheets({ version: "v4", auth });
  return sheetsApi;
}

async function ensureDataTabs() {
  if (sheetsReady) return;
  const sheets = await getSheetsApi();
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
  const existing = new Set((meta.data.sheets || []).map(s => s.properties.title));
  const requests = [];
  if (!existing.has(HEALTH_TAB)) requests.push({ addSheet: { properties: { title: HEALTH_TAB } } });
  if (!existing.has(QUIZ_TAB)) requests.push({ addSheet: { properties: { title: QUIZ_TAB } } });
  if (!existing.has(DASHBOARD_TAB)) requests.push({ addSheet: { properties: { title: DASHBOARD_TAB } } });
  if (requests.length) await sheets.spreadsheets.batchUpdate({ spreadsheetId: SHEET_ID, requestBody: { requests } });

  for (const [tab, headers] of [[HEALTH_TAB, healthHeaders], [QUIZ_TAB, quizHeaders]]) {
    const check = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: tab + "!A1:G1" }).catch(() => ({ data: { values: [] } }));
    if (!check.data.values || !check.data.values.length) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: SHEET_ID,
        range: tab + "!A1",
        valueInputOption: "RAW",
        requestBody: { values: [headers] }
      });
    }
  }

  const dashboard = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: DASHBOARD_TAB + "!A1:B5"
  }).catch(() => ({ data: { values: [] } }));
  if (!dashboard.data.values || !dashboard.data.values.length) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: DASHBOARD_TAB + "!A1",
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [
        ["Htoo Care Data Dashboard", "Value"],
        ["Health questions saved (consented)", "=COUNTA(HealthRecords!B2:B)"],
        ["Quiz attempts saved (consented)", "=COUNTA(QuizResults!B2:B)"],
        ["Average quiz score (%)", "=IFERROR(AVERAGE(QuizResults!F2:F),0)"],
        ["Last updated", "=NOW()"]
      ] }
    });
  }
  sheetsReady = true;
}

async function appendRow(tab, row) {
  await ensureDataTabs();
  const sheets = await getSheetsApi();
  const response = await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: tab + "!A:G",
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [row] }
  });
  const updates = response.data && response.data.updates;
  if (!updates || Number(updates.updatedRows) < 1) throw new Error("Google Sheets did not confirm the row write");
  console.log("Google Sheets row saved:", tab, updates.updatedRange || "range unavailable");
  return updates.updatedRange;
}

async function saveHealthRecord(session) {
  return appendRow(HEALTH_TAB, [
    new Date().toISOString(),
    crypto.randomUUID(),
    session.topic || "General health",
    session.question || "",
    session.duration || "",
    session.severity || "",
    "yes"
  ]);
}

async function saveQuizRecord(session) {
  const percent = Math.round((session.score / session.questions.length) * 100);
  return appendRow(QUIZ_TAB, [
    new Date().toISOString(),
    session.sessionId,
    session.quizTopic,
    session.score,
    session.questions.length,
    percent,
    "yes"
  ]);
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
  sessions.delete(chatId);
  return bot.sendMessage(chatId, "မင်္ဂလာပါ။ Htoo Care မှ ကြိုဆိုပါတယ်။\n\nဝန်ဆောင်မှုတစ်ခုကို ရွေးချယ်ပါ။", mainMenu);
}

async function sendLongMessage(chatId, message) {
  const chunks = String(message).match(/[\s\S]{1,3900}/g) || ["အဖြေမရရှိပါ။"];
  for (const chunk of chunks) await bot.sendMessage(chatId, chunk);
}

async function getGeminiHealthAnswer(session) {
  if (!ai) throw new Error("GEMINI_API_KEY is not configured");
  const prompt = [
    "You are Htoo Care, a Burmese-language general health education assistant.",
    "Answer in clear, respectful Burmese. For sexual and reproductive health (SRHR), menstruation, contraception, pregnancy, sexually transmitted infections (STIs) and HIV, use non-judgmental, stigma-free language and evidence-aligned general education.",
    "Do not diagnose, prescribe medicines or dosages, or claim to replace a qualified clinician. Do not invent facts or claim a clinician reviewed the response.",
    "Explain that HIV is not transmitted through ordinary everyday contact such as sharing food, hugging, or using the same toilet. Explain that testing and qualified clinical advice are appropriate after possible exposure; do not estimate an individual's diagnosis.",
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
  const result = await ai.models.generateContent({ model: GEMINI_MODEL, contents: prompt });
  const answer = result && result.text;
  if (!answer || !answer.trim()) throw new Error("Gemini returned an empty response");
  return answer.trim();
}

const articles = {
  "🌞 အပူဒဏ်ကာကွယ်ရေး": "အပူပြင်းချိန်တွင် ရေကို ပုံမှန်သောက်ပါ၊ အရိပ်ရပြီး လေဝင်လေထွက်ကောင်းသောနေရာတွင် နေပါ။ မူးဝေခြင်း၊ သတိလစ်ခြင်း သို့မဟုတ် စိတ်ရှုပ်ထွေးခြင်းရှိပါက အရေးပေါ်အကူအညီ ရယူပါ။",
  "🥗 အာဟာရနှင့် ကျန်းမာရေး": "အာဟာရမျှတစေရန် အစားအစာအမျိုးမျိုးကို သင့်တင့်မျှတစွာ စားပါ။ ဟင်းသီးဟင်းရွက်၊ သစ်သီး၊ ပရိုတင်းပါသော အစားအစာများနှင့် သန့်ရှင်းသောရေကို ရွေးချယ်ပါ။",
  "🌸 SRHR": "လိင်နှင့် မျိုးဆက်ပွားကျန်းမာရေး (SRHR) တွင် ရာသီလာခြင်း၊ သန္ဓေတားနည်းများ၊ သဘောတူညီမှု၊ ကိုယ်ဝန်ဆောင်စောင့်ရှောက်မှုနှင့် လိင်မှတစ်ဆင့် ကူးစက်နိုင်သောရောဂါများ ပါဝင်သည်။ ကိုယ်ရေးကိုယ်တာမေးခွန်းများကို အပြစ်တင်ခြင်းမရှိဘဲ ကျန်းမာရေးဝန်ထမ်းနှင့် တိုင်ပင်နိုင်ပါသည်။",
  "🛡️ STI/HIV": "STI/HIV အကြောင်း သိထားရန် — STI အချို့တွင် လက္ခဏာမပြနိုင်ပါ။ စစ်ဆေးမှုသာလျှင် အခြေအနေကို သိရှိရန် ကူညီနိုင်သည်။ ကွန်ဒုံးကို မှန်ကန်စွာ အသုံးပြုခြင်းနှင့် စမ်းသပ်စစ်ဆေးခြင်းသည် အန္တရာယ်လျှော့ချရန် ကူညီသည်။ HIV သည် ပွေ့ဖက်ခြင်း၊ အတူစားသောက်ခြင်း၊ အိမ်သာအတူသုံးခြင်းမှ မကူးစက်ပါ။ ဖြစ်နိုင်သော HIV ထိတွေ့မှုသည် 72 နာရီအတွင်း ဖြစ်ခဲ့ပါက PEP အတွက် ကျန်းမာရေးဝန်ဆောင်မှုကို အရေးပေါ်ဆက်သွယ်ပါ။",
  "🤰 မိခင်နှင့် ကလေးကျန်းမာရေး": "ကိုယ်ဝန်ဆောင်စောင့်ရှောက်မှုနှင့် ကလေးကျန်းမာရေးအတွက် ကျန်းမာရေးဝန်ထမ်းထံ ပုံမှန်တိုင်ပင်ပါ။ ကိုယ်ဝန်ဆောင်စဉ် သွေးထွက်များခြင်း၊ ပြင်းထန်သောဗိုက်နာခြင်း သို့မဟုတ် သတိလစ်ခြင်းရှိပါက အရေးပေါ်ကုသမှု ရယူပါ။",
  "🩺 လက္ခဏာများရှိလျှင်": "ဤ Bot သည် ရောဂါအတည်ပြုခြင်း သို့မဟုတ် ဆေးညွှန်းခြင်း မပြုပါ။ အသက်ရှူရခက်ခြင်း၊ သတိလစ်ခြင်း၊ ရင်ဘတ်ပြင်းထန်စွာနာခြင်း၊ တက်ခြင်း သို့မဟုတ် သွေးထွက်များခြင်းရှိပါက အရေးပေါ်ဆေးကုသမှုကို ချက်ချင်းရယူပါ။"
};

const quizBank = [
  { topic: "SRHR", q: "SRHR ဆိုသည်မှာ ဘာကို အဓိကထားသနည်း။", options: ["လိင်နှင့် မျိုးဆက်ပွားကျန်းမာရေးနှင့် အခွင့်အရေး", "အစားအသောက်တစ်မျိုးတည်း", "အားကစားတစ်မျိုးတည်း"], answer: 0, explain: "SRHR သည် လိင်နှင့် မျိုးဆက်ပွားကျန်းမာရေး၊ သတင်းအချက်အလက်နှင့် အခွင့်အရေးများကို လွှမ်းခြုံသည်။" },
  { topic: "STI/HIV", q: "HIV သည် အောက်ပါတို့အနက် ဘယ်အရာမှ ပုံမှန်အားဖြင့် မကူးစက်သနည်း။", options: ["အန္တရာယ်ရှိသော သွေးထိတွေ့မှု", "အတူစားသောက်ခြင်းနှင့် ပွေ့ဖက်ခြင်း", "ကာကွယ်မှုမရှိသော လိင်ဆက်ဆံမှု"], answer: 1, explain: "အတူစားသောက်ခြင်း၊ ပွေ့ဖက်ခြင်း၊ အိမ်သာအတူသုံးခြင်းတို့မှ HIV မကူးစက်ပါ။" },
  { topic: "STI/HIV", q: "STI အချို့တွင် ဘာဖြစ်နိုင်သနည်း။", options: ["လက္ခဏာမပြနိုင်ပါ", "အမြဲတမ်း ချက်ချင်းလက္ခဏာပြသည်", "စစ်ဆေးစရာမလိုပါ"], answer: 0, explain: "STI အချို့သည် လက္ခဏာမပြနိုင်သဖြင့် လိုအပ်ပါက စစ်ဆေးမှုနှင့် ကျန်းမာရေးဝန်ထမ်းအကြံဉာဏ် ရယူသင့်သည်။" },
  { topic: "STI/HIV", q: "ဖြစ်နိုင်သော HIV ထိတွေ့မှုသည် 72 နာရီအတွင်း ဖြစ်ခဲ့လျှင် ဘာလုပ်သင့်သနည်း။", options: ["ဘာမှမလုပ်ဘဲ စောင့်ပါ", "PEP အကြောင်း မေးမြန်းရန် ကျန်းမာရေးဝန်ဆောင်မှုကို အရေးပေါ်ဆက်သွယ်ပါ", "လက္ခဏာပေါ်လာမှသာ စဉ်းစားပါ"], answer: 1, explain: "PEP သည် အချိန်မီ စတင်ရန်လိုအပ်နိုင်သဖြင့် ချက်ချင်း ကျန်းမာရေးဝန်ဆောင်မှုနှင့် တိုင်ပင်ပါ။" },
  { topic: "SRHR", q: "သန္ဓေတားနည်းရွေးချယ်ရာတွင် ဘယ်နည်းလမ်းက သင့်တော်သနည်း။", options: ["လူတိုင်းအတွက် နည်းတစ်မျိုးတည်း", "မိမိကျန်းမာရေးနှင့် လိုအပ်ချက်အလိုက် ကျွမ်းကျင်သူနှင့် တိုင်ပင်ရွေးချယ်ခြင်း", "အချက်အလက်မသိဘဲ ဆေးသောက်ခြင်း"], answer: 1, explain: "နည်းလမ်းများတွင် အကျိုးကျေးဇူးနှင့် ကန့်သတ်ချက်များ ကွာခြားနိုင်သဖြင့် ယုံကြည်ရသော ကျန်းမာရေးဝန်ထမ်းနှင့် တိုင်ပင်ပါ။" },
  { topic: "SRHR", q: "လိင်ဆက်ဆံမှုတွင် သဘောတူညီမှုသည် မည်သို့ဖြစ်သင့်သနည်း။", options: ["လွတ်လပ်စွာ၊ ဖိအားမရှိဘဲ ပေးထားရမည်", "တစ်ကြိမ်ပေးလျှင် အမြဲတမ်းဖြစ်သည်", "တိတ်ဆိတ်နေခြင်းကို အမြဲသဘောတူသည်ဟု ယူဆနိုင်သည်"], answer: 0, explain: "သဘောတူညီမှုသည် လွတ်လပ်စွာပေးရပြီး အချိန်မရွေး ပြန်လည်ရုပ်သိမ်းနိုင်သည်။" },
  { topic: "Menstrual health", q: "ရာသီလာခြင်းနှင့်ပတ်သက်၍ စိုးရိမ်ရသော လက္ခဏာတစ်ခုရှိပါက ဘာလုပ်သင့်သနည်း။", options: ["အမြဲလျစ်လျူရှုပါ", "ကျန်းမာရေးဝန်ထမ်းနှင့် တိုင်ပင်ပါ", "အခြားသူ၏ဆေးကို ကိုယ်တိုင်သောက်ပါ"], answer: 1, explain: "သွေးထွက်အလွန်များခြင်း၊ ပြင်းထန်သောနာကျင်မှု သို့မဟုတ် မူးဝေခြင်းရှိပါက ကျန်းမာရေးအကြံဉာဏ်ရယူပါ။" },
  { topic: "General health", q: "ကျန်းမာရေး Bot မှ အဖြေကို ဘယ်လိုအသုံးပြုသင့်သနည်း။", options: ["ဆရာဝန်အစား အမြဲတမ်းအသုံးပြုပါ", "အထွေထွေပညာပေးအဖြစ်သာယူပြီး လိုအပ်လျှင် ကျွမ်းကျင်သူနှင့်တိုင်ပင်ပါ", "အဖြေတိုင်းကို ရောဂါအတည်ပြုချက်ဟုယူပါ"], answer: 1, explain: "Bot အဖြေသည် ပညာပေးအတွက်သာဖြစ်ပြီး ရောဂါအတည်ပြုခြင်း သို့မဟုတ် ဆေးညွှန်းခြင်း မဟုတ်ပါ။" },
  { topic: "STI/HIV", q: "HIV အခြေအနေကို သိရှိရန် အထောက်အကူအဖြစ် ဘာက အရေးကြီးသနည်း။", options: ["အခြားသူကိုကြည့်ပြီး ခန့်မှန်းခြင်း", "သင့်တော်သော HIV စစ်ဆေးမှု", "လက္ခဏာမရှိလျှင် စစ်ဆေးမှုမလိုခြင်း"], answer: 1, explain: "HIV အခြေအနေကို ခန့်မှန်း၍မရပါ။ သင့်တော်သောစစ်ဆေးမှုနှင့် ကျန်းမာရေးဝန်ဆောင်မှုကို ရယူပါ။" },
  { topic: "SRHR", q: "ကျန်းမာရေးအကြောင်းအရာမေးမြန်းရာတွင် ဘယ်အချက်အလက်တွေကို မပို့သင့်သနည်း။", options: ["ကျန်းမာရေးမေးခွန်း", "မလိုအပ်သော အမည်၊ မှတ်ပုံတင်နံပါတ်နှင့် လိပ်စာ", "အထွေထွေအကြောင်းအရာ"], answer: 1, explain: "ကိုယ်ရေးအချက်အလက်ကို ကာကွယ်ရန် မလိုအပ်သော အမည်၊ ID နှင့် လိပ်စာများ မပို့ပါနှင့်။" }
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
  const keyboard = q.options.map((option, i) => [{ text: option, callback_data: "quiz_answer_" + i }]);
  return bot.sendMessage(chatId,
    "🎯 Quiz (" + (session.index + 1) + "/" + session.questions.length + ")\nအကြောင်းအရာ: " + q.topic + "\n\n" + q.q,
    { reply_markup: { inline_keyboard: keyboard } });
}

bot.onText(/^\/start$/, msg => showMenu(msg.chat.id));
bot.onText(/^\/cancel$/, msg => showMenu(msg.chat.id));
bot.onText(/^\/quiz$/, msg => startQuizConsent(msg.chat.id));

function startQuizConsent(chatId) {
  sessions.set(chatId, { step: "quiz_consent", sessionId: crypto.randomUUID() });
  return bot.sendMessage(chatId,
    "Quiz ကို အကြိမ်အကန့်အသတ်မရှိ ထပ်ဖြေနိုင်ပါတယ်။ မေးခွန်းအစုံကို ပြန်လည်ရောနှောပေးပါမယ်။\n\nQuiz အမှတ်ကို အမည်/Telegram ID မပါဘဲ Google Sheets ထဲ သိမ်းလိုပါသလား။ မသိမ်းဘဲလည်း Quiz ဖြေနိုင်ပါတယ်။",
    { reply_markup: { inline_keyboard: [
      [{ text: "အမှတ်ကို အမည်မပါဘဲ သိမ်းမယ်", callback_data: "quiz_save_yes" }],
      [{ text: "မသိမ်းဘဲ Quiz ဖြေမယ်", callback_data: "quiz_save_no" }]
    ] } });
}

bot.on("message", async msg => {
  if (!msg.text) return;
  const chatId = msg.chat.id;
  const text = msg.text.trim();
  if (text.startsWith("/")) return;

  if (text === "🩺 ကျန်းမာရေးမေးမြန်းမယ်") {
    sessions.set(chatId, { step: "health_topic" });
    return bot.sendMessage(chatId, "အကြောင်းအရာကို ရွေးပါ။", { reply_markup: { inline_keyboard: [
      [{ text: "အထွေထွေကျန်းမာရေး", callback_data: "healthtopic_general" }],
      [{ text: "🌸 SRHR", callback_data: "healthtopic_srhr" }],
      [{ text: "🩸 ရာသီလာခြင်း", callback_data: "healthtopic_menstrual" }],
      [{ text: "🤰 ကိုယ်ဝန်ဆောင်ကျန်းမာရေး", callback_data: "healthtopic_pregnancy" }],
      [{ text: "🛡️ STI/HIV", callback_data: "healthtopic_sti" }]
    ] } });
  }

  if (text === "📚 ကျန်းမာရေးဗဟုသုတ") {
    return bot.sendMessage(chatId, "ဖတ်ရှုလိုသော အကြောင်းအရာကို ရွေးပါ။", { reply_markup: { keyboard: [
      ["🌞 အပူဒဏ်ကာကွယ်ရေး"], ["🥗 အာဟာရနှင့် ကျန်းမာရေး"],
      ["🌸 SRHR"], ["🛡️ STI/HIV"], ["🤰 မိခင်နှင့် ကလေးကျန်းမာရေး"],
      ["🩺 လက္ခဏာများရှိလျှင်"], ["🏠 ပင်မမီနူး"]
    ], resize_keyboard: true } });
  }

  if (articles[text]) return bot.sendMessage(chatId, articles[text], mainMenu);
  if (text === "🎯 ကျန်းမာရေး Quiz ဖြေမယ်") return startQuizConsent(chatId);
  if (text === "🌍 ပြည်ပရောက် မြန်မာများအတွက်") {
    const overseasMessage = [
      "🌍 ပြည်ပရောက် မြန်မာနိုင်ငံသားများအတွက် ကျန်းမာရေးအကူအညီ",
      "",
      "အထူးကုဆရာဝန်နှင့် တိုင်ပင်ဆွေးနွေးရန် ဆက်သွယ်ရန်အချက်အလက် —",
      "",
      "📞 Phone: 09 442 111 110",
      "💬 Viber: 09 442 111 110",
      "✈️ Telegram: 09 442 111 110",
      "",
      "မြန်မာဘာသာဖြင့် ဆက်သွယ်မေးမြန်းနိုင်ပါသည်။ ပြည်ပမှ ဖုန်းခေါ်ဆိုခနှင့် ဝန်ဆောင်မှုရရှိနိုင်မှုကို ဆက်သွယ်မီ စစ်ဆေးပါ။",
      "",
      "🌍 Health support for Myanmar citizens living abroad",
      "For specialist consultation, contact:",
      "Phone: 09 442 111 110",
      "Viber: 09 442 111 110",
      "Telegram: 09 442 111 110",
      "Please confirm international call charges and service availability before contacting."
    ].join("\n");
    return bot.sendMessage(chatId, overseasMessage, mainMenu);
  }
  if (text === "📞 7887 ကို ဖုန်းဆက်မယ်") {
    return bot.sendMessage(chatId, "မြန်မာနိုင်ငံအတွင်းမှ ကျန်းမာရေးတိုင်ပင်ရန် 7887 သို့ ဖုန်းဆက်နိုင်ပါသည်။ အရေးပေါ်အခြေအနေဖြစ်ပါက အနီးဆုံးအရေးပေါ်ကုသမှုကို ချက်ချင်းရယူပါ။", mainMenu);
  }
  if (text === "🏠 ပင်မမီနူး") return showMenu(chatId);

  const session = sessions.get(chatId);
  if (!session) return;

  if (session.step === "health_question") {
    if (text.length < 2 || text.length > 1500) return bot.sendMessage(chatId, "မေးခွန်းကို စာလုံး 2 မှ 1500 အတွင်း ရေးပေးပါ။");
    session.question = text;
    session.step = "health_duration";
    return bot.sendMessage(chatId, "ဤပြဿနာဖြစ်လာတာ ဘယ်လောက်ကြာပြီလဲ။ မသက်ဆိုင်ပါက “မသက်ဆိုင်” ဟုရေးပါ။");
  }

  if (session.step === "health_duration") {
    session.duration = text.slice(0, 100);
    session.step = "health_severity";
    return bot.sendMessage(chatId, "ပြင်းထန်မှုကို ရွေးပါ။", { reply_markup: { inline_keyboard: [
      [{ text: "အနည်းငယ်", callback_data: "severity_mild" }],
      [{ text: "အလယ်အလတ်", callback_data: "severity_moderate" }],
      [{ text: "ပြင်းထန်", callback_data: "severity_severe" }],
      [{ text: "မသက်ဆိုင်", callback_data: "severity_na" }]
    ] } });
  }
});

bot.on("callback_query", async query => {
  const chatId = query.message && query.message.chat && query.message.chat.id;
  if (!chatId) return;
  const data = query.data || "";
  const session = sessions.get(chatId);
  await bot.answerCallbackQuery(query.id).catch(() => {});
  if (!session) return;

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
    return bot.sendMessage(chatId,
      "ကိုယ်ရေးလုံခြုံမှု အသိပေးချက် — သင့်မေးခွန်းကို AI ဝန်ဆောင်မှုသို့ ပို့၍ အထွေထွေကျန်းမာရေးပညာပေးအဖြေ ထုတ်ပေးမည်ဖြစ်သည်။ AI အဖြေသည် ရောဂါအတည်ပြုချက် သို့မဟုတ် ဆေးညွှန်း မဟုတ်ပါ။ Google Sheets ထဲ သိမ်းဆည်းခြင်းကို နောက်တစ်ဆင့်တွင် သီးခြားသဘောတူညီမှုတောင်းပါမည်။ အမည်၊ မှတ်ပုံတင်နံပါတ်၊ ဖုန်းနံပါတ်၊ လိပ်စာ သို့မဟုတ် အခြားသူကို ဖော်ထုတ်နိုင်သော အချက်အလက်များ မထည့်ပါနှင့်။",
      { reply_markup: { inline_keyboard: [
        [{ text: "နားလည်ပါပြီ၊ ဆက်လုပ်မယ်", callback_data: "health_ai_yes" }],
        [{ text: "မဆက်လုပ်တော့ပါ", callback_data: "health_ai_no" }]
      ] } });
  }

  if (data === "health_ai_no" && session.step === "health_ai_consent") {
    sessions.delete(chatId);
    return bot.sendMessage(chatId, "AI သို့ မေးခွန်းမပို့ပါ။ ကျန်းမာရေးဗဟုသုတကို ဖတ်ရှုနိုင်သည် သို့မဟုတ် မြန်မာနိုင်ငံအတွင်းရှိပါက 7887 သို့ ဆက်သွယ်နိုင်ပါသည်။", mainMenu);
  }

  if (data === "health_ai_yes" && session.step === "health_ai_consent") {
    session.step = "health_question";
    return bot.sendMessage(chatId, "မေးခွန်းကို ရေးပေးပါ။ အမည်၊ မှတ်ပုံတင်နံပါတ်၊ ဖုန်းနံပါတ်၊ လိပ်စာကဲ့သို့ မလိုအပ်သော ကိုယ်ရေးအချက်အလက်များ မထည့်ပါနှင့်။");
  }

  if (data.startsWith("severity_") && session.step === "health_severity") {
    const map = { severity_mild: "Mild", severity_moderate: "Moderate", severity_severe: "Severe", severity_na: "Not applicable" };
    if (!map[data]) return;
    session.severity = map[data];
    if (data === "severity_severe") {
      await bot.sendMessage(chatId, "ပြင်းထန်သည်ဟု ရွေးထားပါသည်။ အသက်ရှူရခက်ခြင်း၊ သတိလစ်ခြင်း၊ ရင်ဘတ်ပြင်းထန်စွာနာခြင်း၊ တက်ခြင်း သို့မဟုတ် သွေးထွက်များခြင်းရှိပါက အရေးပေါ်ကုသမှုကို ချက်ချင်းရယူပါ။");
    }
    session.step = "health_consent";
    let answer = "";
    try {
      await bot.sendMessage(chatId, "အထွေထွေကျန်းမာရေးအချက်အလက်ကို ပြင်ဆင်နေပါတယ်။");
      answer = await getGeminiHealthAnswer(session);
      await sendLongMessage(chatId, answer);
    } catch (error) {
      console.error("Gemini response failed:", error.message);
      await bot.sendMessage(chatId, "လက်ရှိတွင် AI အဖြေမရရှိနိုင်ပါ။ ဒေတာသိမ်းဆည်းခြင်းသည် AI အဖြေအောင်မြင်မှုနှင့် သီးခြားဖြစ်သည်။ နောက်မှ ထပ်စမ်းကြည့်ပါ သို့မဟုတ် မြန်မာနိုင်ငံအတွင်းရှိပါက 7887 သို့ ဆက်သွယ်ပါ။");
    }
    return bot.sendMessage(chatId,
      "သင်၏ မေးခွန်းနှင့် အကြောင်းအရာကို Google Sheets ထဲ အမည်နှင့် Telegram ID မပါဘဲ သိမ်းဆည်းရန် သဘောတူပါသလား။ မသိမ်းဘဲလည်း ဆက်သုံးနိုင်ပါတယ်။\n\nသဘောတူပါက မေးခွန်းစာသားကို မှတ်တမ်းအဖြစ် သိမ်းမည်ဖြစ်သောကြောင့် အမည်/လိပ်စာ/ID ကဲ့သို့ ကိုယ်ရေးအချက်အလက်များ မထည့်ထားကြောင်း သေချာပါစေ။",
      { reply_markup: { inline_keyboard: [
        [{ text: "သဘောတူပြီး သိမ်းမယ်", callback_data: "health_save_yes" }],
        [{ text: "မသိမ်းပါနဲ့", callback_data: "health_save_no" }]
      ] } });
  }

  if (data === "health_save_no" && session.step === "health_consent") {
    sessions.delete(chatId);
    return bot.sendMessage(chatId, "ဒေတာကို Google Sheets ထဲ မသိမ်းပါ။", mainMenu);
  }

  if (data === "health_save_yes" && session.step === "health_consent") {
    try {
      const range = await saveHealthRecord(session);
      sessions.delete(chatId);
      return bot.sendMessage(chatId, "ဒေတာသိမ်းဆည်းမှု အောင်မြင်ပါပြီ။\nမှတ်တမ်းနေရာ: " + range + "\n\nBot သည် ရောဂါအတည်ပြုခြင်း သို့မဟုတ် ဆေးညွှန်းခြင်း မပြုပါ။", mainMenu);
    } catch (error) {
      console.error("Google Sheets health save failed:", error.message);
      return bot.sendMessage(chatId, "ဒေတာသိမ်းဆည်းမှု မအောင်မြင်ပါ။ အောင်မြင်ကြောင်း မအတည်ပြုနိုင်သေးပါ။ Hosting Variables နှင့် Google Sheet permission ကို စစ်ဆေးပါ။", mainMenu);
    }
  }

  if ((data === "quiz_save_yes" || data === "quiz_save_no") && session.step === "quiz_consent") {
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
    if (!q || !Number.isInteger(chosen) || chosen < 0 || chosen >= q.options.length) return;
    const correct = chosen === q.answer;
    if (correct) session.score += 1;
    await bot.sendMessage(chatId, (correct ? "✅ မှန်ပါတယ်။\n" : "❌ မမှန်သေးပါ။\n") + q.explain);
    session.index += 1;
    if (session.index < session.questions.length) return sendQuizQuestion(chatId, session);
    const percent = Math.round(session.score / session.questions.length * 100);
    let ending = "🎉 Quiz ပြီးပါပြီ။\nအမှတ်: " + session.score + "/" + session.questions.length + " (" + percent + "%)\n\nQuiz ကို ထပ်ဖြေလိုပါက “🎯 ကျန်းမာရေး Quiz ဖြေမယ်” ကို နှိပ်ပါ။";
    if (session.saveQuiz) {
      try {
        const range = await saveQuizRecord(session);
        ending += "\n\nအမည်/Telegram ID မပါသော အမှတ်မှတ်တမ်းကို သိမ်းဆည်းပြီးပါပြီ (" + range + ")။";
      } catch (error) {
        console.error("Google Sheets quiz save failed:", error.message);
        ending += "\n\nမှတ်ချက်: Quiz အမှတ်ကို Google Sheets ထဲ သိမ်းဆည်းမရသေးပါ။ Hosting Variables နှင့် Google Sheet permission ကို စစ်ဆေးပါ။";
      }
    } else {
      ending += "\n\nသင်ရွေးချယ်ထားသည့်အတိုင်း အမှတ်ကို Google Sheets ထဲ မသိမ်းပါ။";
    }
    sessions.delete(chatId);
    return bot.sendMessage(chatId, ending, mainMenu);
  }
});

bot.on("polling_error", error => console.error("Telegram polling error:", error.message));
bot.on("error", error => console.error("Telegram bot error:", error.message));
console.log("Htoo Care Telegram Bot started.");
