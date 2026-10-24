const TelegramBot = require("node-telegram-bot-api");
const express = require("express");
const mysql = require("mysql2/promise");
const crypto = require("crypto");

const app = express();

let db = null;

app.get("/", (req, res) => {
  res.send("Htoo Care Bot is running");
});

app.get("/health", async (_req, res) => {
  if (!db) {
    return res.status(503).json({
      status: "degraded",
      database: "not_configured"
    });
  }

  try {
    await db.query("SELECT 1");

    return res.json({
      status: "ok",
      database: "connected"
    });
  } catch (_error) {
    return res.status(503).json({
      status: "degraded",
      database: "unavailable"
    });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Web server running on ${PORT}`);
});

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;

if (!TOKEN) {
  console.error("Missing TELEGRAM_BOT_TOKEN environment variable");
  process.exit(1);
}

// MySQL configuration
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

  db.getConnection()
    .then(connection => {
      console.log("MySQL connected");
      connection.release();
    })
    .catch(error => {
      console.error("MySQL connection failed:", error.message);
    });
} else {
  console.warn("MySQL settings missing; responses will not be saved.");
}

// Start Telegram bot
const bot = new TelegramBot(TOKEN, {
  polling: true
});

// Conversation sessions
const sessions = new Map();

// Main menu
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

// Display health categories from database
async function showDatabaseCategories(chatId) {
  if (!db) {
    return bot.sendMessage(
      chatId,
      "ကျန်းမာရေးအကြောင်းအရာ database ကို လက်ရှိချိတ်ဆက်မရသေးပါ။ နောက်မှ ပြန်ကြိုးစားပါ။"
    );
  }

  try {
    const [categories] = await db.execute(
      `SELECT id, name_my
       FROM health_categories
       WHERE is_active = 1
       ORDER BY id ASC`
    );

    if (!categories.length) {
      return bot.sendMessage(
        chatId,
        "လက်ရှိ အသုံးပြုနိုင်သော ကျန်းမာရေးအမျိုးအစား မရှိသေးပါ။"
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
      "ဖတ်ရှုလိုသော ကျန်းမာရေးအမျိုးအစားကို ရွေးချယ်ပါ။",
      {
        reply_markup: {
          inline_keyboard: keyboard
        }
      }
    );
  } catch (error) {
    console.error(
      "Loading health categories failed:",
      error.message
    );

    return bot.sendMessage(
      chatId,
      "ကျန်းမာရေးအမျိုးအစားများ ဖတ်ယူရာတွင် အမှားဖြစ်နေပါသည်။ နောက်မှ ပြန်ကြိုးစားပါ။"
    );
  }
}

// Display approved health content
async function showDatabaseContents(chatId, categoryId) {
  if (!db) {
    return bot.sendMessage(
      chatId,
      "ကျန်းမာရေးအကြောင်းအရာ database ကို လက်ရှိချိတ်ဆက်မရသေးပါ။"
    );
  }

  try {
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

    if (!contents.length) {
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
    console.error(
      "Loading health content failed:",
      error.message
    );

    return bot.sendMessage(
      chatId,
      "ကျန်းမာရေးအကြောင်းအရာ ဖတ်ယူရာတွင် အမှားဖြစ်နေပါသည်။ နောက်မှ ပြန်ကြိုးစားပါ။"
    );
  }
}

// Start command
bot.onText(/^\/start$/, msg => {
  showMenu(msg.chat.id);
});

// Cancel command
bot.onText(/^\/cancel$/, msg => {
  showMenu(msg.chat.id);
});

// Receive messages
bot.on("message", async msg => {
  if (!msg.text) return;

  const chatId = msg.chat.id;
  const text = msg.text.trim();

  if (text === "/cancel") {
    sessions.delete(chatId);

    return bot.sendMessage(
      chatId,
      "လက်ရှိ မေးမြန်းမှုကို ရပ်လိုက်ပါပြီ။",
      mainMenu
    );
  }

  if (text.startsWith("/")) return;

  const session = sessions.get(chatId);

  // Specialist consultation for Myanmar nationals abroad
  if (
    text === "🌍 Specialist Consultation (ပြည်ပရောက် မြန်မာများ)"
  ) {
    return bot.sendMessage(
      chatId,
      "🌍 ပြည်ပရောက် မြန်မာနိုင်ငံသားများအတွက် Specialist Consultation\n\n" +
      "အထူးကုဆရာဝန်နှင့် တိုင်ပင်ဆွေးနွေးလိုပါက အောက်ပါနံပါတ်သို့ ဆက်သွယ်နိုင်ပါတယ်။\n" +
      "📞 Phone / Viber / Telegram: 09 442 111 110\n\n" +
      "Specialist Consultation for Myanmar nationals living abroad\n" +
      "For specialist consultation, please contact us via Phone, Viber, or Telegram:\n" +
      "📞 09 442 111 110",
      mainMenu
    );
  }

  // Call 7887
  if (text === "📞 7887 ကို ဖုန်းဆက်မယ်") {
    return bot.sendMessage(
      chatId,
      "ကျန်းမာရေးအကြံဉာဏ် ရယူရန် 7887 သို့ ဖုန်းဆက်နိုင်ပါတယ်။\n\n" +
      "အရေးပေါ်အခြေအနေဖြစ်ပါက မိမိဒေသရှိ အရေးပေါ်ဆေးကုသမှုကို ချက်ချင်းရယူပါ။",
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

  // Health education menu
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
            ["🗂️ Database မှ ကျန်းမာရေးအကြောင်းအရာများ"],
            ["🏠 ပင်မမီနူး"]
          ],
          resize_keyboard: true
        }
      }
    );
  }

  if (text === "🗂️ Database မှ ကျန်းမာရေးအကြောင်းအရာများ") {
    sessions.delete(chatId);
    return showDatabaseCategories(chatId);
  }

  // Basic health education content
  const articles = {
    "🌞 အပူဒဏ်ကာကွယ်ရေး":
      "အပူဒဏ်ကာကွယ်ရန်\n" +
      "• ရေကို ပုံမှန်သောက်ပါ။\n" +
      "• နေပူပြင်းချိန်တွင် အပြင်ထွက်ခြင်းကို လျှော့ချပါ။\n" +
      "• အရိပ်ရပြီး လေဝင်လေထွက်ကောင်းသော နေရာတွင် နေပါ။\n" +
      "• မူးဝေခြင်း၊ သတိလစ်ခြင်း သို့မဟုတ် စိတ်ရှုပ်ထွေးခြင်းရှိပါက အရေးပေါ်အကူအညီ ရယူပါ။",

    "🥗 အာဟာရနှင့် ကျန်းမာရေး":
      "အာဟာရမျှတစေရန် အစားအစာအမျိုးမျိုးကို သင့်တင့်မျှတစွာ စားပါ။ " +
      "ဟင်းသီးဟင်းရွက်၊ သစ်သီး၊ ပရိုတင်းပါသော အစားအစာများနှင့် သန့်ရှင်းသောရေကို ရွေးချယ်ပါ။",

    "🤰 မိခင်နှင့် ကလေးကျန်းမာရေး":
      "ကိုယ်ဝန်ဆောင်စောင့်ရှောက်မှုနှင့် ကလေးကျန်းမာရေးအတွက် ကျန်းမာရေးဝန်ထမ်းထံ ပုံမှန်တိုင်ပင်ပါ။ " +
      "စိုးရိမ်ရသော လက္ခဏာများရှိပါက ဆေးကုသမှုကို မနှောင့်နှေးပါနှင့်။",

    "🩺 လက္ခဏာများရှိလျှင် ဘာလုပ်မလဲ":
      "လက္ခဏာများကို ကိုယ်တိုင်ရောဂါသတ်မှတ်ရန် မကြိုးစားပါနှင့်။ " +
      "အသက်ရှူရခက်ခြင်း၊ သတိလစ်ခြင်း၊ ရင်ဘတ်ပြင်းထန်စွာနာခြင်းကဲ့သို့ အရေးပေါ်လက္ခဏာများရှိပါက " +
      "ချက်ချင်း အရေးပေါ်ဆေးကုသမှု ရယူပါ။ အခြားကျန်းမာရေးမေးခွန်းများအတွက် 7887 သို့ ဆက်သွယ်နိုင်ပါသည်။"
  };

  if (articles[text]) {
    return bot.sendMessage(chatId, articles[text], mainMenu);
  }

  if (text === "🏠 ပင်မမီနူး") {
    return showMenu(chatId);
  }

  // Start health consultation
  if (text === "🩺 ကျန်းမာရေးအချက်အလက် ဖြေဆိုမယ်") {
    sessions.set(chatId, {
      step: "age",
      language: "my"
    });

    return bot.sendMessage(
      chatId,
      "သင့်အသက်ကို နှစ်ဖြင့် ရိုက်ထည့်ပါ။ (ဥပမာ - 25)\n\n" +
      "ရပ်လိုပါက /cancel ကို ရိုက်ပါ။"
    );
  }

  if (!session) return;

  // Age step
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
      "သင့်ကျား/မ ကို ရွေးပါ။",
      {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "ကျား",
                callback_data: "gender_male"
              }
            ],
            [
              {
                text: "မ",
                callback_data: "gender_female"
              }
            ],
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

  // Symptom or question step
  if (session.step === "symptom") {
    if (text.length < 2 || text.length > 1500) {
      return bot.sendMessage(
        chatId,
        "မေးခွန်းကို စာလုံး 2 မှ 1500 အတွင်း ရေးပေးပါ။"
      );
    }

    const urgent =
      /အသက်ရှူ.{0,10}(ခက်|မရ)|သတိလစ်|ရင်ဘတ်.{0,10}(ပြင်းထန်|အရမ်း).{0,10}နာ|သွေးထွက်.{0,10}(များ|မရပ်)|severe chest pain|difficulty breathing|unconscious|heavy bleeding/i.test(text);

    session.symptom = text;

    if (urgent) {
      sessions.delete(chatId);

      return bot.sendMessage(
        chatId,
        "🚨 အရေးပေါ်သတိပေးချက်\n\n" +
        "ဖော်ပြထားသော လက္ခဏာများသည် အရေးပေါ်ဖြစ်နိုင်ပါသည်။ " +
        "Bot ကို ဆက်မစောင့်ဘဲ အနီးဆုံးဆေးရုံ/အရေးပေါ်ဆေးကုသမှုကို ချက်ချင်းရယူပါ။ " +
        "7887 ကို စောင့်ဆိုင်းခြင်းကြောင့် ကုသမှု မနှောင့်နှေးပါစေနှင့်။",
        mainMenu
      );
    }

    session.step = "duration";

    return bot.sendMessage(
      chatId,
      "ဒီလက္ခဏာ သို့မဟုတ် ပြဿနာက ဘယ်လောက်ကြာပြီလဲ။ " +
      "ဥပမာ — ဒီနေ့မှ၊ ၂ ရက်၊ ၁ ပတ်။"
    );
  }

  // Duration step
  if (session.step === "duration") {
    if (text.length < 1 || text.length > 100) {
      return bot.sendMessage(
        chatId,
        "ကြာချိန်ကို အတိုချုံး ပြန်ရေးပေးပါ။"
      );
    }

    session.duration = text;
    session.step = "severity";

    return bot.sendMessage(
      chatId,
      "လက္ခဏာ ပြင်းထန်မှုကို ရွေးချယ်ပါ။",
      {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "🟢 အနည်းငယ်",
                callback_data: "severity_mild"
              }
            ],
            [
              {
                text: "🟡 အလယ်အလတ်",
                callback_data: "severity_moderate"
              }
            ],
            [
              {
                text: "🔴 ပြင်းထန်",
                callback_data: "severity_severe"
              }
            ]
          ]
        }
      }
    );
  }
});

// Handle button selections
bot.on("callback_query", async query => {
  const chatId = query.message.chat.id;
  const data = query.data;
  const session = sessions.get(chatId);

  await bot.answerCallbackQuery(query.id);

  // Health education navigation
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

  // 7887 call instructions
  if (data === "call_7887") {
    return bot.sendMessage(
      chatId,
      "သင့်ဖုန်း၏ ဖုန်းခေါ်ဆိုမှုစနစ်ကို ဖွင့်ပြီး 7887 ကို ကိုယ်တိုင်ခေါ်ဆိုပါ။ " +
      "Telegram Bot က သင့်အစား ဖုန်းခေါ်ဆိုပေးနိုင်ခြင်း မရှိပါ။"
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
    session.step = "topic";
    session.marital_status = "not_collected";

    return bot.sendMessage(
      chatId,
      "ဘယ်ကျန်းမာရေးအကြောင်းအရာနဲ့ ပတ်သက်ပြီး မေးမြန်းလိုပါသလဲ။",
      {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "🩺 အထွေထွေကျန်းမာရေး",
                callback_data: "topic_general"
              }
            ],
            [
              {
                text: "🌸 SRHR / လိင်နှင့် မျိုးဆက်ပွားကျန်းမာရေး",
                callback_data: "topic_srhr"
              }
            ],
            [
              {
                text: "🩸 ရာသီလာခြင်း",
                callback_data: "topic_menstrual"
              }
            ],
            [
              {
                text: "🤰 ကိုယ်ဝန်ဆောင်ကျန်းမာရေး",
                callback_data: "topic_pregnancy"
              }
            ],
            [
              {
                text: "🛡️ STI/HIV ကာကွယ်ရေး",
                callback_data: "topic_sti"
              }
            ]
          ]
        }
      }
    );
  }

  // Health topic selection
  if (data.startsWith("topic_") && session.step === "topic") {
    const topics = {
      topic_general: "general_health",
      topic_srhr: "srhr",
      topic_menstrual: "menstrual_health",
      topic_pregnancy: "pregnancy_health",
      topic_sti: "sti_hiv"
    };

    const labels = {
      topic_general: "အထွေထွေကျန်းမာရေး",
      topic_srhr: "SRHR / လိင်နှင့် မျိုးဆက်ပွားကျန်းမာရေး",
      topic_menstrual: "ရာသီလာခြင်း",
      topic_pregnancy: "ကိုယ်ဝန်ဆောင်ကျန်းမာရေး",
      topic_sti: "STI/HIV ကာကွယ်ရေး"
    };

    if (!topics[data]) return;

    session.topic = topics[data];
    session.topic_label = labels[data];
    session.step = "symptom";

    return bot.sendMessage(
      chatId,
      `ရွေးချယ်ထားသောအကြောင်းအရာ — ${session.topic_label}\n\n` +
      "ဘယ်လိုလက္ခဏာ၊ ပြဿနာ သို့မဟုတ် မေးခွန်းရှိပါသလဲ။ စာဖြင့် ရေးပေးပါ။\n\n" +
      "အမည်၊ နေရပ်လိပ်စာ၊ မှတ်ပုံတင်နံပါတ်ကဲ့သို့ မလိုအပ်သော ကိုယ်ရေးအချက်အလက်များ မထည့်ပါနှင့်။"
    );
  }

  // Severity selection
  if (data.startsWith("severity_") && session.step === "severity") {
    const severityMap = {
      severity_mild: "အနည်းငယ်",
      severity_moderate: "အလယ်အလတ်",
      severity_severe: "ပြင်းထန်"
    };

    const severity = severityMap[data];

    if (!severity) return;

    session.severity = severity;

    if (data === "severity_severe") {
      await bot.sendMessage(
        chatId,
        "⚠️ လက္ခဏာကို ပြင်းထန်သည်ဟု ရွေးထားပါသည်။ " +
        "အခြေအနေ ပိုဆိုးလာခြင်း၊ အသက်ရှူရခက်ခြင်း၊ သတိလစ်ခြင်း၊ " +
        "ရင်ဘတ်ပြင်းထန်စွာနာခြင်းရှိပါက အရေးပေါ်ဆေးကုသမှု ချက်ချင်းရယူပါ။"
      );
    }

    session.step = "consent";

    return bot.sendMessage(
      chatId,
      "သင့်ဖြေဆိုချက်များကို သိမ်းဆည်းရန် သဘောတူပါသလား။\n\n" +
      "သဘောတူပါက Telegram Chat ID၊ အသက်၊ ကျား/မ၊ " +
      "ရွေးချယ်ထားသောအကြောင်းအရာနှင့် ဖြေဆိုချက်များကို သိမ်းဆည်းမည်ဖြစ်သည်။\n\n" +
      "မလိုအပ်သော ကိုယ်ရေးအချက်အလက်များ မပို့ပါနှင့်။",
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

  // User declines data storage
  if (data === "consent_no") {
    sessions.delete(chatId);

    return bot.sendMessage(
      chatId,
      "သဘောတူညီမှု မပေးထားသောကြောင့် ဖြေဆိုချက်များကို database ထဲ မသိမ်းပါ။",
      mainMenu
    );
  }

  // User agrees to data storage
  if (data === "consent_yes" && session.step === "consent") {
    if (!db) {
      sessions.delete(chatId);

      return bot.sendMessage(
        chatId,
        "လက်ရှိ ဒေတာသိမ်းဆည်းမှု မရနိုင်သေးပါ။ " +
        "သင့်ဖြေဆိုချက်များကို မသိမ်းထားပါ။ Database ကို စစ်ဆေးပြီးမှ ပြန်ကြိုးစားပါ။",
        mainMenu
      );
    }

    try {
      const requestId = crypto.randomUUID();

      const details =
        `Topic: ${session.topic_label || "General health"}\n` +
        `Question/Symptom: ${session.symptom}\n` +
        `Duration: ${session.duration || "Not provided"}\n` +
        `Severity: ${session.severity || "Not provided"}`;

      const symptomSummary =
        `${session.symptom} | Duration: ${session.duration || "Not provided"} | ` +
        `Severity: ${session.severity || "Not provided"}`;

      await db.execute(
        `INSERT INTO consultation_requests
        (request_id, telegram_chat_id, topic, language, details,
         consent_given, consent_at, status, age, gender, marital_status, symptom)
        VALUES (?, ?, ?, ?, ?, ?, NOW(), 'pending', ?, ?, ?, ?)`,
        [
          requestId,
          String(chatId),
          session.topic || "general_health",
          "my",
          details,
          1,
          session.age,
          session.gender,
          session.marital_status || "not_collected",
          symptomSummary.slice(0, 100)
        ]
      );

      const topicLabel = session.topic_label || "ကျန်းမာရေး";
      const duration = session.duration || "မဖြေထားပါ";
      const severity = session.severity || "မဖြေထားပါ";

      sessions.delete(chatId);

      return bot.sendMessage(
        chatId,
        "သင့်ဖြေဆိုချက်များကို အောင်မြင်စွာ သိမ်းဆည်းပြီးပါပြီ။\n\n" +
        `အကြောင်းအရာ — ${topicLabel}\n` +
        `ကြာချိန် — ${duration}\n` +
        `ပြင်းထန်မှု — ${severity}\n\n` +
        "ဤ Bot သည် ရောဂါအတည်ပြုခြင်း သို့မဟုတ် ဆေးညွှန်းခြင်း မပြုပါ။ " +
        "မြန်မာနိုင်ငံအတွင်းရှိပါက 7887 သို့ ဆက်သွယ်တိုင်ပင်နိုင်ပါသည်။\n\n" +
        "ပြည်ပရောက် မြန်မာများအတွက် Specialist Consultation:\n" +
        "09 442 111 110 (Phone/Viber/Telegram)",
        mainMenu
      );
    } catch (error) {
      console.error(
        "Saving response failed:",
        error.message
      );

      return bot.sendMessage(
        chatId,
        "ဒေတာသိမ်းဆည်းရာတွင် အမှားဖြစ်နေပါသည်။ " +
        "သင့်ဖြေဆိုချက်များ သိမ်းပြီးကြောင်း မအတည်ပြုနိုင်သေးပါ။ နောက်မှ ထပ်ကြိုးစားပါ။",
        mainMenu
      );
    }
  }
});

// Telegram polling errors
bot.on("polling_error", error => {
  console.error(
    "Telegram polling error:",
    error.message
  );
});

console.log("Htoo Care Telegram Bot started.");
