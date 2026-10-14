
const express = require("express");
const TelegramBot = require("node-telegram-bot-api");

const app = express();
app.use(express.json());

const TOKEN = process.env.BOT_TOKEN;
const BASE_URL = process.env.RENDER_EXTERNAL_URL;

if (!TOKEN || !BASE_URL) {
  throw new Error("BOT_TOKEN and RENDER_EXTERNAL_URL are required.");
}

const bot = new TelegramBot(TOKEN, { polling: false });
const webhookPath = `/telegram-webhook/${TOKEN}`;

const languages = new Map();
const sessions = new Map();

const categories = [
  {
    my: "🧠 ခေါင်းကိုက်ခြင်းနှင့် အာရုံကြောဆိုင်ရာ",
    en: "🧠 Headache & Neurological Health",
    infoMy: "ခေါင်းကိုက်ခြင်း၊ မူးဝေခြင်းနှင့် အိပ်စက်မှုအခက်အခဲများအကြောင်း အထွေထွေအချက်အလက်ကို ရယူနိုင်ပါတယ်။",
    infoEn: "General information about headaches, dizziness, and sleep difficulties."
  },
  {
    my: "🤧 အဖျား၊ အအေးမိနှင့် အသက်ရှူလမ်းကြောင်း",
    en: "🤧 Fever, Cold & Respiratory Health",
    infoMy: "အဖျား၊ ချောင်းဆိုး၊ လည်ချောင်းနာနှင့် နှာစေးခြင်းဆိုင်ရာ အချက်အလက်များ။",
    infoEn: "General information about fever, cough, sore throat, and a runny nose."
  },
  {
    my: "🍽️ အစာအိမ်နှင့် အူလမ်းကြောင်း",
    en: "🍽️ Digestive Health",
    infoMy: "ဝမ်းလျှော၊ ဝမ်းချုပ်၊ ဗိုက်နာ၊ အန်ခြင်းနှင့် အစာမကြေခြင်းဆိုင်ရာ အချက်အလက်များ။",
    infoEn: "General information about diarrhoea, constipation, stomach pain, vomiting, and indigestion."
  },
  {
    my: "❤️ နာတာရှည်ရောဂါများ",
    en: "❤️ Chronic Conditions",
    infoMy: "သွေးတိုး၊ ဆီးချို၊ နှလုံးရောဂါနှင့် ကိုလက်စထရောအကြောင်း။ ပုံမှန်ဆေးစစ်မှုနှင့် ဆရာဝန်၏ အကြံပြုချက်ကို လိုက်နာပါ။",
    infoEn: "Information about hypertension, diabetes, heart disease, and cholesterol. Follow your clinician's advice and regular check-ups."
  },
  {
    my: "🤰 မိခင်နှင့် မျိုးဆက်ပွားကျန်းမာရေး",
    en: "🤰 Maternal & Reproductive Health",
    infoMy: "ကိုယ်ဝန်ဆောင်စောင့်ရှောက်မှု၊ ရာသီလာခြင်းနှင့် သားဆက်ခြားခြင်းဆိုင်ရာ အချက်အလက်များ။",
    infoEn: "General information about pregnancy care, menstruation, and contraception."
  },
  {
    my: "🩹 အရေပြားနှင့် ဓာတ်မတည့်ခြင်း",
    en: "🩹 Skin & Allergies",
    infoMy: "ယားယံခြင်း၊ အဖုထွက်ခြင်းနှင့် ဓာတ်မတည့်ခြင်းဆိုင်ရာ အချက်အလက်များ။",
    infoEn: "General information about itching, rashes, and allergies."
  },
  {
    my: "💚 စိတ်ကျန်းမာရေး",
    en: "💚 Mental Health",
    infoMy: "စိတ်ဖိစီးမှု၊ စိုးရိမ်ပူပန်မှုနှင့် အိပ်စက်မှုအခက်အခဲများအကြောင်း။",
    infoEn: "General information about stress, anxiety, and sleep difficulties."
  },
  {
    my: "🦴 အရိုး၊ အဆစ်နှင့် ကြွက်သား",
    en: "🦴 Bones, Joints & Muscles",
    infoMy: "ခါးနာ၊ လည်ပင်းနာ၊ အဆစ်နာနှင့် ကြွက်သားနာခြင်းဆိုင်ရာ အချက်အလက်များ။",
    infoEn: "General information about back, neck, joint, and muscle pain."
  },
  {
    my: "👁️ မျက်စိ၊ နား၊ နှာခေါင်းနှင့် သွား",
    en: "👁️ Eye, Ear, Nose & Dental Health",
    infoMy: "မျက်စိ၊ နား၊ နှာခေါင်းနှင့် သွားကျန်းမာရေးအတွက် အထွေထွေအချက်အလက်များ။",
    infoEn: "General information about eye, ear, nose, and dental health."
  },
  {
    my: "👶 ကလေးကျန်းမာရေးနှင့် ကာကွယ်ဆေး",
    en: "👶 Child Health & Vaccination",
    infoMy: "ကလေးစောင့်ရှောက်မှု၊ အာဟာရနှင့် ကာကွယ်ဆေးဆိုင်ရာ အချက်အလက်များ။",
    infoEn: "General information about child care, nutrition, and vaccination."
  },
  {
    my: "🥗 အာဟာရ၊ ရေဓာတ်နှင့် ကိုယ်အလေးချိန်",
    en: "🥗 Nutrition, Hydration & Weight",
    infoMy: "အာဟာရမျှတစွာစားသုံးခြင်း၊ ရေလုံလောက်စွာသောက်ခြင်းနှင့် ကျန်းမာသော ကိုယ်အလေးချိန်အကြောင်း။",
    infoEn: "General information about balanced nutrition, hydration, and healthy weight."
  },
  {
    my: "🚻 ဆီးလမ်းကြောင်းဆိုင်ရာ",
    en: "🚻 Urinary Health",
    infoMy: "ဆီးကျင်ခြင်း၊ ဆီးခဏခဏသွားခြင်းနှင့် ဆီးလမ်းကြောင်းဆိုင်ရာ လက္ခဏာများ။",
    infoEn: "General information about painful or frequent urination and urinary symptoms."
  },
  {
    my: "🚑 ထိခိုက်ဒဏ်ရာနှင့် အရေးပေါ်အခြေအနေ",
    en: "🚑 Injuries & Emergencies",
    infoMy: "ထိခိုက်ဒဏ်ရာ သို့မဟုတ် အရေးပေါ်လက္ခဏာများရှိပါက ချက်ချင်းဆေးကုသမှုရယူပါ။",
    infoEn: "For serious injuries or emergency warning signs, seek urgent medical care."
  }
];

