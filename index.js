const TelegramBot = require("node-telegram-bot-api");
const express = require("express");
const { GoogleGenAI } = require("@google/genai");
const { google } = require("googleapis");
const crypto = require("crypto");

// Htoo Care: Telegram + Gemini + Google Sheets
// This bot provides general health education only.
// It does not diagnose diseases or prescribe medicines.

const app = express();
const PORT = process.env.PORT || 8080;

app.get("/", (_req, res) => {
  res.send("Htoo Care Bot is running");
});

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    telegramConfigured: Boolean(process.env.TELEGRAM_BOT_TOKEN),
    geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
    googleSheetsConfigured: Boolean(
      process.env.GOOGLE_SHEET_ID &&
      process.env.GOOGLE_SERVICE_ACCOUNT_JSON
    )
  });
});

app.listen(PORT, () => {
  console.log(`Web server running on ${PORT}`);
});

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;

if (!TOKEN) {
  console.error("Missing TELEGRAM_BOT_TOKEN environment variable");
  process.exit(1);
}

const ai = process.env.GEMINI_API_KEY
  ? new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY
    })
  : null;

let sheetsApi = null;

async function getSheetsApi() {
  if (sheetsApi) return sheetsApi;

  const sheetId = process.env.GOOGLE_SHEET_ID;
  const rawCredentials =
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON;

  if (!sheetId || !rawCredentials) {
    throw new Error(
      "GOOGLE_SHEET_ID or GOOGLE_SERVICE_ACCOUNT_JSON is missing"
    );
  }

  let credentials;

  try {
    credentials = JSON.parse(rawCredentials);
  } catch (_error) {
    throw new Error(
      "GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON"
    );
  }

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: [
      "https://www.googleapis.com/auth/spreadsheets"
    ]
  });

  sheetsApi = google.sheets({
    version: "v4",
    auth
  });

  return sheetsApi;
}

async function saveToGoogleSheets(chatId, session) {
  const sheets = await getSheetsApi();

  const row = [[
    new Date().toISOString(),
    crypto.randomUUID(),
    String(chatId),
    session.age ?? "",
    session.gender ?? "",
    session.topic ?? "",
    session.symptom ?? "",
    session.duration ?? "",
    session.severity ?? "",
    "yes"
  ]];

  await sheets.spreadsheets.values.append({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: "HealthRecords!A:J",
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: {
      values: row
    }
  });
}

const bot = new TelegramBot(TOKEN, {
  polling: true
});

const sessions = new Map();

const mainMenu = {
  reply_markup: {
    keyboard: [
      ["🩺 ကျန်းမာရေးအချက်အလက် မေးမြန်းမယ်"],
      ["📚 ကျန်းမာရေးဗဟုသုတ ဖတ်မယ်"],
      ["🌍 Specialist Consultation (ပြည်ပရောက် မြန်မာများ)"],
      ["📞 7887 ကို ဖုန်းဆက်မယ်"]
    ],
    resize_keyboard: true
  }
};

function showMenu(chatId) {
  sessions.delete(chatId);

  return bot.sendMessage(
    chatId,
    "မင်္ဂလာပါ။ Htoo Care မှ ကြိုဆိုပါတယ်။\n\nအောက်ပါဝန်ဆောင်မှုကို ရွေးချယ်ပါ။",
    mainMenu
  );
}

async function sendLongMessage(chatId, message) {
  const chunks =
    message.match(/[\s\S]{1,3900}/g) || ["အဖြေမရရှိပါ။"];

  for (const chunk of chunks) {
    await bot.sendMessage(chatId, chunk);
  }
}

