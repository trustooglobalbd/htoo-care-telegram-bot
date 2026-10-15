
const crypto = require("crypto");
const express = require("express");
const TelegramBot = require("node-telegram-bot-api");
const mysql = require("mysql2/promise");

// ========================================
// 1. ENVIRONMENT VARIABLES
// ========================================
const TOKEN = process.env.TELEGRAM_BOT_TOKEN;

const PORT = Number(process.env.PORT || 3000);

const MYSQL_HOST = process.env.MYSQL_HOST;
const MYSQL_PORT = Number(process.env.MYSQL_PORT || 3306);
const MYSQL_DATABASE = process.env.MYSQL_DATABASE;
const MYSQL_USER = process.env.MYSQL_USER;
const MYSQL_PASSWORD = process.env.MYSQL_PASSWORD;

if (!TOKEN) {
  console.error("Startup failed: TELEGRAM_BOT_TOKEN is missing.");
  process.exit(1);
}

// Database is configured only when all required settings exist.
const DB_CONFIGURED = Boolean(
  MYSQL_HOST &&
  MYSQL_DATABASE &&
  MYSQL_USER &&
  MYSQL_PASSWORD
);

let db = null;
let dbReady = false;

if (DB_CONFIGURED) {
  db = mysql.createPool({
    host: MYSQL_HOST,
    port: MYSQL_PORT,
    database: MYSQL_DATABASE,
    user: MYSQL_USER,
    password: MYSQL_PASSWORD,
    waitForConnections: true,
    connectionLimit: 5,
    queueLimit: 0,
    charset: "utf8mb4"
  });
} else {
  console.error(
    "MySQL settings are incomplete. Consultation saving is unavailable."
  );
}

// ========================================
// 2. EXPRESS SERVER
// ========================================
const app = express();

app.get("/", (req, res) => {
  res.status(200).send("Htoo Care Bot is running.");
});

app.get("/health", (req, res) => {
  res.status(dbReady ? 200 : 503).json({
    bot: "Htoo Care",
    status: "running",
    database: dbReady ? "connected" : "unavailable"
  });
});

const server = app.listen(PORT, "0.0.0.0", () => {
  console.log(`Web server listening on port ${PORT}`);
});

// ========================================
// 3. TELEGRAM BOT
// ========================================
const bot = new TelegramBot(TOKEN, {
  polling: {
    autoStart: false,
    params: {
      timeout: 10
    }
  }
});

// Keep the user's current form in memory.
// Incomplete forms reset when the process restarts.
const sessions = new Map();
const handledUpdates = new Set();

const MAIN_MENU = {
  my: [
    ["🩺 တိုင်ပင်ဆွေးနွေးရန်"],
    ["📚 ကျန်းမာရေးအချက်အလက်", "📞 7887 ဆက်သွယ်ရန်"],
    ["🚨 အရေးပေါ်အကူအညီ", "🔒 ကိုယ်ရေးအချက်အလက်"]
  ],
  en: [
    ["🩺 Request consultation"],
    ["📚 Health information", "📞 Contact 7887"],
    ["🚨 Emergency", "🔒 Privacy"]
  ]
};

function getSession(chatId) {
  if (!sessions.has(String(chatId))) {
    sessions.set(String(chatId), {
      step: "menu",
      language: "my",
      form: {}
    });
  }
  return sessions.get(String(chatId));
}

function setMenu(chatId, language) {
  const session = getSession(chatId);
  session.step = "menu";
  session.language = language;
  session.form = {};
}

function keyboard(rows, language = "my", extra = {}) {
  return {
    reply_markup: {
      keyboard: rows,
      resize_keyboard: true,
      ...extra
    }
  };
}

function mainMenu(chatId, language) {
  setMenu(chatId, language);

  const text = language === "en"
    ? "Welcome to Htoo Care.\n\nChoose a service below. This bot provides health information and helps you contact 7887. It does not diagnose illnesses."
    : "Htoo Care မှ ကြိုဆိုပါတယ်။\n\nအောက်ပါဝန်ဆောင်မှုကို ရွေးချယ်ပါ။ ဒီ Bot က ကျန်းမာရေးအချက်အလက်နဲ့ 7887 ဆက်သွယ်ရန် ကူညီပေးပါတယ်။ ရောဂါအတည်ပြုစစ်ဆေးပေးတဲ့ Bot မဟုတ်ပါ။";

  return bot.sendMessage(
    chatId,
    text,
    keyboard(MAIN_MENU[language])
  );
}