const text = {
  my: {
    welcome: "မင်္ဂလာပါ။ Htoo Care မှ ကြိုဆိုပါတယ်။ 💚\n\nကျန်းမာရေးအချက်အလက်များ ကြည့်ရှုရန် သို့မဟုတ် လက္ခဏာများကို အဆင့်လိုက် ပြောပြရန် အောက်ပါ Menu ကို ရွေးချယ်ပါ။",
    health: "📚 ကျန်းမာရေးအချက်အလက်",
    symptoms: "🤒 လက္ခဏာစစ်ဆေးရန်",
    contact: "📞 7887 ဆက်သွယ်ရန်",
    language: "🌐 English",
    back: "🏠 ပင်မ Menu",
    chooseHealth: "ကျန်းမာရေးအမျိုးအစားကို ရွေးချယ်ပါ။",
    symptomAsk: "ဘယ်လိုလက္ခဏာ ခံစားနေရပါသလဲ။ ဥပမာ - ခေါင်းကိုက်၊ အဖျားတက်၊ ဝမ်းလျှော။",
    redFlagAsk: "အသက်ရှူမဝခြင်း၊ ရင်ဘတ်အောင့်ခြင်း၊ သတိလစ်ခြင်း၊ ရုတ်တရက် စကားမပြောနိုင်ခြင်း သို့မဟုတ် ကိုယ်တစ်ဖက်အားနည်းခြင်းလို အရေးပေါ်လက္ခဏာ ရှိပါသလား။",
    yes: "ရှိပါတယ်",
    no: "မရှိပါ",
    duration: "ဒီလက္ခဏာ ဘယ်လောက်ကြာပြီလဲ။ ဥပမာ - ဒီနေ့မှ၊ ၂ ရက်၊ ၁ ပတ်။",
    severity: "လက္ခဏာပြင်းထန်မှုကို ရွေးချယ်ပါ။",
    mild: "အနည်းငယ်",
    moderate: "အလယ်အလတ်",
    severe: "ပြင်းထန်",
    summary: "အချက်အလက်ပေးတဲ့အတွက် ကျေးဇူးတင်ပါတယ်။ ဒီအချက်အလက်တွေက ရောဂါအတည်ပြုချက် မဟုတ်ပါဘူး။ လက္ခဏာမသက်သာခြင်း၊ ပိုဆိုးလာခြင်း သို့မဟုတ် စိုးရိမ်စရာရှိပါက ဆရာဝန်နဲ့ တိုင်ပင်ပါ။",
    emergency: "🚨 အရေးပေါ်သတိပေးချက်\n\nသင်ဖော်ပြထားသော လက္ခဏာသည် အရေးပေါ်အခြေအနေ ဖြစ်နိုင်ပါတယ်။ Bot နဲ့ ဆက်လက်မေးခွန်းဖြေဆိုခြင်းကို ရပ်ပြီး အနီးဆုံး အရေးပေါ်ဆေးကုသမှုကို ချက်ချင်းရယူပါ။ လုံခြုံစွာ သွားလာနိုင်ခြင်းမရှိပါက ဒေသဆိုင်ရာ အရေးပေါ်အကူအညီကို ခေါ်ပါ။",
    emergencyYes: "အရေးပေါ်လက္ခဏာရှိကြောင်း ပြောပြထားတဲ့အတွက် ပုံမှန်မေးခွန်းများကို ရပ်လိုက်ပါတယ်။ ချက်ချင်းဆေးကုသမှု ရယူပါ။",
    contactInfo: "📞 7887 Healthcare Call Center\n\n7887 ကို ဖုန်းခေါ်ဆိုပြီး ကျန်းမာရေးအကြံဉာဏ်ရယူရန် ကြိုးစားနိုင်ပါတယ်။ ဖုန်းခေါ်ဆိုခနှင့် ဝန်ဆောင်မှုရရှိနိုင်မှုသည် သင့်ဖုန်းလိုင်းနှင့် လက်ရှိဝန်ဆောင်မှုအခြေအနေပေါ် မူတည်နိုင်ပါတယ်။ အရေးပေါ်အခြေအနေတွင် 7887 အဖြေကို စောင့်မနေဘဲ အရေးပေါ်ဆေးကုသမှု ရယူပါ။",
    healthDisclaimer: "\n\n⚠️ အထွေထွေကျန်းမာရေးအချက်အလက်သာ ဖြစ်ပါတယ်။ ရောဂါအတည်ပြုခြင်း သို့မဟုတ် ဆေးညွှန်းခြင်း မဟုတ်ပါ။",
    fallback: "မေးမြန်းချက်ကို နားလည်ရန် ခက်ခဲနေပါတယ်။ အောက်ပါ Menu ကို ရွေးချယ်ပါ။",
    mainMenu: "ပင်မ Menu ကို ပြန်ရောက်ပါပြီ။",
    topicPrefix: "📚 ကျန်းမာရေးအချက်အလက်\n\n"
  },
  en: {
    welcome: "Welcome to Htoo Care. 💚\n\nChoose an option below for health information or guided symptom intake.",
    health: "📚 Health Information",
    symptoms: "🤒 Check Symptoms",
    contact: "📞 Contact 7887",
    language: "🌐 မြန်မာဘာသာ",
    back: "🏠 Main Menu",
    chooseHealth: "Choose a health category.",
    symptomAsk: "What symptom are you experiencing? For example: headache, fever, or diarrhoea.",
    redFlagAsk: "Do you have any emergency warning signs, such as difficulty breathing, chest pain, loss of consciousness, sudden difficulty speaking, or sudden weakness on one side?",
    yes: "Yes",
    no: "No",
    duration: "How long have you had this symptom? For example: today, 2 days, or 1 week.",
    severity: "Choose the severity of your symptom.",
    mild: "Mild",
    moderate: "Moderate",
    severe: "Severe",
    summary: "Thank you for sharing. This is not a diagnosis. Consult a healthcare professional if symptoms persist, worsen, or concern you.",
    emergency: "🚨 EMERGENCY WARNING\n\nYour symptoms may indicate an emergency. Stop this chat assessment and seek urgent medical care now. If you cannot travel safely, contact local emergency services.",
    emergencyYes: "You reported an emergency warning sign. The routine questions have stopped. Please seek urgent medical care now.",
    contactInfo: "📞 7887 Healthcare Call Center\n\nYou may try calling 7887 for health guidance. Call charges and availability may depend on your phone network and current service arrangements. For an emergency, do not wait for a 7887 response; seek urgent medical care.",
    healthDisclaimer: "\n\n⚠️ General health information only. This is not a diagnosis or prescription.",
    fallback: "Sorry, I didn't understand. Please choose an option from the menu.",
    mainMenu: "You are back at the main menu.",
    topicPrefix: "📚 Health Information\n\n"
  }
};

