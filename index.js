const TelegramBot = require("node-telegram-bot-api");

const TOKEN = process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN;

if (!TOKEN) {
  throw new Error("Missing TELEGRAM_BOT_TOKEN environment variable.");
}

const bot = new TelegramBot(TOKEN, { polling: false });
const sessions = new Map();
const languages = new Map();

const TEXT = {
  my: {
    welcome:
      "မင်္ဂလာပါ။ Htoo Care မှ ကြိုဆိုပါတယ်။ 💚\n\n" +
      "ကျန်းမာရေးအချက်အလက်နှင့် လမ်းညွှန်မှုများကို ရွေးချယ်နိုင်ပါတယ်။",
    menu: [
      ["🩺 ကျန်းမာရေးအချက်အလက်", "📝 လက္ခဏာလမ်းညွှန်"],
      ["🏥 ဆေးကုသမှုလမ်းညွှန်", "📞 7887 ဆက်သွယ်ရန်"],
      ["🔒 ကိုယ်ရေးအချက်အလက်", "🌐 Change Language"]
    ],
    health: "ကျန်းမာရေးအကြောင်းအရာကို ရွေးချယ်ပါ။",
    symptom:
      "လက်ရှိခံစားနေရသော လက္ခဏာကို ရေးပေးပါ။ ဥပမာ - ခေါင်းကိုက်ခြင်း၊ အဖျားတက်ခြင်း၊ ချောင်းဆိုးခြင်း။",
    duration:
      "ဒီလက္ခဏာဖြစ်နေတာ ဘယ်လောက်ကြာပြီလဲ။ ဥပမာ - ၁ ရက်၊ ၃ ရက်။",
    severity:
      "လက္ခဏာပြင်းထန်မှုကို ရွေးချယ်ပါ။",
    mild: "အနည်းငယ်",
    medium: "အလယ်အလတ်",
    severe: "ပြင်းထန်",
    emergency:
      "🚨 အရေးပေါ်သတိပေးချက်\n\n" +
      "အသက်ရှူခက်ခြင်း၊ ရင်ဘတ်ပြင်းထန်စွာနာခြင်း၊ သတိလစ်ခြင်း၊ ကိုယ်တစ်ဖက်ရုတ်တရက်အားနည်းခြင်း သို့မဟုတ် သွေးထွက်မရပ်ခြင်းရှိပါက ချက်ချင်း အရေးပေါ်ဆေးကုသမှု ရယူပါ။\n\n" +
      "Bot သည် အရေးပေါ်ဝန်ဆောင်မှု မဟုတ်ပါ။",
    result:
      "သင့်အချက်အလက်ကို လက်ခံရရှိပါပြီ။\n\n" +
      "ဒီ Bot က ရောဂါအတည်ပြုခြင်း သို့မဟုတ် ဆေးညွှန်းပေးခြင်း မလုပ်နိုင်ပါ။ လက္ခဏာဆက်ဖြစ်နေပါက ဆရာဝန်နှင့် တိုင်ပင်ပါ။",
    care:
      "🏥 ဆေးကုသမှုလမ်းညွှန်\n\n" +
      "နီးစပ်ရာ ဆေးရုံ၊ ဆေးခန်း သို့မဟုတ် သက်ဆိုင်ရာကျန်းမာရေးဝန်ထမ်းကို ဆက်သွယ်ပါ။\n\n" +
      "ဆေးရုံ/ဆေးခန်းအမည်၊ မြို့နယ် သို့မဟုတ် မြို့ကို ပေးပါက သင့်တော်သောနေရာကို ရှာဖွေရန် လမ်းညွှန်ပေးနိုင်ပါတယ်။ Bot တွင် အတည်ပြုထားသော ဆေးရုံစာရင်း အလိုအလျောက်မရှိပါ။",
    hotline:
      "📞 7887 Healthcare Call Center\n\n" +
      "7887 ကို ဖုန်းဖြင့် ဆက်သွယ်၍ ကျန်းမာရေးအကြံဉာဏ် ရယူနိုင်ပါတယ်။\n\n" +
      "ဖုန်းခေါ်ဆိုခနှင့် ရရှိနိုင်မှုသည် သင့်ဖုန်းကွန်ရက်နှင့် ဝန်ဆောင်မှုအခြေအနေပေါ် မူတည်နိုင်ပါတယ်။",
    privacy:
      "🔒 ကိုယ်ရေးအချက်အလက်\n\n" +
      "ဒီ Bot မှာ ကျန်းမာရေးဆိုင်ရာ ကိုယ်ရေးအချက်အလက်များ မလိုအပ်ဘဲ မပေးပါနှင့်။ လက်ရှိအသုံးပြုမှုတွင် စကားဝိုင်းအခြေအနေကို memory ထဲတွင် ယာယီသာ ထိန်းသိမ်းပြီး database ထဲသို့ မသိမ်းဆည်းပါ။ Telegram ကိုယ်တိုင်၏ ဒေတာစီမံခန့်ခွဲမှုစည်းမျဉ်းများလည်း သက်ဆိုင်ပါတယ်။",
    back: "⬅️ ပင်မမီနူး",
    language: "ဘာသာစကား ရွေးချယ်ပါ။"
  },
  en: {
    welcome:
      "Hello! Welcome to Htoo Care. 💚\n\n" +
      "Choose a healthcare information or guidance service below.",
    menu: [
      ["🩺 Health Information", "📝 Symptom Guidance"],
      ["🏥 Find Healthcare", "📞 Contact 7887"],
      ["🔒 Privacy Information", "🌐 Change Language"]
    ],
    health: "Choose a health topic.",
    symptom: "Describe your symptom. For example: headache, fever, or cough.",
    duration: "How long have you had this symptom? For example: 1 day or 3 days.",
    severity: "Choose the severity of your symptom.",
    mild: "Mild",
    medium: "Moderate",
    severe: "Severe",
    emergency:
      "🚨 Emergency warning\n\n" +
      "For difficulty breathing, severe chest pain, loss of consciousness, sudden one-sided weakness, or uncontrolled bleeding, seek emergency medical care immediately.\n\n" +
      "This bot is not an emergency service.",
    result:
      "Thank you. Your information has been received.\n\n" +
      "This bot cannot diagnose conditions or prescribe treatment. Consult a qualified healthcare professional if symptoms continue or worsen.",
    care:
      "🏥 Healthcare guidance\n\n" +
      "Contact a nearby hospital, clinic, or qualified healthcare professional.\n\n" +
      "Share a town or city if you would like guidance on finding a suitable facility. This bot does not have a verified live directory.",
    hotline:
      "📞 7887 Healthcare Call Center\n\n" +
      "You may call 7887 for healthcare guidance.\n\n" +
      "Call charges and availability may depend on your mobile network and service arrangements.",
    privacy:
      "🔒 Privacy information\n\n" +
      "Avoid sharing unnecessary personal or sensitive health information. This bot keeps conversation flow in temporary memory only and does not save it to a database. Telegram's own data policies also apply.",
    back: "⬅️ Main Menu",
    language: "Choose your language."
  }
};

