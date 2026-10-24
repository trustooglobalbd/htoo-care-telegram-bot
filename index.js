
"use strict";

const TelegramBot = require("node-telegram-bot-api");
const express = require("express");

// ==================== CONFIGURATION ====================

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const PORT = Number(process.env.PORT || 8080);

if (!TOKEN) {
  console.error("STARTUP ERROR: TELEGRAM_BOT_TOKEN is missing.");
  process.exit(1);
}

// ==================== WEB SERVER ====================

const app = express();

app.get("/", (_req, res) => {
  res.status(200).send("Htoo Care Bot is running.");
});

app.get("/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    service: "Htoo Care Telegram Bot"
  });
});

const server = app.listen(PORT, "0.0.0.0", () => {
  console.log(`Htoo Care web server running on port ${PORT}`);
});

// ==================== TELEGRAM BOT ====================

const bot = new TelegramBot(TOKEN, {
  polling: false
});

bot.on("message", (msg) => {
  console.log("[TELEGRAM INCOMING]", msg.text || "");
  }
});

const languages = new Map();
const waitingForQuestion = new Set();

function getLang(chatId) {
  return languages.get(chatId) || "mm";
}

// ==================== BILINGUAL TEXT ====================

const TEXT = {
  mm: {
    welcome:
      "မင်္ဂလာပါ။ Htoo Care မှ ကြိုဆိုပါတယ်။\n\n" +
      "ကျန်းမာရေးအသိပညာပေး အချက်အလက်များကို ဖတ်ရှုနိုင်ပါတယ်။ အောက်ပါ Menu မှ ရွေးချယ်ပါ။",

    health: "🩺 ကျန်းမာရေးအချက်အလက်",
    srhr: "🌸 SRHR ကျန်းမာရေး",
    call: "📞 7887 သို့ခေါ်ရန်",
    overseas: "🌏 ပြည်ပရောက် မြန်မာများအတွက်",
    about: "ℹ️ Htoo Care အကြောင်း",
    language: "🌐 ဘာသာစကားပြောင်းရန်",
    menu: "🏠 ပင်မ Menu",
    back: "⬅️ နောက်သို့",

    chooseLanguage: "ဘာသာစကားကို ရွေးချယ်ပါ။",
    changed: "ဘာသာစကားကို မြန်မာဘာသာသို့ ပြောင်းပြီးပါပြီ။",

    healthPrompt:
      "သိလိုသော အထွေထွေကျန်းမာရေးမေးခွန်းကို ရေးပို့ပါ။\n\n" +
      "သတိပြုရန် — Bot မှရရှိသော အဖြေသည် ကျန်းမာရေးပညာပေးရန်အတွက်သာဖြစ်ပြီး ဆရာဝန်၏ စစ်ဆေးမှုကို အစားမထိုးနိုင်ပါ။",

    thinking: "ကျန်းမာရေးအချက်အလက်ကို ပြင်ဆင်နေပါတယ်။ ခဏစောင့်ပေးပါ။",

    error:
      "လက်ရှိတွင် အဖြေထုတ်ပေးရန် အခက်အခဲရှိနေပါတယ်။ နောက်မှ ထပ်ကြိုးစားပါ သို့မဟုတ် ကျန်းမာရေးပညာရှင်နှင့် တိုင်ပင်ပါ။",

    disclaimer:
      "⚠️ ဤအချက်အလက်သည် ကျန်းမာရေးပညာပေးရန်အတွက်သာ ဖြစ်ပါတယ်။ ရောဂါရှာဖွေခြင်း သို့မဟုတ် ဆရာဝန်၏ အကြံပြုချက်ကို အစားမထိုးနိုင်ပါ။ အရေးပေါ်လက္ခဏာရှိပါက Bot ကို မစောင့်ဘဲ အရေးပေါ်ကျန်းမာရေးဝန်ဆောင်မှုကို ချက်ချင်းဆက်သွယ်ပါ။",

    srhrIntro: "SRHR အကြောင်းအရာအမျိုးအစားကို ရွေးချယ်ပါ။",
    menstrual: "🩸 ရာသီသွေးနှင့် ရာသီစက်ဝန်း",
    pregnancy: "🤰 ကိုယ်ဝန်ဆောင်နှင့် မိခင်ကျန်းမာရေး",
    sexual: "🌷 လိင်နှင့် မျိုးဆက်ပွားကျန်းမာရေး",
    support: "🩺 ကျန်းမာရေးအကူအညီ",

    pending:
      "ဤအကြောင်းအရာကို ဆေးဘက်ဆိုင်ရာ ကျွမ်းကျင်သူမှ စစ်ဆေးအတည်ပြုနေဆဲဖြစ်သောကြောင့် စာသားအပြည့်အစုံကို မဖော်ပြသေးပါ။",

    aboutText:
      "Htoo Care သည် ကျန်းမာရေးအသိပညာပေး အချက်အလက်များကို ရရှိနိုင်ရန် ကူညီပေးသော Telegram Bot ဖြစ်ပါတယ်။ Bot မှပေးသော အချက်အလက်များသည် ဆရာဝန်၏ စစ်ဆေးမှုကို အစားမထိုးနိုင်ပါ။",

    callText:
      "📞 7887 Healthcare Call Center\n\n" +
      "7887 သို့ ဖုန်းခေါ်ဆိုပြီး ကျန်းမာရေးအကူအညီ ရရှိနိုင်မှုကို စုံစမ်းနိုင်ပါတယ်။ ဖုန်းခေါ်ဆိုခနှင့် ဝန်ဆောင်မှုရရှိနိုင်မှုသည် သက်ဆိုင်ရာ ဖုန်းကွန်ရက်နှင့် ဝန်ဆောင်မှုစည်းကမ်းများအပေါ် မူတည်နိုင်ပါတယ်။",

    overseasText:
      "🌏 ပြည်ပရောက် မြန်မာနိုင်ငံသားများအတွက် ကျန်းမာရေးအကူအညီ\n\n" +
      "ဆက်သွယ်ရန်ဖုန်း — 09 442 111 110\n\n" +
      "Phone သို့မဟုတ် Viber မှ ဆက်သွယ်နိုင်မှုကို စုံစမ်းနိုင်ပါတယ်။ Telegram account link ကို အတည်ပြုရန် လိုအပ်ပါသေးတယ်။\n\n" +
      "ဤနံပါတ်သည် အရေးပေါ်ဝန်ဆောင်မှုနံပါတ်ဟု အတည်ပြုထားခြင်း မရှိပါ။ အရေးပေါ်အခြေအနေတွင် ဒေသဆိုင်ရာ အရေးပေါ်ကျန်းမာရေးဝန်ဆောင်မှုကို ဆက်သွယ်ပါ။",

    supportText:
      "မိမိ၏ ကျန်းမာရေးအခြေအနေအတွက် အရည်အချင်းပြည့်မီသော ကျန်းမာရေးပညာရှင်နှင့် တိုင်ပင်ပါ။ အရေးပေါ်အခြေအနေတွင် အရေးပေါ်ကျန်းမာရေးဝန်ဆောင်မှုကို ချက်ချင်းဆက်သွယ်ပါ။"
  },

  en: {
    welcome:
      "Welcome to Htoo Care.\n\n" +
      "Explore general health education information. Please choose an option below.",

    health: "🩺 Health Information",
    srhr: "🌸 SRHR Topics",
    call: "📞 Call 7887",
    overseas: "🌏 Health Support for Myanmar Nationals Abroad",
    about: "ℹ️ About Htoo Care",
    language: "🌐 Change Language",
    menu: "🏠 Main Menu",
    back: "⬅️ Back",

    chooseLanguage: "Please choose your language.",
    changed: "Language changed to English.",

    healthPrompt:
      "Please type your general health question.\n\n" +
      "Note: Bot responses are for general education only and do not replace a clinician's assessment.",

    thinking: "Preparing health information. Please wait.",

    error:
      "I couldn't prepare a response right now. Please try again later or consult a qualified healthcare professional.",

    disclaimer:
      "⚠️ This information is for health education only. It does not provide a diagnosis or replace professional medical advice. If you have emergency symptoms, seek emergency medical care immediately.",

    srhrIntro: "Please choose an SRHR category.",
    menstrual: "🩸 Menstrual Health",
    pregnancy: "🤰 Pregnancy and Maternal Health",
    sexual: "🌷 Sexual and Reproductive Health",
    support: "🩺 Health Support",

    pending:
      "This topic is awaiting clinical review and approval. The full content is not available yet.",

    aboutText:
      "Htoo Care is a Telegram bot designed to help users access general health education information. It does not replace a clinician's assessment.",

    callText:
      "📞 7887 Healthcare Call Center\n\nYou may call 7887 to ask about healthcare support availability. Call charges and availability depend on applicable network and service terms.",

    overseasText:
      "🌏 Health support for Myanmar nationals abroad\n\n" +
      "Contact number: 09 442 111 110\n\n" +
      "Please verify Phone or Viber availability before use. The Telegram account link still needs verification.\n\n" +
      "This number is not confirmed as an emergency hotline. In an emergency, contact emergency health services where you live.",

    supportText:
      "For personal health concerns, consult a qualified healthcare professional. In an emergency, contact local emergency medical services immediately."
  }
};