function getLang(id) {
  return languages.get(id) || "my";
}

function tr(id) {
  return text[getLang(id)];
}

function mainKeyboard(id) {
  const t = tr(id);
  return {
    keyboard: [
      [t.health],
      [t.symptoms],
      [t.contact, t.language]
    ],
    resize_keyboard: true
  };
}

function topicKeyboard(id) {
  const lang = getLang(id);
  const rows = [];
  for (let i = 0; i < categories.length; i += 2) {
    rows.push(categories.slice(i, i + 2).map(c => c[lang]));
  }
  rows.push([tr(id).back]);
  return { keyboard: rows, resize_keyboard: true };
}

function choiceKeyboard(id, options) {
  return {
    keyboard: options.map(option => [option]),
    resize_keyboard: true,
    one_time_keyboard: true
  };
}

function send(id, message, keyboard = mainKeyboard(id)) {
  return bot.sendMessage(id, message, { reply_markup: keyboard });
}

function isYes(value, lang) {
  const s = value.trim().toLowerCase();
  return lang === "my"
    ? ["ရှိပါတယ်", "ရှိ", "ဟုတ်", "ဟုတ်ကဲ့", "ရှိတယ်"].includes(s)
    : ["yes", "y", "yes please"].includes(s);
}

function isNo(value, lang) {
  const s = value.trim().toLowerCase();
  return lang === "my"
    ? ["မရှိပါ", "မရှိ", "မရှိဘူး", "မရှိပါဘူး", "မဟုတ်"].includes(s)
    : ["no", "n", "nope"].includes(s);
}

