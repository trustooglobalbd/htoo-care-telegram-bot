const TelegramBot = require("node-telegram-bot-api");
const express = require("express");
const mysql = require("mysql2/promise");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (_req, res) => {
  res.send("Htoo Care Bot is running");
});

let db = null;

app.get("/health", async (_req, res) => {
  if (!db) {
    return res.status(503).json({
      status: "degraded",
      database: "not_configured"
    });
  }

  try {
    await db.query("SELECT 1");
    res.json({ status: "ok", database: "connected" });
  } catch (_error) {
    res.status(503).json({
      status: "degraded",
      database: "unavailable"
    });
  }
});

app.listen(PORT, () => {
  console.log(`Web server running on port ${PORT}`);
});

// ==========================================
// 1. ENVIRONMENT VARIABLES
// ==========================================

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;

if (!TOKEN) {
  console.error("Missing TELEGRAM_BOT_TOKEN");
  process.exit(1);
}

// ==========================================
// 2. MYSQL CONNECTION
// ==========================================

if (
  process.env.MYSQL_HOST &&
  process.env.MYSQL_DATABASE &&
  process.env.MYSQL_USER &&
  process.env.MYSQL_PASSWORD
) {
  db = mysql.createPool({
    host: process.env.MYSQL_HOST,
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
    waitForConnections: true,
    connectionLimit: 5,
    charset: "utf8mb4"
  });

  db.query("SELECT 1")
    .then(() => console.log("MySQL connected successfully"))
    .catch(error => {
      console.error("MySQL connection failed:", error.message);
    });
} else {
  console.warn(
    "MySQL environment variables are missing. Database features will not work."
  );
}

// ==========================================
// 3. TELEGRAM BOT
// ==========================================

const bot = new TelegramBot(TOKEN, { polling: true });

// Temporary conversation sessions.
// Sessions are cleared if the application restarts.
const sessions = new Map();

const mainMenu = {
  reply_markup: {
    keyboard: [
      ["🩺 ကျန်းမာရေးအချက်အလက် ဖြေဆိုမယ်"],
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

function educationMenu(chatId) {
  return bot.sendMessage(
    chatId,
    "ဖတ်ရှုလိုသော ကျန်းမာရေးအကြောင်းအရာကို ရွေးချယ်ပါ။",
    {
      reply_markup: {
        keyboard: [
          ["🌞 အပူဒဏ်ကာကွယ်ရေး"],
          ["🥗 အာဟာရနှင့် ကျန်းမာရေး"],
          ["🤰 မိခင်နှင့် ကလေးကျန်းမာရေး"],
          ["🩺 လက္ခဏာများရှိလျှင် ဘာလုပ်မလဲ"],
          ["🗂️ Database မှ ကျန်းမာရေးအကြောင်းအရာများ"],
          ["🏠 ပင်မမီနူး"]
        ],
        resize_keyboard: true
      }
    }
  );
}

// ==========================================
// 4. DATABASE HEALTH CATEGORIES
// ==========================================

async function showDatabaseCategories(chatId) {
  if (!db) {
    return bot.sendMessage(
      chatId,
      "Database ကို ချိတ်ဆက်မရသေးပါ။ နောက်မှ ပြန်ကြိုးစားပါ။"
    );
  }

  try {
    const [categories] = await db.execute(
      `SELECT id, category_code, name_my, name_en
       FROM health_categories
       WHERE is_active = 1
       ORDER BY id ASC`
    );

    if (categories.length === 0) {
      return bot.sendMessage(
        chatId,
        "လက်ရှိ အသုံးပြုနိုင်သော ကျန်းမာရေးအမျိုးအစား မရှိသေးပါ။",
        mainMenu
      );
    }

    const keyboard = categories.map(category => [
      {
        text: category.name_my,
        callback_data: `healthcat:${category.id}`
      }
    ]);

    keyboard.push([
      {
        text: "🏠 ပင်မမီနူး",
        callback_data: "healthcat:home"
      }
    ]);

    return bot.sendMessage(
      chatId,
      "📚 ကျန်းမာရေးအမျိုးအစားကို ရွေးချယ်ပါ။",
      {
        reply_markup: {
          inline_keyboard: keyboard
        }
      }
    );
  } catch (error) {
    console.error("Category loading error:", error.message);

    return bot.sendMessage(
      chatId,
      "ကျန်းမာရေးအမျိုးအစားများ ဖတ်ယူရာတွင် အမှားဖြစ်နေပါသည်။"
    );
  }
}

// ==========================================
// 5. DATABASE HEALTH CONTENTS
// ==========================================

async function showDatabaseContents(chatId, categoryId) {
  if (!db) {
    return bot.sendMessage(
      chatId,
      "Database ကို ချိတ်ဆက်မရသေးပါ။"
    );
  }

  try {
    // Only approved and active health information is displayed.
    const [contents] = await db.execute(
      `SELECT content_code, title, body
       FROM health_contents
       WHERE category_id = ?
         AND language = 'my'
         AND review_status = 'approved'
         AND is_active = 1
       ORDER BY id DESC
       LIMIT 10`,
      [categoryId]
    );

    if (contents.length === 0) {
      return bot.sendMessage(
        chatId,
        "ဒီအမျိုးအစားအတွက် စိစစ်အတည်ပြုပြီး အသုံးပြုခွင့်ဖွင့်ထားသော အကြောင်းအရာ မရှိသေးပါ။",
        {
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: "⬅️ အမျိုးအစားများ",
                  callback_data: "healthcat:list"
                }
              ],
              [
                {
                  text: "🏠 ပင်မမီနူး",
                  callback_data: "healthcat:home"
                }
              ]
            ]
          }
        }
      );
    }

    for (const item of contents) {
      const message = `📘 ${item.title}\n\n${item.body}`;

      // Telegram messages have a maximum length.
      const chunks = message.match(/[\s\S]{1,4000}/g) || [];

      for (const chunk of chunks) {
        await bot.sendMessage(chatId, chunk);
      }
    }

    return bot.sendMessage(
      chatId,
      "အခြားအကြောင်းအရာများကိုလည်း ဖတ်ရှုနိုင်ပါတယ်။",
      {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "⬅️ အမျိုးအစားများ",
                callback_data: "healthcat:list"
              }
            ],
            [
              {
                text: "🏠 ပင်မမီနူး",
                callback_data: "healthcat:home"
              }
            ]
          ]
        }
      }
    );
  } catch (error) {
    console.error("Health content loading error:", error.message);

    return bot.sendMessage(
      chatId,
      "ကျန်းမာရေးအကြောင်းအရာ ဖတ်ယူရာတွင် အမှားဖြစ်နေပါသည်။"
    );
  }
}