function t(chatId, key) {
  return TEXT[getLang(chatId)][key] || TEXT.mm[key] || key;
}

// ==================== KEYBOARDS ====================

function mainKeyboard(chatId) {
  return {
    inline_keyboard: [
      [{ text: t(chatId, "health"), callback_data: "health" }],
      [{ text: t(chatId, "srhr"), callback_data: "srhr" }],
      [{ text: t(chatId, "call"), callback_data: "call7887" }],
      [{ text: t(chatId, "overseas"), callback_data: "overseas" }],
      [{ text: t(chatId, "about"), callback_data: "about" }],
      [{ text: t(chatId, "language"), callback_data: "language" }]
    ]
  };
}

function backKeyboard(chatId) {
  return {
    inline_keyboard: [
      [{ text: t(chatId, "menu"), callback_data: "menu" }],
      [{ text: t(chatId, "language"), callback_data: "language" }]
    ]
  };
}

function languageKeyboard() {
  return {
    inline_keyboard: [
      [{ text: "မြန်မာ", callback_data: "lang_mm" }],
      [{ text: "English", callback_data: "lang_en" }],
      [{ text: "⬅️ Back / နောက်သို့", callback_data: "menu" }]
    ]
  };
}

function srhrKeyboard(chatId) {
  return {
    inline_keyboard: [
      [{ text: t(chatId, "menstrual"), callback_data: "cat_menstrual" }],
      [{ text: t(chatId, "pregnancy"), callback_data: "cat_pregnancy" }],
      [{ text: t(chatId, "sexual"), callback_data: "cat_sexual" }],
      [{ text: t(chatId, "support"), callback_data: "cat_support" }],
      [{ text: t(chatId, "menu"), callback_data: "menu" }]
    ]
  };
}