function ask(chatId, text, rows, language = "my") {
  return bot.sendMessage(chatId, text, keyboard(rows, language));
}

function normalize(text) {
  return String(text || "").trim();
}

function isEmergencyText(text) {
  const t = normalize(text).toLowerCase();

  return [
    "🚨 အရေးပေါ်အကူအညီ",
    "🚨 emergency",
    "အရေးပေါ်",
    "emergency"
  ].includes(t);
}

async function sendEmergencyMessage(chatId, language) {
  const text = language === "en"
    ? "If you have severe difficulty breathing, chest pain, fainting, heavy bleeding, signs of stroke, or another life-threatening emergency, seek emergency medical care immediately. Do not wait for a Telegram reply. Contact local emergency services or go to the nearest emergency department."
    : "အသက်ရှူအလွန်ခက်ခြင်း၊ ရင်ဘတ်အောင့်ခြင်း၊ သတိလစ်ခြင်း၊ သွေးအလွန်ထွက်ခြင်း၊ လေဖြတ်လက္ခဏာများ သို့မဟုတ် အသက်အန္တရာယ်ရှိနိုင်သော အရေးပေါ်အခြေအနေဖြစ်ပါက Telegram အကြောင်းပြန်ချက်ကို မစောင့်ပါနှင့်။ အနီးဆုံး အရေးပေါ်ဆေးကုသမှုဌာနသို့ ချက်ချင်းသွားပါ သို့မဟုတ် ဒေသတွင်း အရေးပေါ်ဝန်ဆောင်မှုကို ဆက်သွယ်ပါ။";

  return bot.sendMessage(chatId, text);
}

// ========================================
// 4. MYSQL CONNECTION
// ========================================
async function testDatabaseConnection() {
  if (!db) {
    console.error("MySQL is not configured.");
    return;
  }

  try {
    const connection = await db.getConnection();
    await connection.query("SELECT 1");
    connection.release();

    dbReady = true;
    console.log("MySQL connection successful.");
  } catch (error) {
    dbReady = false;
    console.error(
      "MySQL connection failed:",
      error.code || error.message
    );
  }
}

// ========================================
// 5. CONSULTATION FORM
// ========================================
async function startConsultation(chatId, language) {
  const session = getSession(chatId);

  session.language = language;
  session.step = "age";
  session.form = {};

  const text = language === "en"
    ? "Let's collect a few details for your consultation request.\n\nHow old are you? Enter your age in years (0–120)."
    : "တိုင်ပင်ဆွေးနွေးရန် အချက်အလက်အနည်းငယ် မေးပါမယ်။\n\nအသက်ဘယ်လောက်ရှိပါသလဲ။ အသက်ကို နှစ်ဖြင့် ရိုက်ထည့်ပါ (၀ မှ ၁၂၀ အတွင်း)။";

  return bot.sendMessage(
    chatId,
    text,
    keyboard([["↩️ မီနူးသို့ပြန်ရန်"]], language)
  );
}

async function askGender(chatId, language) {
  const text = language === "en"
    ? "Please choose your gender."
    : "ကျား/မ အမျိုးအစားကို ရွေးချယ်ပါ။";

  const rows = language === "en"
    ? [["Male", "Female"], ["Prefer not to say"]]
    : [["ကျား", "မ"], ["မဖြေလိုပါ"]];

  return ask(chatId, text, rows, language);
}

async function askMaritalStatus(chatId, language) {
  const text = language === "en"
    ? "Please choose your marital status."
    : "အိမ်ထောင်ရေးအခြေအနေကို ရွေးချယ်ပါ။";

  const rows = language === "en"
    ? [["Married", "Single"], ["Prefer not to say"]]
    : [["အိမ်ထောင်ရှိ", "အိမ်ထောင်မရှိ"], ["မဖြေလိုပါ"]];

  return ask(chatId, text, rows, language);
}

async function askSymptom(chatId, language) {
  const text = language === "en"
    ? "Choose your main symptom. This selection is not a diagnosis."
    : "အဓိကခံစားနေရတဲ့ လက္ခဏာကို ရွေးချယ်ပါ။ ဒီရွေးချယ်မှုဟာ ရောဂါအတည်ပြုချက် မဟုတ်ပါ။";

  const rows = language === "en"
    ? [
        ["Headache", "Diarrhea"],
        ["Dizziness", "Vomiting"],
        ["Vomiting and diarrhea"],
        ["Other"]
      ]
    : [
        ["ခေါင်းကိုက်", "ဝမ်းလျှော"],
        ["မူးဝေ", "အန်ခြင်း"],
        ["အန်ခြင်းနှင့် ဝမ်းလျှောခြင်း"],
        ["အခြား"]
      ];

  return ask(chatId, text, rows, language);
}