// ==========================================
// 6. STATIC HEALTH EDUCATION
// ==========================================

const articles = {
  "🌞 အပူဒဏ်ကာကွယ်ရေး":
    `အပူဒဏ်ကာကွယ်ရန်

• ရေကို ပုံမှန်သောက်ပါ။
• နေပူပြင်းချိန်တွင် အပြင်ထွက်ခြင်းကို လျှော့ချပါ။
• အရိပ်ရပြီး လေဝင်လေထွက်ကောင်းသောနေရာတွင် နေပါ။
• မူးဝေခြင်း၊ သတိလစ်ခြင်း သို့မဟုတ် စိတ်ရှုပ်ထွေးခြင်းရှိပါက အရေးပေါ်အကူအညီ ရယူပါ။`,

  "🥗 အာဟာရနှင့် ကျန်းမာရေး":
    `အာဟာရမျှတစေရန် အစားအစာအမျိုးမျိုးကို သင့်တင့်မျှတစွာ စားပါ။

• ဟင်းသီးဟင်းရွက်နှင့် သစ်သီးများ စားပါ။
• ပရိုတင်းပါသော အစားအစာများကို ရွေးချယ်ပါ။
• သန့်ရှင်းသောရေကို သောက်ပါ။
• မိမိတွင် ရှိပြီးသား ကျန်းမာရေးအခြေအနေနှင့် ကိုက်ညီသော အစားအသောက်အကြံဉာဏ်အတွက် ကျန်းမာရေးဝန်ထမ်းနှင့် တိုင်ပင်ပါ။`,

  "🤰 မိခင်နှင့် ကလေးကျန်းမာရေး":
    `မိခင်နှင့် ကလေးကျန်းမာရေးအတွက်—

• ကိုယ်ဝန်ဆောင်စောင့်ရှောက်မှုကို ပုံမှန်ခံယူပါ။
• ကလေး၏ အသက်အရွယ်နှင့် ကိုက်ညီသော ကျန်းမာရေးစောင့်ရှောက်မှု ရယူပါ။
• စိုးရိမ်ရသော လက္ခဏာများရှိပါက ဆေးကုသမှုကို မနှောင့်နှေးပါနှင့်။
• သီးခြားဆေးဘက်ဆိုင်ရာမေးခွန်းများအတွက် ကျန်းမာရေးဝန်ထမ်းနှင့် တိုင်ပင်ပါ။`,

  "🩺 လက္ခဏာများရှိလျှင် ဘာလုပ်မလဲ":
    `ကျန်းမာရေးလက္ခဏာများရှိပါက—

• လက္ခဏာများကို မှတ်သားထားပါ။
• မိမိဘာသာ ရောဂါသတ်မှတ်ခြင်း သို့မဟုတ် ဆေးသောက်ခြင်းကို သတိပြုပါ။
• အသက်ရှူရခက်ခြင်း၊ သတိလစ်ခြင်း သို့မဟုတ် ရင်ဘတ်ပြင်းထန်စွာနာခြင်းရှိပါက အရေးပေါ်ဆေးကုသမှု ချက်ချင်းရယူပါ။
• အခြားကျန်းမာရေးမေးခွန်းများအတွက် 7887 သို့ ဆက်သွယ်တိုင်ပင်နိုင်ပါသည်။`
};