// ==================== SRHR TOPICS ====================
// All topics require clinician approval before full publication.

const SRHR_TOPICS = [
  {
    id: "menstrual_cycle",
    category: "menstrual",
    title_mm: "ရာသီစက်ဝန်းကို နားလည်ခြင်း",
    title_en: "Understanding the Menstrual Cycle",
    content_mm:
      "ရာသီစက်ဝန်းသည် ရာသီသွေးစဆင်းသည့်နေ့မှ နောက်တစ်ကြိမ် ရာသီသွေးစဆင်းသည့်နေ့အထိ တွက်ချက်သော စက်ဝန်းဖြစ်ပါတယ်။ လူတစ်ဦးနှင့်တစ်ဦး စက်ဝန်းနှင့် လက္ခဏာများ ကွာခြားနိုင်ပါတယ်။ ရာသီသွေးအလွန်များခြင်း သို့မဟုတ် နေ့စဉ်လုပ်ငန်းများ မလုပ်နိုင်လောက်အောင် နာကျင်ခြင်းရှိပါက ကျန်းမာရေးပညာရှင်နှင့် တိုင်ပင်ပါ။",
    content_en:
      "The menstrual cycle is counted from the first day of one period to the first day of the next. Cycle length and symptoms can vary. Consult a healthcare professional if bleeding is very heavy or pain disrupts daily activities.",
    source_url: "https://www.who.int/news-room/fact-sheets/detail/menstrual-health",
    approved: false,
    reviewed_by: "",
    reviewed_date: ""
  },
  {
    id: "menstrual_hygiene",
    category: "menstrual",
    title_mm: "ရာသီလာချိန် သန့်ရှင်းရေး",
    title_en: "Menstrual Hygiene",
    content_mm:
      "မိမိအတွက် သင့်တော်ပြီး သန့်ရှင်းသော ရာသီသုံးပစ္စည်းကို အသုံးပြုပါ။ အသုံးပြုသည့်ပစ္စည်း၏ ညွှန်ကြားချက်အတိုင်း လဲလှယ်၊ ဆေးကြော သို့မဟုတ် စွန့်ပစ်ပါ။ လက်ကို ဆပ်ပြာနှင့် ရေဖြင့် ဆေးကြောပါ။ စိုးရိမ်ရသော လက္ခဏာများရှိပါက ကျန်းမာရေးပညာရှင်နှင့် တိုင်ပင်ပါ။",
    content_en:
      "Use clean menstrual products that suit your needs. Change, wash, or dispose of them according to product instructions, and wash your hands with soap and water. Seek professional advice if you have concerning symptoms.",
    source_url: "https://www.unicef.org/wash/menstrual-hygiene",
    approved: false,
    reviewed_by: "",
    reviewed_date: ""
  },
  {
    id: "antenatal_care",
    category: "pregnancy",
    title_mm: "ကိုယ်ဝန်ဆောင်စောင့်ရှောက်မှု",
    title_en: "Antenatal Care",
    content_mm:
      "ကိုယ်ဝန်ရှိကြောင်း သိရှိပါက ကျန်းမာရေးဝန်ထမ်းနှင့် စောစီးစွာ ဆက်သွယ်ပြီး ကိုယ်ဝန်ဆောင်စစ်ဆေးမှုများ စတင်ပါ။ မိမိအတွက် သင့်တော်သော စစ်ဆေးမှုအစီအစဉ်ကို ကျန်းမာရေးပညာရှင်နှင့် တိုင်ပင်ပါ။",
    content_en:
      "If you think you are pregnant, contact a healthcare professional early to begin antenatal care. Discuss an appropriate schedule of visits and recommended checks with your healthcare professional.",
    source_url: "https://www.who.int/tools/your-life-your-health/life-phase/pregnancy--birth-and-after-childbirth/getting-the-health-services-you-need-during-pregnancy",
    approved: false,
    reviewed_by: "",
    reviewed_date: ""
  },
  {
    id: "pregnancy_warning_signs",
    category: "pregnancy",
    title_mm: "ကိုယ်ဝန်ဆောင်စဉ် အရေးပေါ်လက္ခဏာများ",
    title_en: "Pregnancy Warning Signs",
    content_mm:
      "ကိုယ်ဝန်ဆောင်စဉ် သွေးဆင်းခြင်း၊ ပြင်းထန်သော ဝမ်းဗိုက်နာကျင်ခြင်း၊ ပြင်းထန်သော ခေါင်းကိုက်ခြင်း၊ အမြင်ဝေဝါးခြင်း၊ တက်ခြင်း သို့မဟုတ် အသက်ရှူခက်ခဲခြင်းတို့ ဖြစ်ပါက အရေးပေါ်ဆေးကုသမှုကို ချက်ချင်း ရယူပါ။ Bot ၏အဖြေကို မစောင့်ပါနှင့်။",
    content_en:
      "During pregnancy, vaginal bleeding, severe abdominal pain, a severe headache, blurred vision, seizures, or difficulty breathing may require urgent medical attention. Seek emergency medical care immediately. Do not wait for a bot response.",
    source_url: "https://www.who.int/tools/your-life-your-health/life-phase/pregnancy--birth-and-after-childbirth/getting-the-health-services-you-need-during-pregnancy",
    approved: false,
    reviewed_by: "",
    reviewed_date: ""
  },
  {
    id: "contraception",
    category: "sexual",
    title_mm: "ကိုယ်ဝန်တားနည်းများ",
    title_en: "Contraception",
    content_mm:
      "ကိုယ်ဝန်တားနည်းများတွင် ကွန်ဒုံး၊ သောက်ဆေး၊ ထိုးဆေး၊ လက်မောင်းထည့်ပစ္စည်းနှင့် သားအိမ်တွင်းထည့်ပစ္စည်းတို့ ပါဝင်နိုင်ပါတယ်။ နည်းလမ်းတစ်ခုချင်းစီ၏ သင့်တော်မှု ကွာခြားနိုင်သောကြောင့် ကျန်းမာရေးပညာရှင်နှင့် တိုင်ပင်ပါ။ ကွန်ဒုံးသည် လိင်မှတစ်ဆင့် ကူးစက်နိုင်သော ရောဂါအချို့၏ အန္တရာယ်ကိုလည်း လျှော့ချနိုင်ပါတယ်။",
    content_en:
      "Contraceptive methods include condoms, pills, injections, implants, and intrauterine devices. Suitability varies, so discuss your needs with a healthcare professional. Condoms can also reduce the risk of many sexually transmitted infections.",
    source_url: "https://www.who.int/en/news-room/fact-sheets/detail/family-planning-contraception",
    approved: false,
    reviewed_by: "",
    reviewed_date: ""
  },
  {
    id: "sti_information",
    category: "sexual",
    title_mm: "လိင်မှတစ်ဆင့် ကူးစက်နိုင်သော ရောဂါများ",
    title_en: "Sexually Transmitted Infections",
    content_mm:
      "လိင်မှတစ်ဆင့် ကူးစက်နိုင်သော ရောဂါအချို့တွင် လက္ခဏာမပြနိုင်ပါ။ ပုံမှန်မဟုတ်သော အရည်ဆင်းခြင်း၊ အနာဖြစ်ခြင်း၊ ဆီးသွားစဉ် နာကျင်ခြင်း သို့မဟုတ် ကူးစက်နိုင်ခြေရှိသည်ဟု စိုးရိမ်ပါက ကျန်းမာရေးပညာရှင်ထံမှ စစ်ဆေးမှုနှင့် အကြံပြုချက် ရယူပါ။",
    content_en:
      "Some sexually transmitted infections may cause no symptoms. If you notice unusual discharge, sores, pain when urinating, or think you may have been exposed, seek testing and advice from a qualified healthcare professional.",
    source_url: "https://www.who.int/news-room/fact-sheets/detail/sexually-transmitted-infections-%28stis%29",
    approved: false,
    reviewed_by: "",
    reviewed_date: ""
  },
  {
    id: "consent_and_safety",
    category: "sexual",
    title_mm: "သဘောတူညီမှုနှင့် ကိုယ်ပိုင်လုံခြုံရေး",
    title_en: "Consent and Personal Safety",
    content_mm:
      "လိင်ပိုင်းဆိုင်ရာ ထိတွေ့မှုတွင် လွတ်လပ်စွာပေးထားသော သဘောတူညီမှု လိုအပ်ပါတယ်။ ဖိအားပေးခြင်း၊ ခြိမ်းခြောက်ခြင်း သို့မဟုတ် အတင်းအကျပ်ပြုခြင်းသည် လွတ်လပ်သော သဘောတူညီမှု မဟုတ်ပါ။ မိမိမလိုလားသောအရာကို ငြင်းဆိုနိုင်ပါတယ်။ မလုံခြုံဟု ခံစားရပါက ယုံကြည်ရသောသူ သို့မဟုတ် သက်ဆိုင်ရာ ကာကွယ်စောင့်ရှောက်ရေးဝန်ဆောင်မှုထံ အကူအညီတောင်းပါ။",
    content_en:
      "Sexual activity requires freely given consent. Pressure, threats, or force are not freely given consent. You have the right to say no. If you feel unsafe, seek help from a trusted person or an appropriate safeguarding service.",
    source_url: "https://www.who.int/health-topics/sexual-health",
    approved: false,
    reviewed_by: "",
    reviewed_date: ""
  },
  {
    id: "postnatal_care",
    category: "pregnancy",
    title_mm: "မီးဖွားပြီးနောက် မိခင်ကျန်းမာရေး",
    title_en: "Postnatal Maternal Health",
    content_mm:
      "မီးဖွားပြီးနောက် မိခင်၏ ကျန်းမာရေးနှင့် စိတ်ပိုင်းဆိုင်ရာ အခြေအနေကို စောင့်ကြည့်ရန် လိုအပ်ပါတယ်။ သက်ဆိုင်ရာ ကျန်းမာရေးဝန်ထမ်းနှင့် မီးဖွားပြီးနောက် စစ်ဆေးမှုများကို ဆွေးနွေးပါ။ သွေးအလွန်များစွာဆင်းခြင်း၊ အသက်ရှူခက်ခဲခြင်း၊ ရင်ဘတ်နာခြင်း၊ ပြင်းထန်သော ခေါင်းကိုက်ခြင်း သို့မဟုတ် အဖျားမြင့်ခြင်းရှိပါက အရေးပေါ်ကုသမှု ရယူပါ။",
    content_en:
      "After childbirth, monitor physical recovery and emotional wellbeing, and discuss postnatal check-ups with a healthcare professional. Seek urgent care for very heavy bleeding, difficulty breathing, chest pain, a severe headache, or a high fever.",
    source_url: "https://www.who.int/tools/your-life-your-health/life-phase/pregnancy--birth-and-after-childbirth/getting-the-health-services-you-need-after-childbirth",
    approved: false,
    reviewed_by: "",
    reviewed_date: ""
  }
];