const HEALTH_TOPICS = [
  {
    my: "🤒 အဖျားနှင့် အအေးမိ",
    en: "🤒 Fever & Cold",
    myText:
      "အနားယူပါ၊ ရေဓာတ်လုံလောက်စွာ ဖြည့်တင်းပါ။ အသက်ရှူခက်ခြင်း၊ သတိမကောင်းခြင်း သို့မဟုတ် လက္ခဏာပြင်းထန်လာခြင်းရှိပါက အမြန်ဆေးကုသမှု ရယူပါ။",
    enText:
      "Rest and drink enough fluids. Seek urgent care for difficulty breathing, altered consciousness, or severe worsening symptoms."
  },
  {
    my: "🤕 ခေါင်းကိုက်ခြင်း",
    en: "🤕 Headache",
    myText:
      "ရေသောက်ပါ၊ အနားယူပါ။ ရုတ်တရက် အလွန်ပြင်းထန်သော ခေါင်းကိုက်ခြင်း၊ ကိုယ်တစ်ဖက်အားနည်းခြင်း သို့မဟုတ် စကားပြောခက်ခြင်းရှိပါက အရေးပေါ်ကုသမှု ရယူပါ။",
    enText:
      "Drink water and rest. Sudden severe headache, one-sided weakness, or difficulty speaking requires emergency assessment."
  },
  {
    my: "🍽️ အစာအိမ်နှင့် အူလမ်းကြောင်း",
    en: "🍽️ Digestive Health",
    myText:
      "သန့်ရှင်းသောရေကို သောက်ပါ၊ အစားအစာသန့်ရှင်းမှုကို ဂရုပြုပါ။ ဝမ်းထဲသွေးပါခြင်း၊ ဗိုက်အလွန်နာခြင်း သို့မဟုတ် ရေဓာတ်ခန်းခြောက်ခြင်းရှိပါက ဆေးကုသမှု ရယူပါ။",
    enText:
      "Drink safe water and maintain food hygiene. Seek care for bloody stools, severe abdominal pain, or dehydration."
  },
  {
    my: "🤰 မိခင်နှင့် မျိုးဆက်ပွားကျန်းမာရေး",
    en: "🤰 Maternal & Reproductive Health",
    myText:
      "ကိုယ်ဝန်ဆောင်စောင့်ရှောက်မှု၊ ရာသီစက်ဝန်းနှင့် မျိုးဆက်ပွားကျန်းမာရေးဆိုင်ရာ မေးခွန်းများအတွက် ကျန်းမာရေးပညာရှင်နှင့် တိုင်ပင်ပါ။ ကိုယ်ဝန်ဆောင်စဉ် သွေးဆင်းခြင်း သို့မဟုတ် ပြင်းထန်သောဗိုက်နာခြင်းဖြစ်ပါက အမြန်ဆေးကုသမှု ရယူပါ။",
    enText:
      "Consult a healthcare professional about pregnancy care, menstrual health, and reproductive health. Bleeding or severe abdominal pain during pregnancy requires urgent assessment."
  },
  {
    my: "💚 စိတ်ကျန်းမာရေး",
    en: "💚 Mental Health",
    myText:
      "ယုံကြည်ရသူနှင့် ဆွေးနွေးပြီး အနားယူချိန်ပေးပါ။ မိမိကိုယ်ကို ထိခိုက်စေနိုင်သည့် အန္တရာယ်ရှိပါက တစ်ယောက်တည်းမနေဘဲ ယုံကြည်ရသူနှင့် အရေးပေါ်အကူအညီကို ချက်ချင်းဆက်သွယ်ပါ။",
    enText:
      "Talk to someone you trust and make time to rest. If you may harm yourself, do not stay alone; contact someone you trust and seek urgent professional help."
  }
];