// ==========================================
// 7. START AND CANCEL COMMANDS
// ==========================================

bot.onText(/^\/start$/, msg => {
  showMenu(msg.chat.id);
});

bot.onText(/^\/cancel$/, msg => {
  showMenu(msg.chat.id);
});

// ==========================================
// 8. MAIN MESSAGE HANDLER
// ==========================================

bot.on("message", async msg => {
  if (!msg.text || msg.text.startsWith("/")) return;

  const chatId = msg.chat.id;
  const text = msg.text.trim();
  const session = sessions.get(chatId);

  // Specialist consultation
  if (
    text === "🌍 Specialist Consultation (ပြည်ပရောက် မြန်မာများ)"
  ) {
    return bot.sendMessage(
      chatId,
      `🌍 ပြည်ပရောက် မြန်မာနိုင်ငံသားများအတွက် Specialist Consultation

အထူးကုဆရာဝန်နှင့် တိုင်ပင်ဆွေးနွေးရန် ဆက်သွယ်နိုင်ပါသည်။

📞 Phone / Viber / Telegram: 09 442 111 110

Specialist Consultation for Myanmar nationals living abroad:
Please contact us via Phone, Viber, or Telegram at 09 442 111 110.`,
      mainMenu
    );
  }

  // 7887 hotline
  if (text === "📞 7887 ကို ဖုန်းဆက်မယ်") {
    return bot.sendMessage(
      chatId,
      "ကျန်းမာရေးအကြံဉာဏ်ရယူရန် 7887 သို့ ဖုန်းဆက်နိုင်ပါတယ်။\n\nအရေးပေါ်အခြေအနေဖြစ်ပါက သင့်ဒေသရှိ အရေးပေါ်ဆေးကုသမှုကို ချက်ချင်းရယူပါ။",
      {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "📞 7887",
                callback_data: "call_7887"
              }
            ]
          ]
        }
      }
    );
  }

  // Education menu
  if (text === "📚 ကျန်းမာရေးဗဟုသုတ ဖတ်မယ်") {
    return educationMenu(chatId);
  }

  // Database categories menu
  if (text === "🗂️ Database မှ ကျန်းမာရေးအကြောင်းအရာများ") {
    sessions.delete(chatId);
    return showDatabaseCategories(chatId);
  }

  // Static educational articles
  if (articles[text]) {
    return bot.sendMessage(chatId, articles[text], mainMenu);
  }

  // Return to home
  if (text === "🏠 ပင်မမီနူး") {
    return showMenu(chatId);
  }

  // Begin health questionnaire
  if (text === "🩺 ကျန်းမာရေးအချက်အလက် ဖြေဆိုမယ်") {
    sessions.set(chatId, {
      step: "age",
      language: "my"
    });

    return bot.sendMessage(
      chatId,
      "သင့်အသက်ကို နှစ်ဖြင့် ရိုက်ထည့်ပါ။ ဥပမာ - 25\n\nရပ်လိုပါက /cancel ကို ရိုက်ပါ။"
    );
  }

  if (!session) return;

  // Age
  if (session.step === "age") {
    const age = Number(text);

    if (!Number.isInteger(age) || age < 1 || age > 120) {
      return bot.sendMessage(
        chatId,
        "အသက်ကို 1 မှ 120 အတွင်း ဂဏန်းဖြင့် ရိုက်ထည့်ပါ။"
      );
    }

    session.age = age;
    session.step = "gender";

    return bot.sendMessage(
      chatId,
      "သင့်ကျား/မ ကို ရွေးချယ်ပါ။",
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: "ကျား", callback_data: "gender_male" }],
            [{ text: "မ", callback_data: "gender_female" }],
            [
              {
                text: "မဖြေလိုပါ",
                callback_data: "gender_skip"
              }
            ]
          ]
        }
      }
    );
  }

  // Marital status keyboard fallback
  if (session.step === "marital") {
    const options = {
      "အိမ်ထောင်ရှိ": "married",
      "အိမ်ထောင်မရှိ": "single",
      "မဖြေလိုပါ": "prefer_not_to_say"
    };

    if (!options[text]) {
      return bot.sendMessage(
        chatId,
        "အောက်ပါရွေးချယ်စရာတစ်ခုကို နှိပ်ပါ။"
      );
    }

    session.marital_status = options[text];
    session.step = "symptom";

    return bot.sendMessage(
      chatId,
      "လက်ရှိ ဘယ်လိုခံစားနေရပါသလဲ။\n\nသင့်လက္ခဏာများ သို့မဟုတ် ကျန်းမာရေးမေးခွန်းကို ရေးပေးပါ။ အမည်၊ ဖုန်းနံပါတ်ကဲ့သို့ မလိုအပ်သော ကိုယ်ရေးအချက်အလက်များ မထည့်ပါနှင့်။"
    );
  }

  // Symptoms / health question
  if (session.step === "symptom") {
    if (text.length < 2 || text.length > 2000) {
      return bot.sendMessage(
        chatId,
        "အကြောင်းအရာကို စာလုံး 2 မှ 2000 အတွင်း ရေးပေးပါ။"
      );
    }

    session.symptom = text;
    session.step = "consent";

    return bot.sendMessage(
      chatId,
      `သင့်ဖြေဆိုချက်များကို ကျန်းမာရေးဝန်ဆောင်မှုအတွက် သိမ်းဆည်းနိုင်ပါသည်။ သိမ်းဆည်းပါက Telegram Chat ID နှင့် သင်ရေးသားထားသော ကျန်းမာရေးအချက်အလက်များလည်း ပါဝင်ပါမည်။

သဘောတူပါသလား?`,
      {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "သဘောတူပြီး သိမ်းမယ်",
                callback_data: "consent_yes"
              }
            ],
            [
              {
                text: "မသိမ်းပါနဲ့",
                callback_data: "consent_no"
              }
            ]
          ]
        }
      }
    );
  }
});