function topicKeyboard(chatId, category) {
  const lang = getLang(chatId);
  const topics = SRHR_TOPICS.filter(item => item.category === category);

  const rows = topics.map(topic => [{
    text: lang === "en" ? topic.title_en : topic.title_mm,
    callback_data: `topic_${topic.id}`
  }]);

  rows.push([{ text: t(chatId, "back"), callback_data: "srhr" }]);
  rows.push([{ text: t(chatId, "menu"), callback_data: "menu" }]);

  return { inline_keyboard: rows };
}

async function showTopic(chatId, id) {
  const topic = SRHR_TOPICS.find(item => item.id === id);

  if (!topic) {
    await bot.sendMessage(chatId, t(chatId, "pending"), {
      reply_markup: backKeyboard(chatId)
    });
    return;
  }

  // Do not publish until clinically reviewed.
  if (
    topic.approved !== true ||
    !topic.reviewed_by ||
    !topic.reviewed_date
  ) {
    const title = getLang(chatId) === "en"
      ? topic.title_en
      : topic.title_mm;

    await bot.sendMessage(chatId, `${title}\n\n${t(chatId, "pending")}`, {
      reply_markup: backKeyboard(chatId)
    });
    return;
  }

  const title = getLang(chatId) === "en"
    ? topic.title_en
    : topic.title_mm;
  const content = getLang(chatId) === "en"
    ? topic.content_en
    : topic.content_mm;

  await bot.sendMessage(
    chatId,
    `${title}\n\n${content}\n\n${t(chatId, "disclaimer")}`,
    { reply_markup: backKeyboard(chatId) }
  );
}