async function getGeminiHealthAnswer(session) {
  if (!ai) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  const prompt = `
You are Htoo Care, a Burmese-language general health education assistant.
Answer mainly in clear, respectful Burmese.
Do not diagnose, prescribe medicines, recommend medicine dosages,
or claim to replace a qualified clinician.
Give general education and safe next steps only.
Encourage professional medical advice when appropriate.
If emergency warning signs are mentioned, including difficulty breathing,
unconsciousness, severe chest pain, heavy bleeding, or seizure,
tell the user to seek emergency medical care immediately.
Do not request names, ID numbers, exact addresses, or other unnecessary
identifying details.

User age: ${session.age}
Gender: ${session.gender || "not provided"}
Topic: ${session.topic || "general health"}
Question/symptom: ${session.symptom}
Duration: ${session.duration}
Severity: ${session.severity}

Structure the response as:
1. General information
2. Safe next steps
3. When to seek urgent care

Do not claim that a clinician has reviewed the answer.
`;

  const result = await ai.models.generateContent({
    model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
    contents: prompt
  });

  const answer = result.text;

  if (!answer || !answer.trim()) {
    throw new Error("Gemini returned an empty response");
  }

  return answer.trim();
}
bot.onText(/^\/start$/, msg => showMenu(msg.chat.id));
bot.onText(/^\/cancel$/, msg => showMenu(msg.chat.id));