// ==========================================
// 9. CALLBACK HANDLER
// ==========================================

bot.on("callback_query", async query => {
  const chatId = query.message?.chat?.id;
  const data = query.data;

  if (!chatId || !data) {
    await bot.answerCallbackQuery(query.id);
    return;
  }

  await bot.answerCallbackQuery(query.id);

  const session = sessions.get(chatId);

  // Database navigation
  if (data === "healthcat:home") {
    return showMenu(chatId);
  }

  if (data === "healthcat:list") {
    return showDatabaseCategories(chatId);
  }

  if (data.startsWith("healthcat:")) {
    const categoryId = Number(data.split(":")[1]);

    if (!Number.isSafeInteger(categoryId) || categoryId < 1) {
      return bot.sendMessage(
        chatId,
        "အမျိုးအစားရွေးချယ်မှု မမှန်ကန်ပါ။"
      );
    }

    return showDatabaseContents(chatId, categoryId);
  }

  // 7887 callback
  if (data === "call_7887") {
    return bot.sendMessage(
      chatId,
      "သင့်ဖုန်း၏ ဖုန်းခေါ်ဆိုမှုစနစ်မှ 7887 ကို ကိုယ်တိုင်ခေါ်ဆိုပါ။ Bot က သင့်အစား ဖုန်းခေါ်ဆိုပေးနိုင်ခြင်း မရှိပါ။"
    );
  }

  if (!session) return;

  // Gender selection
  if (data.startsWith("gender_") && session.step === "gender") {
    const genderMap = {
      gender_male: "male",
      gender_female: "female",
      gender_skip: "prefer_not_to_say"
    };

    if (!genderMap[data]) return;

    session.gender = genderMap[data];
    session.step = "marital";

    return bot.sendMessage(
      chatId,
      "သင့်အိမ်ထောင်ရေးအခြေအနေကို ရွေးချယ်ပါ။",
      {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "အိမ်ထောင်ရှိ",
                callback_data: "marital_married"
              }
            ],
            [
              {
                text: "အိမ်ထောင်မရှိ",
                callback_data: "marital_single"
              }
            ],
            [
              {
                text: "မဖြေလိုပါ",
                callback_data: "marital_skip"
              }
            ]
          ]
        }
      }
    );
  }

  // Marital status selection
  if (data.startsWith("marital_") && session.step === "marital") {
    const maritalMap = {
      marital_married: "married",
      marital_single: "single",
      marital_skip: "prefer_not_to_say"
    };

    if (!maritalMap[data]) return;

    session.marital_status = maritalMap[data];
    session.step = "symptom";

    return bot.sendMessage(
      chatId,
      "လက်ရှိ ဘယ်လိုခံစားနေရပါသလဲ။\n\nသင့်လက္ခဏာများ သို့မဟုတ် ကျန်းမာရေးမေးခွန်းကို ရေးပေးပါ။ မလိုအပ်သော ကိုယ်ရေးအချက်အလက်များ မထည့်ပါနှင့်။"
    );
  }

  // Consent declined
  if (data === "consent_no") {
    sessions.delete(chatId);

    return bot.sendMessage(
      chatId,
      "သဘောတူညီမှု မပေးထားသောကြောင့် ဖြေဆိုချက်များကို database ထဲ မသိမ်းပါ။",
      mainMenu
    );
  }

  // Consent accepted and save to MySQL
  if (data === "consent_yes" && session.step === "consent") {
    if (!db) {
      sessions.delete(chatId);

      return bot.sendMessage(
        chatId,
        "Database မချိတ်ဆက်နိုင်သေးသောကြောင့် သင့်ဖြေဆိုချက်များကို မသိမ်းထားပါ။ နောက်မှ ထပ်ကြိုးစားပါ။",
        mainMenu
      );
    }

    try {
      const requestId = crypto.randomUUID();

      await db.execute(
        `INSERT INTO consultation_requests
        (
          request_id,
          telegram_chat_id,
          topic,
          language,
          details,
          consent_given,
          consent_at,
          status,
          age,
          gender,
          marital_status,
          symptom
        )
        VALUES (?, ?, ?, ?, ?, ?, NOW(), 'pending', ?, ?, ?, ?)`,
        [
          requestId,
          String(chatId),
          "general_health",
          session.language || "my",
          session.symptom,
          1,
          session.age,
          session.gender,
          session.marital_status,
          session.symptom.slice(0, 100)
        ]
      );

      sessions.delete(chatId);

      return bot.sendMessage(
        chatId,
        `သင့်ဖြေဆိုချက်များကို database ထဲသို့ သိမ်းဆည်းပြီးပါပြီ။

Request ID: ${requestId}

ဤ Bot သည် ရောဂါသတ်မှတ်ပေးခြင်း မပြုပါ။ ကျန်းမာရေးအကြံဉာဏ်အတွက် 7887 သို့ ဆက်သွယ်တိုင်ပင်ပါ။`,
        mainMenu
      );
    } catch (error) {
      console.error("Saving consultation failed:", error.message);

      sessions.delete(chatId);

      return bot.sendMessage(
        chatId,
        "ဒေတာသိမ်းဆည်းရာတွင် အမှားဖြစ်နေပါသည်။ သိမ်းဆည်းမှု အောင်မြင်ကြောင်း မအတည်ပြုနိုင်သေးပါ။ နောက်မှ ပြန်ကြိုးစားပါ။",
        mainMenu
      );
    }
  }
});

// ==========================================
// 10. ERROR HANDLING
// ==========================================

bot.on("polling_error", error => {
  console.error("Telegram polling error:", error.message);
});

process.on("unhandledRejection", error => {
  console.error("Unhandled rejection:", error);
});

console.log("Htoo Care Telegram Bot started.");