// ==================== GEMINI API ====================

async function askGemini(question, lang) {
  if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is missing.");
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25000);

  try {
    const endpoint =
      `https://generativelanguage.googleapis.com/v1beta/models/` +
      `${encodeURIComponent(GEMINI_MODEL)}:generateContent`;

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": GEMINI_API_KEY
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{
            text:
              "You are Htoo Care, a general health education assistant. " +
              `Answer in ${lang === "en" ? "English" : "Burmese"}. ` +
              "Do not diagnose, prescribe, or replace a clinician. " +
              "Use cautious and non-judgmental language. " +
              "For emergency symptoms, advise immediate local emergency medical care. " +
              "For personal medical decisions, pregnancy, medicines, children, or serious symptoms, recommend a qualified healthcare professional. " +
              "Do not invent sources or facts."
          }]
        },
        contents: [{
          role: "user",
          parts: [{ text: question }]
        }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 700
        }
      }),
      signal: controller.signal
    });

    const data = await response.json().catch(() => ({}));

    console.log("Gemini HTTP status:", response.status);

    if (!response.ok) {
      throw new Error(
        `Gemini HTTP ${response.status}: ` +
        (data?.error?.message || "No error details")
      );
    }

    const answer = (data?.candidates?.[0]?.content?.parts || [])
      .map(part => part.text || "")
      .join("\n")
      .trim();

    if (!answer) {
      throw new Error("Gemini returned no text.");
    }

    return answer;
  } finally {
    clearTimeout(timer);
  }
}