async function askConsent(chatId, language) {
  const text = language === "en"
    ? "Privacy and consent\n\nIf you agree, Htoo Care will save your age, gender choice, marital-status choice, selected symptom, Telegram chat ID, and request details in its database so the request can be recorded. Do not send your password, national ID, or unnecessary sensitive information. You may choose not to proceed.\n\nDo you consent to saving these details?"
    : "ကိုယ်ရေးအချက်အလက်နှင့် ခွင့်ပြုချက်\n\nသဘောတူပါက သင့်အသက်၊ ကျား/မ ရွေးချယ်မှု၊ အိမ်ထောင်ရေးအခြေအနေ၊ ရွေးချယ်ထားသော လက္ခဏာ၊ Telegram Chat ID နှင့် တိုင်ပင်ရန်အချက်အလက်တို့ကို မှတ်တမ်းတင်ရန် Htoo Care ၏ Database ထဲ သိမ်းဆည်းပါမယ်။ Password၊ မှတ်ပုံတင်နံပါတ်နဲ့ မလိုအပ်တဲ့ အရေးကြီးအချက်အလက်တွေ မပို့ပါနဲ့။ သဘောမတူပါက ဆက်မလုပ်နိုင်ပါ။\n\nအချက်အလက်များ သိမ်းဆည်းရန် သဘောတူပါသလား။";

  const rows = language === "en"
    ? [["I agree", "I do not agree"]]
    : [["သဘောတူသည်", "သဘောမတူပါ"]];

  return ask(chatId, text, rows, language);
}

function mapChoice(value, mapping) {
  return mapping[value] || value;
}

function getGender(value) {
  return mapChoice(value, {
    "ကျား": "male",
    "မ": "female",
    "မဖြေလိုပါ": "prefer_not_to_say",
    "Male": "male",
    "Female": "female",
    "Prefer not to say": "prefer_not_to_say"
  });
}

function getMaritalStatus(value) {
  return mapChoice(value, {
    "အိမ်ထောင်ရှိ": "married",
    "အိမ်ထောင်မရှိ": "single",
    "မဖြေလိုပါ": "prefer_not_to_say",
    "Married": "married",
    "Single": "single",
    "Prefer not to say": "prefer_not_to_say"
  });
}

function getSymptom(value) {
  return mapChoice(value, {
    "ခေါင်းကိုက်": "headache",
    "ဝမ်းလျှော": "diarrhea",
    "မူးဝေ": "dizziness",
    "အန်ခြင်း": "vomiting",
    "အန်ခြင်းနှင့် ဝမ်းလျှောခြင်း": "vomiting_and_diarrhea",
    "အခြား": "other",
    "Headache": "headache",
    "Diarrhea": "diarrhea",
    "Dizziness": "dizziness",
    "Vomiting": "vomiting",
    "Vomiting and diarrhea": "vomiting_and_diarrhea",
    "Other": "other"
  });
}