function langOf(id) {
  return languages.get(id) || "my";
}

function t(id) {
  return TEXT[langOf(id)];
}

function mainKeyboard(id) {
  return {
    keyboard: [
      ...t(id).menu,
      [t(id).back]
    ],
    resize_keyboard: true
  };
}

function send(id, message, options = {}) {
  return bot.sendMessage(id, message, {
    ...options,
    reply_markup: options.reply_markup || mainKeyboard(id)
  });
}

function hasEmergencyWords(message) {
  const value = message.toLowerCase();

  const patterns = [
    /အသက်ရှူခက်/,
    /ရင်ဘတ်.*နာ/,
    /သတိလစ်/,
    /သွေးထွက်.*မရပ်/,
    /ကိုယ်တစ်ဖက်.*အားနည်း/,
    /difficulty breathing/,
    /cannot breathe/,
    /severe chest pain/,
    /unconscious/,
    /uncontrolled bleeding/,
    /one-sided weakness/
  ];

  return patterns.some((pattern) => pattern.test(value));
}

async function showLanguageMenu(id) {
  return bot.sendMessage(id, "Choose your language / ဘာသာစကား ရွေးချယ်ပါ။", {
    reply_markup: {
      keyboard: [
        ["မြန်မာဘာသာ 🇲🇲", "English 🇬🇧"]
      ],
      resize_keyboard: true,
      one_time_keyboard: true
    }
  });
}

async function showHealthTopics(id) {
  const lang = langOf(id);

  const buttons = HEALTH_TOPICS.map((topic) => [
    lang === "en" ? topic.en : topic.my
  ]);

  buttons.push([t(id).back]);

  return bot.sendMessage(id, t(id).health, {
    reply_markup: {
      keyboard: buttons,
      resize_keyboard: true
    }
  });
}

bot.on("polling_error", (error) => {
  console.error("Telegram polling error:", error.message);
});