function emergencyDetected(value) {
  const s = value.toLowerCase();

  const patterns = [
    /အသက်ရှူမဝ|အသက်ရှူမရ|အသက်ရှူခက်|အသက်ရှူကြပ်/,
    /ရင်ဘတ်အောင့်|ရင်ဘတ်အရမ်းနာ|ရင်ဘတ်နာ/,
    /သတိလစ်|သတိမရ|မေ့လဲ/,
    /သွေးအများကြီးထွက်|သွေးမတိတ်/,
    /တက်နေ|တက်ခြင်း|တက်သွား/,
    /စကားမပြောနိုင်|စကားပြောမရ|ကိုယ်တစ်ဖက်အားနည်း|မျက်နှာရွဲ့/,
    /လည်ချောင်းပိတ်|လျှာဖောင်း|မျက်နှာဖောင်း/,
    /suicidal|kill myself|want to die|can't breathe|cannot breathe|difficulty breathing|shortness of breath|chest pain|unconscious|passed out|severe bleeding|face drooping|one-sided weakness|throat closing|tongue swelling/
  ];

  return patterns.some(pattern => pattern.test(s));
}

function detectCategory(value, lang) {
  return categories.findIndex(c =>
    value.trim() === c[lang] ||
    value.trim() === c.my ||
    value.trim() === c.en
  );
}

function startSymptoms(id) {
  sessions.set(id, { flow: "symptom", step: "symptom" });
  return send(id, tr(id).symptomAsk, {
    keyboard: [[tr(id).back]],
    resize_keyboard: true
  });
}