bot.on("message", async msg => {
  if (!msg.text) return;

  const chatId = msg.chat.id;
  const text = msg.text.trim();

  if (text === "/start" || text === "/cancel") return;
  if (text.startsWith("/")) return;

  const session = sessions.get(chatId);

  if (
    text ===
    "🌍 Specialist Consultation (ပြည်ပရောက် မြန်မာများ)"
  ) {
    return bot.sendMessage(
      chatId,
      "🌍 ပြည်ပရောက် မြန်မာနိုင်ငံသားများအတွက် Specialist Consultation\n\n" +
      "အထူးကုဆရာဝန်နှင့် တိုင်ပင်လိုပါက ဆက်သွယ်ရန်:\n" +
      "📞 Phone / Viber / Telegram: 09 442 111 110\n\n" +
      "ပြည်ပမှ ဆက်သွယ်နိုင်မှုနှင့် ဖုန်းခေါ်ဆိုခကို ကြိုတင်အတည်ပြုပါ။",
      mainMenu
    );
  }

  if (text === "📞 7887 ကို ဖုန်းဆက်မယ်") {
    return bot.sendMessage(
      chatId,
      "မြန်မာနိုင်ငံအတွင်းမှ ကျန်းမာရေးအကြံဉာဏ်ရယူရန် 7887 သို့ ဖုန်းဆက်နိုင်ပါသည်။\n\n" +
      "အရေးပေါ်အခြေအနေဖြစ်ပါက အနီးဆုံးအရေးပေါ်ဆေးကုသမှုကို ချက်ချင်းရယူပါ။",
      mainMenu
    );
  }

  if (text === "📚 ကျန်းမာရေးဗဟုသုတ ဖတ်မယ်") {
    return bot.sendMessage(
      chatId,
      "ဖတ်ရှုလိုသော အကြောင်းအရာကို ရွေးပါ။",
      {
        reply_markup: {
          keyboard: [
            ["🌞 အပူဒဏ်ကာကွယ်ရေး"],
            ["🥗 အာဟာရနှင့် ကျန်းမာရေး"],
            ["🤰 မိခင်နှင့် ကလေးကျန်းမာရေး"],
            ["🩺 လက္ခဏာများရှိလျှင် ဘာလုပ်မလဲ"],
            ["🏠 ပင်မမီနူး"]
          ],
          resize_keyboard: true
        }
      }
    );
  }

  const articles = {
    "🌞 အပူဒဏ်ကာကွယ်ရေး":
      "အပူဒဏ်ကာကွယ်ရန် ရေကို ပုံမှန်သောက်ပါ၊ နေပူပြင်းချိန်တွင် အပြင်ထွက်ခြင်းကို လျှော့ချပါ၊ အရိပ်ရပြီး လေဝင်လေထွက်ကောင်းသောနေရာတွင် နေပါ။ မူးဝေခြင်း၊ သတိလစ်ခြင်း သို့မဟုတ် စိတ်ရှုပ်ထွေးခြင်းရှိပါက အရေးပေါ်အကူအညီ ရယူပါ။",

    "🥗 အာဟာရနှင့် ကျန်းမာရေး":
      "အာဟာရမျှတစေရန် အစားအစာအမျိုးမျိုးကို သင့်တင့်မျှတစွာ စားပါ။ ဟင်းသီးဟင်းရွက်၊ သစ်သီး၊ ပရိုတင်းပါသော အစားအစာများနှင့် သန့်ရှင်းသောရေကို ရွေးချယ်ပါ။",

    "🤰 မိခင်နှင့် ကလေးကျန်းမာရေး":
      "ကိုယ်ဝန်ဆောင်စောင့်ရှောက်မှုနှင့် ကလေးကျန်းမာရေးအတွက် ကျန်းမာရေးဝန်ထမ်းထံ ပုံမှန်တိုင်ပင်ပါ။ စိုးရိမ်ရသော လက္ခဏာများရှိပါက ဆေးကုသမှုကို မနှောင့်နှေးပါနှင့်။",

    "🩺 လက္ခဏာများရှိလျှင် ဘာလုပ်မလဲ":
      "ဤ Bot သည် ရောဂါအတည်ပြုခြင်း သို့မဟုတ် ဆေးညွှန်းခြင်း မပြုပါ။ အသက်ရှူရခက်ခြင်း၊ သတိလစ်ခြင်း၊ ရင်ဘတ်ပြင်းထန်စွာနာခြင်း သို့မဟုတ် သွေးထွက်များခြင်းရှိပါက အရေးပေါ်ဆေးကုသမှုကို ချက်ချင်းရယူပါ။"
  };

  if (articles[text]) {
    return bot.sendMessage(chatId, articles[text], mainMenu);
  }

  if (text === "🏠 ပင်မမီနူး") {
    return showMenu(chatId);
  }

  if (text === "🩺 ကျန်းမာရေးအချက်အလက် မေးမြန်းမယ်") {
    sessions.set(chatId, {
      step: "age"
    });

    return bot.sendMessage(
      chatId,
      "သင့်အသက်ကို နှစ်ဖြင့် ရိုက်ထည့်ပါ (ဥပမာ - 25)။\n\nရပ်လိုပါက /cancel ရိုက်ပါ။"
    );
  }

  if (!session) return;

  if (session.step === "age") {
    const age = Number(text);

    if (
      !Number.isInteger(age) ||
      age < 1 ||
      age > 120
    ) {
      return bot.sendMessage(
        chatId,
        "အသက်ကို 1 မှ 120 အတွင်း ဂဏန်းဖြင့် ရိုက်ထည့်ပါ။"
      );
    }

    session.age = age;
    session.step = "gender";

    return bot.sendMessage(
      chatId,
      "သင့်ကျား/မ ကို ရွေးပါ။",
      {
        reply_markup: {
          inline_keyboard: [
            [{
              text: "ကျား",
              callback_data: "gender_male"
            }],
            [{
              text: "မ",
              callback_data: "gender_female"
            }],
            [{
              text: "မဖြေလိုပါ",
              callback_data: "gender_skip"
            }]
          ]
        }
      }
    );
  }

  if (session.step === "symptom") {
    if (text.length < 2 || text.length > 1500) {
      return bot.sendMessage(
        chatId,
        "မေးခွန်းကို စာလုံး 2 မှ 1500 အတွင်း ရေးပေးပါ။"
      );
    }

    session.symptom = text;

    const urgent =
      /အသက်ရှူ.{0,10}(ခက်|မရ)|သတိလစ်|ရင်ဘတ်.{0,10}(ပြင်းထန်|အရမ်း).{0,10}နာ|သွေးထွက်.{0,10}(များ|မရပ်)|severe chest pain|difficulty breathing|unconscious|heavy bleeding/i
        .test(text);

    if (urgent) {
      sessions.delete(chatId);

      return bot.sendMessage(
        chatId,
        "🚨 ဖော်ပြထားသော လက္ခဏာများသည် အရေးပေါ်ဖြစ်နိုင်ပါသည်။ Bot ကို မစောင့်ဘဲ အနီးဆုံးအရေးပေါ်ဆေးကုသမှုကို ချက်ချင်းရယူပါ။",
        mainMenu
      );
    }

    session.step = "duration";

    return bot.sendMessage(
      chatId,
      "ဒီလက္ခဏာ သို့မဟုတ် ပြဿနာက ဘယ်လောက်ကြာပြီလဲ။ ဥပမာ — ဒီနေ့မှ၊ ၂ ရက်၊ ၁ ပတ်။"
    );
  }

  if (session.step === "duration") {
    if (!text || text.length > 100) {
      return bot.sendMessage(
        chatId,
        "ကြာချိန်ကို အတိုချုံး ပြန်ရေးပေးပါ။"
      );
    }

    session.duration = text;
    session.step = "severity";

    return bot.sendMessage(
      chatId,
      "လက္ခဏာပြင်းထန်မှုကို ရွေးချယ်ပါ။",
      {
        reply_markup: {
          inline_keyboard: [
            [{
              text: "🟢 အနည်းငယ်",
              callback_data: "severity_mild"
            }],
            [{
              text: "🟡 အလယ်အလတ်",
              callback_data: "severity_moderate"
            }],
            [{
              text: "🔴 ပြင်းထန်",
              callback_data: "severity_severe"
            }]
          ]
        }
      }
    );
  }
});
bot.on("callback_query", async query => {
  const chatId = query.message?.chat?.id;

  if (!chatId) return;

  const data = query.data || "";
  const session = sessions.get(chatId);

  await bot.answerCallbackQuery(query.id).catch(() => {});

  // Gender selection
  if (data.startsWith("gender_") && session?.step === "gender") {
    const genderMap = {
      gender_male: "ကျား",
      gender_female: "မ",
      gender_skip: "မဖြေလိုပါ"
    };

    if (!genderMap[data]) return;

    session.gender = genderMap[data];
    session.step = "topic";

    return bot.sendMessage(
      chatId,
      "ဘယ်ကျန်းမာရေးအကြောင်းအရာနဲ့ ပတ်သက်ပြီး မေးမြန်းလိုပါသလဲ။",
      {
        reply_markup: {
          inline_keyboard: [
            [{
              text: "🩺 အထွေထွေကျန်းမာရေး",
              callback_data: "topic_general"
            }],
            [{
              text: "🌸 SRHR / လိင်နှင့် မျိုးဆက်ပွားကျန်းမာရေး",
              callback_data: "topic_srhr"
            }],
            [{
              text: "🩸 ရာသီလာခြင်း",
              callback_data: "topic_menstrual"
            }],
            [{
              text: "🤰 ကိုယ်ဝန်ဆောင်ကျန်းမာရေး",
              callback_data: "topic_pregnancy"
            }],
            [{
              text: "🛡️ STI/HIV ကာကွယ်ရေး",
              callback_data: "topic_sti"
            }]
          ]
        }
      }
    );
  }

  // Health topic selection
  if (data.startsWith("topic_") && session?.step === "topic") {
    const topics = {
      topic_general: "အထွေထွေကျန်းမာရေး",
      topic_srhr: "SRHR / လိင်နှင့် မျိုးဆက်ပွားကျန်းမာရေး",
      topic_menstrual: "ရာသီလာခြင်း",
      topic_pregnancy: "ကိုယ်ဝန်ဆောင်ကျန်းမာရေး",
      topic_sti: "STI/HIV ကာကွယ်ရေး"
    };

    if (!topics[data]) return;

    session.topic = topics[data];
    session.step = "symptom";

    return bot.sendMessage(
      chatId,
      `ရွေးချယ်ထားသောအကြောင်းအရာ — ${session.topic}\n\n` +
      "ဘယ်လိုလက္ခဏာ၊ ပြဿနာ သို့မဟုတ် မေးခွန်းရှိပါသလဲ။ စာဖြင့် ရေးပေးပါ။\n\n" +
      "အမည်၊ နေရပ်လိပ်စာ၊ မှတ်ပုံတင်နံပါတ်ကဲ့သို့ မလိုအပ်သော ကိုယ်ရေးအချက်အလက်များ မထည့်ပါနှင့်။"
    );
  }

  // Severity selection and Gemini response
  if (data.startsWith("severity_") && session?.step === "severity") {
    const severityMap = {
      severity_mild: "အနည်းငယ်",
      severity_moderate: "အလယ်အလတ်",
      severity_severe: "ပြင်းထန်"
    };

    if (!severityMap[data]) return;

    session.severity = severityMap[data];

    if (data === "severity_severe") {
      await bot.sendMessage(
        chatId,
        "⚠️ ပြင်းထန်သည်ဟု ရွေးထားပါသည်။ အခြေအနေဆိုးလာခြင်း၊ အသက်ရှူရခက်ခြင်း၊ သတိလစ်ခြင်း သို့မဟုတ် ရင်ဘတ်ပြင်းထန်စွာနာခြင်းရှိပါက အရေးပေါ်ဆေးကုသမှု ချက်ချင်းရယူပါ။"
      );
    }

    session.step = "processing";

    await bot.sendMessage(
      chatId,
      "သင့်မေးခွန်းအတွက် အထွေထွေကျန်းမာရေးအချက်အလက်ကို ပြင်ဆင်နေပါတယ်။ ခဏစောင့်ပါ။"
    );

    try {
      const answer = await getGeminiHealthAnswer(session);
      await sendLongMessage(chatId, answer);
    } catch (error) {
      console.error(
        "Gemini response failed:",
        error.message
      );

      await bot.sendMessage(
        chatId,
        "တောင်းပန်ပါတယ်။ လက်ရှိတွင် အလိုအလျောက်ကျန်းမာရေးအဖြေကို မရရှိနိုင်ပါ။ အရေးကြီးပါက ကျန်းမာရေးဝန်ထမ်းနှင့် တိုင်ပင်ပါ။ မြန်မာနိုင်ငံအတွင်းရှိပါက 7887 သို့ ဆက်သွယ်နိုင်ပါတယ်။"
      );
    }

    session.step = "consent";

    return bot.sendMessage(
      chatId,
      "သင့်ဖြေဆိုချက်များကို Google Sheets ထဲ သိမ်းဆည်းရန် သဘောတူပါသလား။ သဘောတူမှသာ သိမ်းဆည်းပါမည်။\n\n" +
      "မှတ်ချက် — မသိမ်းရန် ရွေးချယ်ပါက Google Sheets ထဲ မသိမ်းပါ။ Bot နှင့် AI ဝန်ဆောင်မှုမှတစ်ဆင့် အဖြေထုတ်စဉ် ဒေတာကို လုပ်ဆောင်နိုင်သေးသည်။",
      {
        reply_markup: {
          inline_keyboard: [
            [{
              text: "သဘောတူပြီး သိမ်းမယ်",
              callback_data: "consent_yes"
            }],
            [{
              text: "မသိမ်းပါနဲ့",
              callback_data: "consent_no"
            }]
          ]
        }
      }
    );
  }

  // User declines storage
  if (data === "consent_no" && session?.step === "consent") {
    sessions.delete(chatId);

    return bot.sendMessage(
      chatId,
      "သဘောတူညီမှုမပေးထားသောကြောင့် ဖြေဆိုချက်များကို Google Sheets ထဲ မသိမ်းပါ။",
      mainMenu
    );
  }

  // User consents to storage
  if (data === "consent_yes" && session?.step === "consent") {
    try {
      await saveToGoogleSheets(chatId, session);

      sessions.delete(chatId);

      return bot.sendMessage(
        chatId,
        "သင့်ဖြေဆိုချက်များကို Google Sheets ထဲ အောင်မြင်စွာ သိမ်းဆည်းပြီးပါပြီ။\n\n" +
        "ဤ Bot သည် ရောဂါအတည်ပြုခြင်း သို့မဟုတ် ဆေးညွှန်းခြင်း မပြုပါ။ မြန်မာနိုင်ငံအတွင်းရှိပါက 7887 သို့ ဆက်သွယ်တိုင်ပင်နိုင်ပါသည်။",
        mainMenu
      );
    } catch (error) {
      console.error(
        "Google Sheets save failed:",
        error.message
      );

      return bot.sendMessage(
        chatId,
        "Google Sheets ထဲ သိမ်းဆည်းရာတွင် အမှားဖြစ်နေပါသည်။ မသိမ်းဆည်းနိုင်သေးပါ။ Hosting Variables၊ Sheet ID၊ Service Account permission နှင့် tab အမည် HealthRecords ကို စစ်ဆေးပါ။",
        mainMenu
      );
    }
  }
});

bot.on("polling_error", error => {
  console.error("Telegram polling error:", error.message);
});

bot.on("error", error => {
  console.error("Telegram bot error:", error.message);
});

console.log("Htoo Care Telegram Bot started.");