async function saveConsultation(chatId, session) {
  if (!db || !dbReady) {
    const text = session.language === "en"
      ? "Sorry, the database is currently unavailable, so your request was not saved. Please contact 7887 directly. You can try again later."
      : "ဝမ်းနည်းပါတယ်။ Database ချိတ်ဆက်မှု မရသေးလို့ သင့်တောင်းဆိုချက်ကို မသိမ်းနိုင်သေးပါ။ 7887 ကို တိုက်ရိုက်ဆက်သွယ်ပါ။ နောက်မှ ပြန်ကြိုးစားနိုင်ပါတယ်။";

    await bot.sendMessage(chatId, text);
    return false;
  }

  const f = session.form;
  const requestId = "HC-" + crypto.randomUUID();
  const details = JSON.stringify({
    source: "Htoo Care Telegram bot",
    symptom: f.symptom,
    language: session.language
  });

  try {
    await db.execute(
      `INSERT INTO consultation_requests
       (request_id, telegram_chat_id, topic, language, details,
        consent_given, consent_at, status, age, gender,
        marital_status, symptom)
       VALUES (?, ?, ?, ?, ?, ?, NOW(), ?, ?, ?, ?, ?)`,
      [
        requestId,
        String(chatId),
        "general_health",
        session.language,
        details,
        1,
        "pending",
        f.age,
        f.gender,
        f.marital_status,
        f.symptom
      ]
    );

    console.log("Consultation saved:", requestId);

    const text = session.language === "en"
      ? `Your request has been saved successfully.\n\nReference: ${requestId}\n\nThis is not a diagnosis, and no doctor or staff member has been notified by this bot. Please contact 7887 for consultation and next steps.`
      : `သင့်တောင်းဆိုချက်ကို မှတ်တမ်းတင်ပြီးပါပြီ။\n\nရည်ညွှန်းနံပါတ်: ${requestId}\n\nဤအရာသည် ရောဂါအတည်ပြုချက် မဟုတ်ပါ။ ဒီ Bot က ဆရာဝန် သို့မဟုတ် ဝန်ထမ်းထံ အလိုအလျောက် အသိပေးထားခြင်း မရှိပါ။ တိုင်ပင်ဆွေးနွေးရန်နှင့် နောက်တစ်ဆင့်အတွက် 7887 ကို ဆက်သွယ်ပါ။`;

    await bot.sendMessage(
      chatId,
      text,
      keyboard(MAIN_MENU[session.language])
    );

    setMenu(chatId, session.language);
    return true;
  } catch (error) {
    console.error(
      "Saving consultation failed:",
      error.code || error.message
    );

    const text = session.language === "en"
      ? "We could not save your request. Please contact 7887 directly and try again later."
      : "တောင်းဆိုချက်ကို သိမ်းဆည်းရာမှာ အမှားဖြစ်နေပါတယ်။ 7887 ကို တိုက်ရိုက်ဆက်သွယ်ပြီး နောက်မှ ပြန်ကြိုးစားပါ။";

    await bot.sendMessage(chatId, text);
    return false;
  }
}

// ========================================
// 6. TELEGRAM COMMANDS
// ========================================
bot.onText(/^\/start(?:@\w+)?(?:\s+(my|en))?$/i, async (msg, match) => {
  const chatId = msg.chat.id;
  const language = (match[1] || "my").toLowerCase();

  try {
    await bot.sendMessage(
      chatId,
      "ဘာသာစကား ရွေးချယ်ပါ / Choose your language",
      keyboard([
        ["မြန်မာ 🇲🇲", "English 🇬🇧"]
      ])
    );

    const session = getSession(chatId);
    session.step = "language";
    session.language = language;
  } catch (error) {
    console.error("Start command error:", error.message);
  }
});

bot.onText(/^\/menu$/i, async (msg) => {
  const session = getSession(msg.chat.id);
  await mainMenu(msg.chat.id, session.language);
});

bot.onText(/^\/cancel$/i, async (msg) => {
  const session = getSession(msg.chat.id);
  await mainMenu(msg.chat.id, session.language);

  await bot.sendMessage(
    msg.chat.id,
    session.language === "en"
      ? "The current form was cancelled."
      : "လက်ရှိဖောင်ကို ပယ်ဖျက်လိုက်ပါပြီ။"
  );
});

bot.onText(/^\/health$/i, async (msg) => {
  await bot.sendMessage(
    msg.chat.id,
    `Bot is running.\nDatabase: ${dbReady ? "connected" : "unavailable"}`
  );
});