async function handleMessage(msg) {
  if (!msg.text || !msg.chat) return;

  const id = String(msg.chat.id);
  const input = msg.text.trim();
  const lang = getLang(id);
  const t = tr(id);

  if (input === "/start" || input === "/menu") {
    sessions.delete(id);
    return send(id, t.welcome);
  }

  if (input === "/language") {
    return send(id, "Choose your language / ဘာသာစကားရွေးချယ်ပါ။", {
      keyboard: [["မြန်မာဘာသာ", "English"]],
      resize_keyboard: true
    });
  }

  if (input === "English" || input === "🌐 English") {
    languages.set(id, "en");
    sessions.delete(id);
    return send(id, text.en.welcome, mainKeyboard(id));
  }

  if (input === "မြန်မာဘာသာ" || input === "🌐 မြန်မာဘာသာ") {
    languages.set(id, "my");
    sessions.delete(id);
    return send(id, text.my.welcome, mainKeyboard(id));
  }

  if (input === t.back || input === "🏠 Main Menu" || input === "🏠 ပင်မ Menu") {
    sessions.delete(id);
    return send(id, t.mainMenu, mainKeyboard(id));
  }

  // Check emergency signs before continuing routine symptom questions.
  // Yes/no answers are handled by the current guided question below.
  const session = sessions.get(id);
  const isExpectedYesNo = session &&
    ["redflags"].includes(session.step) &&
    (isYes(input, lang) || isNo(input, lang));

  if (!isExpectedYesNo && emergencyDetected(input)) {
    sessions.delete(id);
    return send(id, t.emergency, mainKeyboard(id));
  }

  if (input === t.health) {
    sessions.set(id, { flow: "health", step: "topic" });
    return send(id, t.chooseHealth, topicKeyboard(id));
  }

  if (input === t.symptoms) {
    return startSymptoms(id);
  }

  if (input === t.contact) {
    sessions.delete(id);
    return send(id, t.contactInfo, mainKeyboard(id));
  }

  const categoryIndex = detectCategory(input, lang);
  if (categoryIndex !== -1) {
    const category = categories[categoryIndex];
    sessions.delete(id);
    const info = category[lang === "my" ? "infoMy" : "infoEn"];
    return send(id, t.topicPrefix + category[lang] + "\n\n" + info + t.healthDisclaimer, mainKeyboard(id));
  }

  if (session && session.flow === "symptom") {
    if (session.step === "symptom") {
      session.symptom = input;
      session.step = "redflags";
      sessions.set(id, session);
      return send(id, t.redFlagAsk, choiceKeyboard(id, [t.yes, t.no]));
    }

    if (session.step === "redflags") {
      if (isYes(input, lang)) {
        sessions.delete(id);
        return send(id, t.emergencyYes, mainKeyboard(id));
      }

      if (isNo(input, lang)) {
        session.step = "duration";
        sessions.set(id, session);
        return send(id, t.duration, {
          keyboard: [[t.back]],
          resize_keyboard: true
        });
      }

      return send(id, t.redFlagAsk, choiceKeyboard(id, [t.yes, t.no]));
    }

    if (session.step === "duration") {
      session.duration = input;
      session.step = "severity";
      sessions.set(id, session);
      return send(id, t.severity, choiceKeyboard(id, [t.mild, t.moderate, t.severe]));
    }

    if (session.step === "severity") {
      session.severity = input;
      sessions.delete(id);

      const summary = lang === "my"
        ? `📝 သင့်အဖြေများ\n\n• လက္ခဏာ: ${session.symptom}\n• ဖြစ်ပွားချိန်: ${session.duration}\n• ပြင်းထန်မှု: ${input}\n\n${t.summary}`
        : `📝 Your responses\n\n• Symptom: ${session.symptom}\n• Duration: ${session.duration}\n• Severity: ${input}\n\n${t.summary}`;

      return send(id, summary, mainKeyboard(id));
    }
  }

  if (session && session.flow === "health" && session.step === "topic") {
    return send(id, t.chooseHealth, topicKeyboard(id));
  }

  return send(id, t.fallback, mainKeyboard(id));
}

bot.on("message", (msg) => {
  handleMessage(msg).catch(err => {
    console.error("Message handling error:", err.message);
  });
});

app.get("/", (req, res) => {
  res.status(200).send("Htoo Care Telegram Bot is running.");
});

app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

app.post(webhookPath, (req, res) => {
  res.sendStatus(200);
  bot.processUpdate(req.body);
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, async () => {
  console.log(`Htoo Care server listening on port ${PORT}`);

  try {
    await bot.setWebHook(`${BASE_URL}${webhookPath}`);
    console.log("Telegram webhook configured.");
  } catch (err) {
    console.error("Webhook setup failed:", err.message);
  }
});