function containsEmergencyWarning(question) {
  const q = question.toLowerCase();

  const phrases = [
    "can't breathe",
    "cannot breathe",
    "difficulty breathing",
    "severe chest pain",
    "unconscious",
    "seizure",
    "heavy bleeding",
    "အသက်ရှူမရ",
    "အသက်ရှူခက်",
    "ရင်ဘတ်အလွန်နာ",
    "သတိလစ်",
    "သွေးအလွန်များ"
  ];

  return phrases.some(phrase => q.includes(phrase.toLowerCase()));
}

async function answerHealthQuestion(chatId, question) {
  const lang = getLang(chatId);

  if (containsEmergencyWarning(question)) {
    const emergencyText = lang === "en"
      ? "⚠️ Your message may describe an emergency. Contact local emergency medical services or go to the nearest emergency department immediately. Do not wait for a bot response."
      : "⚠️ သင့်မေးခွန်းတွင် အရေးပေါ်လက္ခဏာ ပါဝင်နိုင်ပါတယ်။ Bot ၏အဖြေကို မစောင့်ဘဲ ဒေသဆိုင်ရာ အရေးပေါ်ကျန်းမာရေးဝန်ဆောင်မှုကို ချက်ချင်းဆက်သွယ်ပါ သို့မဟုတ် အနီးဆုံး အရေးပေါ်ကုသရေးဌာနသို့ သွားပါ။";

    await bot.sendMessage(chatId, emergencyText, {
      reply_markup: backKeyboard(chatId)
    });
    return;
  }

  if (!GEMINI_API_KEY) {
    await bot.sendMessage(
      chatId,
      lang === "en"
        ? "The health question service is not configured yet. Please try later."
        : "ကျန်းမာရေးမေးခွန်းဖြေဆိုသည့် ဝန်ဆောင်မှုကို မသတ်မှတ်ရသေးပါ။ နောက်မှ ထပ်ကြိုးစားပါ။",
      { reply_markup: backKeyboard(chatId) }
    );
    return;
  }

  await bot.sendMessage(chatId, t(chatId, "thinking"));

  try {
    console.log("Gemini request started.");
    const answer = await askGemini(question, lang);

    await bot.sendMessage(
      chatId,
      `${answer}\n\n${t(chatId, "disclaimer")}`,
      { reply_markup: backKeyboard(chatId) }
    );
  } catch (error) {
    console.error("Gemini request failed:", error.message);

    await bot.sendMessage(chatId, t(chatId, "error"), {
      reply_markup: backKeyboard(chatId)
    });
  }
}

