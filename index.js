
const TelegramBot = require("node-telegram-bot-api");
const express = require("express");
const mysql = require("mysql2/promise");
const crypto = require("crypto");

const app = express();
app.get("/", (req, res) => res.send("Htoo Care Bot is running"));
app.get("/health", (req, res) => res.json({ status: "ok" }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Web server running on ${PORT}`));

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;

if (!TOKEN) {
  console.error("Missing TELEGRAM_BOT_TOKEN environment variable");
  process.exit(1);
}

// MySQL is optional for starting the bot.
// Data cannot be saved unless the database connection works.
let db = null;

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

const bot = new TelegramBot(TOKEN, { polling: true });

// A simple in-memory conversation flow.
// If the bot restarts, users may need to start again.
const sessions = new Map();

const mainMenu = {
  reply_markup: {
    keyboard: [
      ["🩺 ကျန်းမာရေးအချက်အလက် ဖြေဆိုမယ်"],
      ["📚 ကျန်းမာရေးဗဟုသုတ ဖတ်မယ်"],
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

bot.onText(/^\/start$/, msg => {
  showMenu(msg.chat.id);
});

bot.onText(/^\/cancel$/, msg => {
  showMenu(msg.chat.id);
});

bot.on("message", async msg => {
  if (!msg.text || msg.text.startsWith("/")) return;

  const chatId = msg.chat.id;
  const text = msg.text.trim();
  const session = sessions.get(chatId);

  if (text === "📞 7887 ကို ဖုန်းဆက်မယ်") {
    return bot.sendMessage(
      chatId,
      "ကျန်းမာရေးအကြံဉာဏ် ရယူရန် 7887 သို့ ဖုန်းဆက်နိုင်ပါတယ်။\n\nအရေးပေါ်အခြေအနေဖြစ်ပါက မိမိဒေသရှိ အရေးပေါ်ဆေးကုသမှုကို ချက်ချင်းရယူပါ။",
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: "📞 7887", callback_data: "call_7887" }]
          ]
        }
      }
    );
  }

  if (text === "📚 ကျန်းမာရေးဗဟုသုတ ဖတ်မယ်") {
    return bot.sendMessage(chatId, "ဖတ်ရှုလိုသော အကြောင်းအရာကို ရွေးပါ။", {
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
    });
  }

  const articles = {
    "🌞 အပူဒဏ်ကာကွယ်ရေး":
      "အပူဒဏ်ကာကွယ်ရန်\n• ရေကို ပုံမှန်သောက်ပါ။\n• နေပူပြင်းချိန်တွင် အပြင်ထွက်ခြင်းကို လျှော့ချပါ။\n• အရိပ်ရပြီး လေဝင်လေထွက်ကောင်းသော နေရာတွင် နေပါ။\n• မူးဝေခြင်း၊ သတိလစ်ခြင်း သို့မဟုတ် စိတ်ရှုပ်ထွေးခြင်းရှိပါက အရေးပေါ်အကူအညီ ရယူပါ။",
    "🥗 အာဟာရနှင့် ကျန်းမာရေး":
      "အာဟာရမျှတစေရန် အစားအစာအမျိုးမျိုးကို သင့်တင့်မျှတစွာ စားပါ။ ဟင်းသီးဟင်းရွက်၊ သစ်သီး၊ ပရိုတင်းပါသော အစားအစာများနှင့် သန့်ရှင်းသောရေကို ရွေးချယ်ပါ။",
    "🤰 မိခင်နှင့် ကလေးကျန်းမာရေး":
      "ကိုယ်ဝန်ဆောင်စောင့်ရှောက်မှုနှင့် ကလေးကျန်းမာရေးအတွက် ကျန်းမာရေးဝန်ထမ်းထံ ပုံမှန်တိုင်ပင်ပါ။ စိုးရိမ်ရသော လက္ခဏာများရှိပါက ဆေးကုသမှုကို မနှောင့်နှေးပါနှင့်။",
    "🩺 လက္ခဏာများရှိလျှင် ဘာလုပ်မလဲ":
      "လက္ခဏာများကို ကိုယ်တိုင်ရောဂါသတ်မှတ်ရန် မကြိုးစားပါနှင့်။ အသက်ရှူရခက်ခြင်း၊ သတိလစ်ခြင်း၊ ရင်ဘတ်ပြင်းထန်စွာနာခြင်းကဲ့သို့ အရေးပေါ်လက္ခဏာများရှိပါက ချက်ချင်း အရေးပေါ်ဆေးကုသမှု ရယူပါ။ အခြားကျန်းမာရေးမေးခွန်းများအတွက် 7887 သို့ ဆက်သွယ်နိုင်ပါသည်။"
  };

  if (articles[text]) {
    return bot.sendMessage(chatId, articles[text], {
      ...mainMenu
    });
  }

  if (text === "🏠 ပင်မမီနူး") {
    return showMenu(chatId);
  }

  if (text === "🩺 ကျန်းမာရေးအချက်အလက် ဖြေဆိုမယ်") {
    sessions.set(chatId, { step: "age", language: "my" });
    return bot.sendMessage(
      chatId,
      "သင့်အသက်ကို နှစ်ဖြင့် ရိုက်ထည့်ပါ။ (ဥပမာ - 25)\n\nရပ်လိုပါက /cancel ကို ရိုက်ပါ။"
    );
  }

  if (!session) return;

  if (session.step === "age") {
    const age = Number(text);
    if (!Number.isInteger(age) || age < 1 || age > 120) {
      return bot.sendMessage(chatId, "အသက်ကို 1 မှ 120 အတွင်း ဂဏန်းဖြင့် ရိုက်ထည့်ပါ။");
    }
    session.age = age;
    session.step = "gender";
    return bot.sendMessage(chatId, "သင့်ကျား/မ ကို ရွေးပါ။", {
      reply_markup: {
        inline_keyboard: [
          [{ text: "ကျား", callback_data: "gender_male" }],
          [{ text: "မ", callback_data: "gender_female" }],
          [{ text: "မဖြေလိုပါ", callback_data: "gender_skip" }]
        ]
      }
    });
  }

  if (session.step === "marital") {
    const maritalOptions = {
      "အိမ်ထောင်ရှိ": "married",
      "အိမ်ထောင်မရှိ": "single",
      "မဖြေလိုပါ": "prefer_not_to_say"
    };

    if (!maritalOptions[text]) {
      return bot.sendMessage(chatId, "ရွေးချယ်စရာတစ်ခုကို နှိပ်ပေးပါ။");
    }

    session.marital_status = maritalOptions[text];
    session.step = "symptom";
    return bot.sendMessage(
      chatId,
      "လက်ရှိ ဘယ်လိုခံစားနေရပါသလဲ။\n\nသင့်လက္ခဏာများ သို့မဟုတ် ကျန်းမာရေးမေးခွန်းကို စာဖြင့် ရေးပေးပါ။ အမည်၊ ဖုန်းနံပါတ်ကဲ့သို့ မလိုအပ်သော ကိုယ်ရေးအချက်အလက်များ မထည့်ပါနှင့်။"
    );
  }

  if (session.step === "symptom") {
    if (text.length < 2 || text.length > 2000) {
      return bot.sendMessage(chatId, "အကြောင်းအရာကို စာလုံး 2 မှ 2000 အတွင်း ရေးပေးပါ။");
    }

    session.symptom = text;
    session.step = "consent";

    return bot.sendMessage(
      chatId,
      "သင့်ဖြေဆိုချက်များကို ကျန်းမာရေးဝန်ဆောင်မှု တိုးတက်စေရန်နှင့် စာရင်းအင်းအတွက် သိမ်းဆည်းနိုင်ပါသည်။ Telegram အကောင့်အမှတ်နှင့် ဖြေဆိုချက်များလည်း ပါဝင်နိုင်ပါသည်။\n\nသိမ်းဆည်းရန် သဘောတူပါသလား။",
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: "သဘောတူပြီး သိမ်းမယ်", callback_data: "consent_yes" }],
            [{ text: "မသိမ်းပါနဲ့", callback_data: "consent_no" }]
          ]
        }
      }
    );
  }
});

bot.on("callback_query", async query => {
  const chatId = query.message.chat.id;
  const data = query.data;
  const session = sessions.get(chatId);

  await bot.answerCallbackQuery(query.id);

  if (data === "call_7887") {
    return bot.sendMessage(
      chatId,
      "သင့်ဖုန်း၏ ဖုန်းခေါ်ဆိုမှုစနစ်ကို ဖွင့်ပြီး 7887 ကို ကိုယ်တိုင်ခေါ်ဆိုပါ။ Telegram Bot က သင့်အစား ဖုန်းခေါ်ဆိုပေးနိုင်ခြင်း မရှိပါ။"
    );
  }

  if (!session) return;

  if (data.startsWith("gender_") && session.step === "gender") {
    const genderMap = {
      gender_male: "male",
      gender_female: "female",
      gender_skip: "prefer_not_to_say"
    };

    session.gender = genderMap[data];
    session.step = "marital";

    return bot.sendMessage(chatId, "သင့်အိမ်ထောင်ရေးအခြေအနေကို ရွေးပါ။", {
      reply_markup: {
        inline_keyboard: [
          [{ text: "အိမ်ထောင်ရှိ", callback_data: "marital_married" }],
          [{ text: "အိမ်ထောင်မရှိ", callback_data: "marital_single" }],
          [{ text: "မဖြေလိုပါ", callback_data: "marital_skip" }]
        ]
      }
    });
  }

  if (data.startsWith("marital_") && session.step === "marital") {
    const maritalMap = {
      marital_married: "အိမ်ထောင်ရှိ",
      marital_single: "အိမ်ထောင်မရှိ",
      marital_skip: "မဖြေလိုပါ"
    };

    session.marital_status =
      data === "marital_married" ? "married" :
      data === "marital_single" ? "single" :
      "prefer_not_to_say";

    session.step = "symptom";
    return bot.sendMessage(
      chatId,
      "လက်ရှိ ဘယ်လိုခံစားနေရပါသလဲ။ သင့်လက္ခဏာများ သို့မဟုတ် ကျန်းမာရေးမေးခွန်းကို စာဖြင့် ရေးပေးပါ။\n\nမလိုအပ်သော ကိုယ်ရေးအချက်အလက်များ မထည့်ပါနှင့်။"
    );
  }

  if (data === "consent_no") {
    sessions.delete(chatId);
    return bot.sendMessage(
      chatId,
      "သဘောတူညီမှု မပေးထားသောကြောင့် ဖြေဆိုချက်များကို database ထဲ မသိမ်းပါ။",
      mainMenu
    );
  }

  if (data === "consent_yes" && session.step === "consent") {
    if (!db) {
      return bot.sendMessage(
        chatId,
        "လက်ရှိ ဒေတာသိမ်းဆည်းမှု မရနိုင်သေးပါ။ သင့်ဖြေဆိုချက်များကို မသိမ်းထားပါ။ နောက်မှ ထပ်ကြိုးစားပါ။",
        mainMenu
      );
    }

    try {
      const requestId = crypto.randomUUID();

      await db.execute(
        `INSERT INTO consultation_requests
        (request_id, telegram_chat_id, topic, language, details,
         consent_given, consent_at, status, age, gender, marital_status, symptom)
        VALUES (?, ?, ?, ?, ?, ?, NOW(), 'pending', ?, ?, ?, ?)`,
        [
          requestId,
          String(chatId),
          "general_health",
          "my",
          session.symptom,
          1,
          session.age,
          session.gender,
          session.marital_status,
          session.symptom
        ]
      );

      sessions.delete(chatId);

      return bot.sendMessage(
        chatId,
        "သင့်ဖြေဆိုချက်များကို အောင်မြင်စွာ သိမ်းဆည်းပြီးပါပြီ။\n\nဤ Bot သည် ရောဂါသတ်မှတ်ပေးခြင်း မပြုပါ။ ကျန်းမာရေးအကြံဉာဏ်အတွက် 7887 သို့ ဖုန်းဆက်တိုင်ပင်ပါ။",
        mainMenu
      );
    } catch (error) {
      console.error("Saving response failed:", error.message);
      return bot.sendMessage(
        chatId,
        "ဒေတာသိမ်းဆည်းရာတွင် အမှားဖြစ်နေပါသည်။ သင့်ဖြေဆိုချက်များ သိမ်းပြီးကြောင်း မအတည်ပြုနိုင်သေးပါ။ နောက်မှ ထပ်ကြိုးစားပါ။",
        mainMenu
      );
    }
  }
});

bot.on("polling_error", error => {
  console.error("Telegram polling error:", error.message);
});

console.log("Htoo Care Telegram Bot started.");