bot.on("message", async (msg) => {
  const id = msg.chat.id;
  const input = (msg.text || "").trim();

  if (!input) {
    return;
  }

  try {
    if (input === "/start" || input === "/menu") {
      sessions.delete(id);
      await showLanguageMenu(id);
      return;
    }

    if (input === "/language" || input === "🌐 Change Language") {
      await showLanguageMenu(id);
      return;
    }

    if (input === "မြန်မာဘာသာ 🇲🇲") {
      languages.set(id, "my");
      sessions.delete(id);
      await send(id, t(id).welcome);
      return;
    }

    if (input === "English 🇬🇧") {
      languages.set(id, "en");
      sessions.delete(id);
      await send(id, t(id).welcome);
      return;
    }

    if (!languages.has(id)) {
      languages.set(id, "my");
    }

    if (hasEmergencyWords(input)) {
      sessions.delete(id);
      await send(id, t(id).emergency);
      return;
    }

    if (input === t(id).back) {
      sessions.delete(id);
      await send(id, t(id).welcome);
      return;
    }

    if (input === "🩺 ကျန်းမာရေးအချက်အလက်" ||
        input === "🩺 Health Information") {
      await showHealthTopics(id);
      return;
    }

    const topic = HEALTH_TOPICS.find(
      (item) => input === item.my || input === item.en
    );

    if (topic) {
      const lang = langOf(id);
      const text = lang === "en" ? topic.enText : topic.myText;

      await send(
        id,
        `${input}\n\n${text}\n\n` +
        (lang === "en"
          ? "This information is general guidance, not a diagnosis."
          : "ဤအချက်အလက်သည် အထွေထွေလမ်းညွှန်မှုသာဖြစ်ပြီး ရောဂါအတည်ပြုချက် မဟုတ်ပါ။")
      );
      return;
    }

    if (input === "📝 လက္ခဏာလမ်းညွှန်" ||
        input === "📝 Symptom Guidance") {
      sessions.set(id, { step: "symptom" });
      await send(id, t(id).symptom);
      return;
    }

    const session = sessions.get(id);

    if (session?.step === "symptom") {
      session.symptom = input;
      session.step = "duration";
      sessions.set(id, session);
      await send(id, t(id).duration);
      return;
    }

    if (session?.step === "duration") {
      session.duration = input;
      session.step = "severity";
      sessions.set(id, session);

      await bot.sendMessage(id, t(id).severity, {
        reply_markup: {
          keyboard: [
            [t(id).mild, t(id).medium, t(id).severe],
            [t(id).back]
          ],
          resize_keyboard: true
        }
      });
      return;
    }

    if (session?.step === "severity") {
      session.severity = input;
      sessions.delete(id);

      const lang = langOf(id);
      const summary = lang === "en"
        ? `Symptom: ${session.symptom}\nDuration: ${session.duration}\nSeverity: ${session.severity}\n\n`
        : `လက္ခဏာ: ${session.symptom}\nကြာချိန်: ${session.duration}\nပြင်းထန်မှု: ${session.severity}\n\n`;

      await send(id, summary + t(id).result);
      return;
    }

    if (input === "🏥 ဆေးကုသမှုလမ်းညွှန်" ||
        input === "🏥 Find Healthcare") {
      await send(id, t(id).care);
      return;
    }

    if (input === "📞 7887 ဆက်သွယ်ရန်" ||
        input === "📞 Contact 7887") {
      await send(id, t(id).hotline);
      return;
    }

    if (input === "🔒 ကိုယ်ရေးအချက်အလက်" ||
        input === "🔒 Privacy Information") {
      await send(id, t(id).privacy);
      return;
    }

    await send(
      id,
      langOf(id) === "en"
        ? "Please choose an option from the menu, or type /start to begin again."
        : "ကျေးဇူးပြု၍ Menu ထဲမှ ရွေးချယ်ပါ။ ပြန်စရန် /start ကို ရိုက်ထည့်ပါ။"
    );
  } catch (error) {
    console.error("Message handler error:", error.message);

    try {
      await bot.sendMessage(
        id,
        "တောင်းပန်ပါတယ်။ ခဏအကြာတွင် ပြန်လည်ကြိုးစားပေးပါ။ / Please try again shortly."
      );
    } catch (sendError) {
      console.error("Reply error:", sendError.message);
    }
  }
});

async function startBot() {
  try {
    await bot.deleteWebHook();
    await bot.startPolling();
    console.log("Htoo Care bot is running in polling mode.");
  } catch (error) {
    console.error("Could not start Telegram polling:", error.message);
    process.exit(1);
  }
}

startBot();