// ==================== COMMANDS ====================

bot.onText(/^\/start(?:@\w+)?$/, async msg => {
  const chatId = msg.chat.id;
  waitingForQuestion.delete(chatId);

  await bot.sendMessage(chatId, t(chatId, "welcome"), {
    reply_markup: mainKeyboard(chatId)
  }).catch(error => {
    console.error("START REPLY ERROR:", error.message);
  });
});

bot.onText(/^\/menu(?:@\w+)?$/, async msg => {
  const chatId = msg.chat.id;
  waitingForQuestion.delete(chatId);

  await bot.sendMessage(chatId, t(chatId, "welcome"), {
    reply_markup: mainKeyboard(chatId)
  }).catch(error => {
    console.error("MENU REPLY ERROR:", error.message);
  });
});

bot.onText(/^\/help(?:@\w+)?$/, async msg => {
  const chatId = msg.chat.id;

  const help = getLang(chatId) === "en"
    ? "Use /start or /menu to open the main menu. Select Health Information to ask a general question, or SRHR Topics to browse topics."
    : "/start သို့မဟုတ် /menu ဖြင့် ပင်မ Menu ကိုဖွင့်ပါ။ Health Information မှ မေးခွန်းမေးနိုင်ပြီး SRHR မှ အကြောင်းအရာများကို ရွေးချယ်နိုင်ပါတယ်။";

  await bot.sendMessage(chatId, help, {
    reply_markup: backKeyboard(chatId)
  }).catch(error => {
    console.error("HELP REPLY ERROR:", error.message);
  });
});

bot.onText(/^\/ask(?:\s+([\s\S]+))?$/, async (msg, match) => {
  const chatId = msg.chat.id;
  const question = (match?.[1] || "").trim();

  if (!question) {
    waitingForQuestion.add(chatId);
    await bot.sendMessage(chatId, t(chatId, "healthPrompt"), {
      reply_markup: backKeyboard(chatId)
    });
    return;
  }

  await answerHealthQuestion(chatId, question);
});

// ==================== BUTTON HANDLERS ====================