// ========================================
// 7. MAIN MESSAGE HANDLER
// ========================================
bot.on("message", async (msg) => {
  if (!msg.text || msg.text.startsWith("/")) return;

  const chatId = msg.chat.id;
  const text = normalize(msg.text);
  const session = getSession(chatId);
  const language = session.language || "my";

  try {
    // Language selection
    if (session.step === "language") {
      if (text === "မြန်မာ 🇲🇲") {
        await mainMenu(chatId, "my");
        return;
      }

      if (text === "English 🇬🇧") {
        await mainMenu(chatId, "en");
        return;
      }

      await bot.sendMessage(
        chatId,
        "ဘာသာစကား ရွေးချယ်ပါ / Choose your language",
        keyboard([["မြန်မာ 🇲🇲", "English 🇬🇧"]])
      );
      return;
    }

    // Menu shortcut
    if (
      text === "↩️ မီနူးသို့ပြန်ရန်" ||
      text === "↩️ Back to menu"
    ) {
      await mainMenu(chatId, language);
      return;
    }

    // Emergency shortcut at any step
    if (isEmergencyText(text)) {
      await sendEmergencyMessage(chatId, language);
      return;
    }

    // Menu actions
    if (
      text === "🩺 တိုင်ပင်ဆွေးနွေးရန်" ||
      text === "🩺 Request consultation"
    ) {
      await startConsultation(chatId, language);
      return;
    }

    if (
      text === "📞 7887 ဆက်သွယ်ရန်" ||
      text === "📞 Contact 7887"
    ) {
      const contactText = language === "en"
        ? "For consultation, please contact 7887 directly. This bot does not provide a diagnosis."
        : "တိုင်ပင်ဆွေးနွေးရန် 7887 ကို တိုက်ရိုက်ဆက်သွယ်ပါ။ ဒီ Bot က ရောဂါအတည်ပြုစစ်ဆေးပေးခြင်း မပြုပါ။";

      await bot.sendMessage(chatId, contactText);
      return;
    }

    if (
      text === "🔒 ကိုယ်ရေးအချက်အလက်" ||
      text === "🔒 Privacy"
    ) {
      const privacyText = language === "en"
        ? "Privacy: consultation details are saved only after you consent. Avoid sending passwords, identity numbers, or unnecessary sensitive information. Do not consent if you do not want these details stored."
        : "ကိုယ်ရေးအချက်အလက်: သဘောတူပြီးမှသာ တိုင်ပင်ရန်အချက်အလက်ကို သိမ်းဆည်းပါမယ်။ Password၊ မှတ်ပုံတင်နံပါတ်နဲ့ မလိုအပ်တဲ့ အရေးကြီးအချက်အလက်တွေ မပို့ပါနဲ့။ အချက်အလက်သိမ်းဆည်းခြင်းကို မလိုလားပါက သဘောမတူနိုင်ပါတယ်။";

      await bot.sendMessage(chatId, privacyText);
      return;
    }

    if (
      text === "📚 ကျန်းမာရေးအချက်အလက်" ||
      text === "📚 Health information"
    ) {
      const infoText = language === "en"
        ? "General health guidance:\n• Drink safe fluids.\n• Rest when unwell.\n• Seek medical advice if symptoms persist or worsen.\n• For severe or life-threatening symptoms, seek emergency care immediately.\n\nThis information does not replace a clinician's assessment."
        : "အထွေထွေကျန်းမာရေးအကြံပြုချက်များ:\n• သန့်ရှင်းစိတ်ချရသော ရေကို သောက်ပါ။\n• နေမကောင်းပါက အနားယူပါ။\n• လက္ခဏာများ ဆက်ရှိနေခြင်း သို့မဟုတ် ပိုဆိုးလာခြင်းရှိပါက ကျန်းမာရေးဝန်ထမ်းနှင့် တိုင်ပင်ပါ။\n• အသက်အန္တရာယ်ရှိနိုင်သော လက္ခဏာများရှိပါက အရေးပေါ်ဆေးကုသမှု ချက်ချင်းရယူပါ။\n\nဤအချက်အလက်များသည် ဆရာဝန်၏ စစ်ဆေးအကဲဖြတ်မှုကို အစားမထိုးနိုင်ပါ။";

      await bot.sendMessage(chatId, infoText);
      return;
    }

    // Consultation form state machine
    if (session.step === "age") {
      if (!/^\d{1,3}$/.test(text)) {
        await bot.sendMessage(
          chatId,
          language === "en"
            ? "Please enter your age as a number from 0 to 120."
            : "အသက်ကို ၀ မှ ၁၂၀ အတွင်း ဂဏန်းဖြင့် ရိုက်ထည့်ပါ။"
        );
        return;
      }

      const age = Number(text);
      if (age < 0 || age > 120) {
        await bot.sendMessage(
          chatId,
          language === "en"
            ? "Please enter a valid age from 0 to 120."
            : "မှန်ကန်သော အသက်ကို ၀ မှ ၁၂၀ အတွင်း ရိုက်ထည့်ပါ။"
        );
        return;
      }

      session.form.age = age;
      session.step = "gender";
      await askGender(chatId, language);
      return;
    }

    if (session.step === "gender") {
      const allowed = [
        "ကျား", "မ", "မဖြေလိုပါ",
        "Male", "Female", "Prefer not to say"
      ];

      if (!allowed.includes(text)) {
        await askGender(chatId, language);
        return;
      }

      session.form.gender = getGender(text);
      session.step = "marital_status";
      await askMaritalStatus(chatId, language);
      return;
    }

    if (session.step === "marital_status") {
      const allowed = [
        "အိမ်ထောင်ရှိ", "အိမ်ထောင်မရှိ", "မဖြေလိုပါ",
        "Married", "Single", "Prefer not to say"
      ];

      if (!allowed.includes(text)) {
        await askMaritalStatus(chatId, language);
        return;
      }

      session.form.marital_status = getMaritalStatus(text);
      session.step = "symptom";
      await askSymptom(chatId, language);
      return;
    }

    if (session.step === "symptom") {
      const allowed = [
        "ခေါင်းကိုက်", "ဝမ်းလျှော", "မူးဝေ",
        "အန်ခြင်း", "အန်ခြင်းနှင့် ဝမ်းလျှောခြင်း", "အခြား",
        "Headache", "Diarrhea", "Dizziness",
        "Vomiting", "Vomiting and diarrhea", "Other"
      ];

      if (!allowed.includes(text)) {
        await askSymptom(chatId, language);
        return;
      }

      session.form.symptom = getSymptom(text);

      if (session.form.symptom === "other") {
        session.step = "other_symptom";
        await bot.sendMessage(
          chatId,
          language === "en"
            ? "Briefly describe your main symptom. Do not include your full name, identity number, or other unnecessary sensitive details."
            : "အဓိကခံစားနေရတဲ့ လက္ခဏာကို အတိုချုံး ရေးပေးပါ။ အမည်အပြည့်အစုံ၊ မှတ်ပုံတင်နံပါတ်နဲ့ မလိုအပ်တဲ့ အရေးကြီးအချက်အလက်တွေ မရေးပါနဲ့။"
        );
        return;
      }

      session.step = "consent";
      await askConsent(chatId, language);
      return;
    }

    if (session.step === "other_symptom") {
      if (text.length > 500) {
        await bot.sendMessage(
          chatId,
          language === "en"
            ? "Please keep the description under 500 characters."
            : "ဖော်ပြချက်ကို စာလုံး ၅၀၀ အတွင်း ရေးပေးပါ။"
        );
        return;
      }

      session.form.other_symptom = text;
      session.form.symptom = "other";
      session.step = "consent";
      await askConsent(chatId, language);
      return;
    }

    if (session.step === "consent") {
      const agrees = ["သဘောတူသည်", "I agree"].includes(text);
      const refuses = ["သဘောမတူပါ", "I do not agree"].includes(text);

      if (refuses) {
        await mainMenu(chatId, language);
        await bot.sendMessage(
          chatId,
          language === "en"
            ? "No details were saved. You can contact 7887 directly if you need help."
            : "အချက်အလက်များကို မသိမ်းဆည်းပါ။ အကူအညီလိုအပ်ပါက 7887 ကို တိုက်ရိုက်ဆက်သွယ်နိုင်ပါတယ်။"
        );
        return;
      }

      if (!agrees) {
        await askConsent(chatId, language);
        return;
      }

      await saveConsultation(chatId, session);
      return;
    }

    // Default reply
    await bot.sendMessage(
      chatId,
      language === "en"
        ? "Please choose an option from the menu, or type /start."
        : "မီနူးမှ ဝန်ဆောင်မှုတစ်ခုကို ရွေးချယ်ပါ၊ သို့မဟုတ် /start ကို ပို့ပါ။",
      keyboard(MAIN_MENU[language])
    );
  } catch (error) {
    console.error("Message handler error:", error.message);

    try {
      await bot.sendMessage(
        chatId,
        "အမှားတစ်ခု ဖြစ်ပွားနေပါတယ်။ /start ကို ပြန်ပို့ပြီး ကြိုးစားပါ။"
      );
    } catch (sendError) {
      console.error("Error reply failed:", sendError.message);
    }
  }
});

// ========================================
// 8. ERROR HANDLING AND STARTUP
// ========================================
bot.on("polling_error", (error) => {
  console.error(
    "Telegram polling error:",
    error.code || error.message
  );
});

bot.on("error", (error) => {
  console.error("Telegram bot error:", error.message);
});

async function start() {
  await testDatabaseConnection();

  try {
    // Clear any old webhook before starting long polling.
    await bot.deleteWebHook({ drop_pending_updates: false });
    await bot.startPolling();

    console.log("Htoo Care Telegram bot started.");
  } catch (error) {
    console.error(
      "Telegram bot failed to start:",
      error.code || error.message
    );
  }
}

start();

async function shutdown(signal) {
  console.log(`${signal} received. Shutting down...`);

  try {
    await bot.stopPolling();
  } catch (error) {
    console.error("Polling shutdown:", error.message);
  }

  if (db) {
    try {
      await db.end();
    } catch (error) {
      console.error("Database shutdown:", error.message);
    }
  }

  server.close(() => process.exit(0));
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