bot.on("callback_query", async query => {
  const chatId = query.message?.chat?.id;
  const data = query.data;

  await bot.answerCallbackQuery(query.id).catch(() => {});

  if (!chatId || !data) return;

  try {
    if (data === "menu") {
      waitingForQuestion.delete(chatId);

      await bot.sendMessage(chatId, t(chatId, "welcome"), {
        reply_markup: mainKeyboard(chatId)
      });
      return;
    }

    if (data === "language") {
      await bot.sendMessage(chatId, t(chatId, "chooseLanguage"), {
        reply_markup: languageKeyboard()
      });
      return;
    }

    if (data === "lang_mm" || data === "lang_en") {
      languages.set(chatId, data === "lang_en" ? "en" : "mm");

      await bot.sendMessage(chatId, t(chatId, "changed"), {
        reply_markup: mainKeyboard(chatId)
      });
      return;
    }

    if (data === "health") {
      waitingForQuestion.add(chatId);

      await bot.sendMessage(chatId, t(chatId, "healthPrompt"), {
        reply_markup: backKeyboard(chatId)
      });
      return;
    }

    if (data === "srhr") {
      waitingForQuestion.delete(chatId);

      await bot.sendMessage(chatId, t(chatId, "srhrIntro"), {
        reply_markup: srhrKeyboard(chatId)
      });
      return;
    }

    if (data.startsWith("cat_")) {
      const category = data.slice(4);

      if (category === "support") {
        await bot.sendMessage(chatId, t(chatId, "supportText"), {
          reply_markup: backKeyboard(chatId)
        });
        return;
      }

      if (!["menstrual", "pregnancy", "sexual"].includes(category)) {
        await bot.sendMessage(chatId, t(chatId, "pending"), {
          reply_markup: backKeyboard(chatId)
        });
        return;
      }

      await bot.sendMessage(chatId, t(chatId, category), {
        reply_markup: topicKeyboard(chatId, category)
      });
      return;
    }

    if (data.startsWith("topic_")) {
      await showTopic(chatId, data.slice("topic_".length));
      return;
    }

    if (data === "call7887") {
      await bot.sendMessage(chatId, t(chatId, "callText"), {
        reply_markup: backKeyboard(chatId)
      });
      return;
    }

    if (data === "overseas") {
      await bot.sendMessage(chatId, t(chatId, "overseasText"), {
        reply_markup: {
          inline_keyboard: [
            [{ text: "📱 Call", url: "tel:+959442111110" }],
            [{ text: "💬 Viber", url: "viber://chat?number=%2B959442111110" }],
            [{ text: t(chatId, "menu"), callback_data: "menu" }]
          ]
        }
      });
      return;
    }

    if (data === "about") {
      await bot.sendMessage(chatId, t(chatId, "aboutText"), {
        reply_markup: backKeyboard(chatId)
      });
    }
  } catch (error) {
    console.error("BUTTON HANDLER ERROR:", error.message);

    await bot.sendMessage(chatId, t(chatId, "error"))
      .catch(() => {});
  }
});

// ==================== NORMAL TEXT MESSAGES ====================

bot.on("message", async msg => {
  if (!msg.text || msg.text.startsWith("/")) return;

  const chatId = msg.chat.id;

  // Only send ordinary text to the health service when the user
  // has explicitly selected Health Information.
  if (!waitingForQuestion.has(chatId)) return;

  waitingForQuestion.delete(chatId);
  await answerHealthQuestion(chatId, msg.text.trim());
});

// ==================== ERROR HANDLING ====================

bot.on("polling_error", error => {
  console.error("TELEGRAM POLLING ERROR:", error.message);

  if (error.response?.body) {
    console.error(
      "TELEGRAM ERROR DETAILS:",
      JSON.stringify(error.response.body)
    );
  }
});

bot.on("error", error => {
  console.error("TELEGRAM BOT ERROR:", error.message);
});

process.on("unhandledRejection", error => {
  console.error("UNHANDLED REJECTION:", error);
});

// ==================== START POLLING ====================

let stopping = false;

async function startTelegram() {
  try {
    console.log("Checking Telegram bot token...");

    const me = await bot.getMe();

    console.log(
      `Telegram token OK. Connected as @${me.username || "unknown"}.`
    );

    await bot.startPolling();

    console.log("Telegram polling started. Send /start to the bot.");
  } catch (error) {
    console.error("TELEGRAM STARTUP ERROR:", error.message);
    console.error(
      "Check the TELEGRAM_BOT_TOKEN and ensure no other process is polling with the same token."
    );
  }
}

startTelegram();

async function shutdown(signal) {
  if (stopping) return;
  stopping = true;

  console.log(`${signal} received. Shutting down Htoo Care Bot...`);

  try {
    await bot.stopPolling();
  } catch (error) {
    console.error("Polling shutdown error:", error.message);
  }

  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 3000).unref();
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
