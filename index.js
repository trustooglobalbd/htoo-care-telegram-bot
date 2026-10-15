
"use strict";

const crypto = require("crypto");
const TelegramBot = require("node-telegram-bot-api");
const express = require("express");

// ========================================
// 1. ENVIRONMENT VARIABLES
// ========================================
const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const DOCTOR_GROUP_CHAT_ID = process.env.DOCTOR_GROUP_CHAT_ID;
const CONSULTATION_STAFF_CHAT_ID =
  process.env.CONSULTATION_STAFF_CHAT_ID;

const PORT = process.env.PORT || 3000;
const CONTACT_NUMBER = "7887";

if (!TOKEN || !DOCTOR_GROUP_CHAT_ID || !CONSULTATION_STAFF_CHAT_ID) {
  console.error(
    "ERROR: Set TELEGRAM_BOT_TOKEN, DOCTOR_GROUP_CHAT_ID, " +
      "and CONSULTATION_STAFF_CHAT_ID in FadeHost Environment Variables."
  );
  process.exit(1);
}

// ========================================
// 2. SERVER AND TELEGRAM BOT
// ========================================
const app = express();
app.use(express.json());

const bot = new TelegramBot(TOKEN, { polling: true });

// Temporary in-memory state. It is cleared on server restart.
const sessions = new Map();

// ========================================
// 3. TRANSLATIONS
// ========================================
const TEXT = {
  my: {
    welcome:
      "မင်္ဂလာပါ။ Htoo Care မှ ကြိုဆိုပါတယ်။\n\n" +
      "ဤ bot သည် ကျန်းမာရေးအချက်အလက်နှင့် ဝန်ဆောင်မှုလမ်းညွှန်များ ပေးရန်ဖြစ်ပြီး ဆရာဝန်၏ စစ်ဆေးမှုကို အစားမထိုးနိုင်ပါ။",
    chooseLanguage: "ဘာသာစကား ရွေးချယ်ပါ။",
    menu: "ဝန်ဆောင်မှုတစ်ခုကို ရွေးချယ်ပါ။",
    health: "ကျန်းမာရေးအချက်အလက်",
    symptoms: "လက္ခဏာလမ်းညွှန်",
    referral: "ဆေးရုံ/ဆေးခန်း လမ်းညွှန်",
    contact: "7887 ဆက်သွယ်ရန်",
    privacy: "ကိုယ်ရေးအချက်အလက်နှင့် လုံခြုံရေး",
    emergency: "အရေးပေါ်သတိပေးချက်",
    consultation: "ဆရာဝန်နှင့် တိုင်ပင်ရန်",
    back: "ပင်မမီနူးသို့ ပြန်သွားရန်",
    healthText: "ကျန်းမာရေးအကြောင်းအရာကို ရွေးချယ်ပါ။",
    srhr: "လိင်နှင့် မျိုးဆက်ပွားကျန်းမာရေး",
    mental: "စိတ်ကျန်းမာရေး",
    general: "အထွေထွေကျန်းမာရေး",
    srhrText:
      "SRHR တွင် ရာသီစက်ဝန်း၊ သန္ဓေတားနည်းများ၊ လိင်မှတစ်ဆင့် ကူးစက်နိုင်သောရောဂါများနှင့် လုံခြုံသောဆက်ဆံရေးတို့ ပါဝင်ပါတယ်။",
    mentalText:
      "စိတ်ဖိစီးမှုများပါက ယုံကြည်ရသူနှင့် ပြောဆိုခြင်း၊ အနားယူခြင်းနှင့် လိုအပ်ပါက ကျွမ်းကျင်သူထံ ဆက်သွယ်ခြင်းတို့ကို စဉ်းစားပါ။",
    generalText:
      "အာဟာရမျှတစွာစားခြင်း၊ သန့်ရှင်းသောရေသောက်ခြင်း၊ လုံလောက်စွာအိပ်စက်ခြင်းနှင့် ကာကွယ်ဆေးများက ကျန်းမာရေးကို အထောက်အကူပြုနိုင်ပါတယ်။",
    symptomPrompt:
      "လက္ခဏာအမျိုးအစားကို ရွေးပါ။ ဤအဆင့်တွင် အမည်၊ ဖုန်းနံပါတ် သို့မဟုတ် အခြားကိုယ်ရေးအချက်အလက်များ မပို့ပါနှင့်။",
    symptomPain: "နာကျင်မှု",
    symptomFever: "ဖျားနာခြင်း",
    symptomBreathing: "အသက်ရှူမဝခြင်း",
    symptomOther: "အခြားလက္ခဏာ",
    symptomAdvice:
      "ဤ bot သည် ရောဂါအတည်ပြုမပေးနိုင်ပါ။ လက္ခဏာများ ဆက်လက်ဖြစ်ပွားခြင်း သို့မဟုတ် ပိုဆိုးလာခြင်းရှိပါက ကျန်းမာရေးဝန်ထမ်းထံ ဆက်သွယ်ပါ။",
    referralText:
      "သင့်ဒေသရှိ ယုံကြည်စိတ်ချရသော ဆေးရုံ၊ ဆေးခန်း သို့မဟုတ် အထူးကုဝန်ဆောင်မှုထံ ဆက်သွယ်ပါ။ ဤ bot တွင် အတည်ပြုထားသော ဆေးခန်းစာရင်း မချိတ်ဆက်ရသေးပါ။",
    contactText:
      "7887 သို့ ဆက်သွယ်နိုင်မှုနှင့် ကုန်ကျစရိတ်ကို သင့်ဖုန်းလိုင်းဝန်ဆောင်မှုပေးသူထံ အတည်ပြုပါ။ ဤ bot သည် ဖုန်းခေါ်ဆိုမှုကို တိုက်ရိုက်မချိတ်ဆက်ပေးပါ။",
    privacyText:
      "• ဤ bot သည် ဆရာဝန်၏ စစ်ဆေးမှုကို အစားမထိုးနိုင်ပါ။\n" +
      "• စကားဝိုင်းအခြေအနေကို server memory ထဲတွင် ယာယီသိမ်းနိုင်ပြီး server restart လုပ်ပါက ပျောက်သွားနိုင်သည်။\n" +
      "• Consultation တောင်းဆိုချက်ကို သဘောတူညီပြီး ပို့ပါက သတ်မှတ်ထားသော ဆရာဝန်အဖွဲ့နှင့် ဝန်ထမ်းထံ ပို့ပါမည်။\n" +
      "• OTP၊ password၊ မှတ်ပုံတင်နံပါတ် သို့မဟုတ် မလိုအပ်သော ကိုယ်ရေးအချက်အလက်များ မပို့ပါနှင့်။",
    emergencyText:
      "အရေးပေါ်အခြေအနေ ဖြစ်နိုင်ပါတယ်။ အသက်ရှူမဝခြင်း၊ ရင်ဘတ်အလွန်နာခြင်း၊ သတိလစ်ခြင်း၊ သွေးထွက်မရပ်ခြင်း သို့မဟုတ် လေဖြတ်ခြင်းလက္ခဏာများရှိပါက bot ကို မစောင့်ဘဲ နီးစပ်ရာ အရေးပေါ်ကျန်းမာရေးဝန်ဆောင်မှုထံ ချက်ချင်းသွားပါ။",
    unknown: "နားမလည်ပါ။ မီနူးမှ ရွေးချယ်ပါ သို့မဟုတ် /start ပို့ပါ။",
    cancelled: "တောင်းဆိုမှုကို ပယ်ဖျက်ပြီးပါပြီ။",
    topicsTitle: "ဆွေးနွေးလိုသော ကျန်းမာရေးခေါင်းစဉ်ကို ရွေးပါ။",
    topicSrhr: "SRHR",
    topicMenstruation: "ရာသီစက်ဝန်း",
    topicContraception: "သန္ဓေတားနည်း",
    topicPregnancy: "ကိုယ်ဝန်",
    topicGeneral: "အထွေထွေကျန်းမာရေး",
    consent:
      "ကိုယ်ရေးအချက်အလက်နှင့် သဘောတူညီချက်\n\n" +
      "ဆက်လက်လုပ်ဆောင်ပါက သင်ရွေးချယ်ထားသော ခေါင်းစဉ်နှင့် သင်ပေးပို့သော အချက်အလက်များကို ဆရာဝန်အဖွဲ့ Telegram Group နှင့် သတ်မှတ်ထားသော Htoo Care ဝန်ထမ်းထံ ပို့ပါမည်။\n\n" +
      "Telegram Group အတွင်းရှိ အဖွဲ့ဝင်များက တောင်းဆိုချက်ကို မြင်နိုင်ပါသည်။ ဝန်ထမ်းထံသို့ follow-up ပြုလုပ်နိုင်ရန် သင့် Telegram Chat ID ကိုလည်း ပို့ပါမည်။\n\n" +
      "အမည်အပြည့်အစုံ၊ မှတ်ပုံတင်၊ လိပ်စာ၊ password သို့မဟုတ် မလိုအပ်သော အချက်အလက်များ မပို့ပါနှင့်။ ဆက်လက်မလုပ်လိုပါက မသဘောတူဘဲ ပယ်ဖျက်နိုင်ပါသည်။",
    consentYes: "သဘောတူပြီး ဆက်လုပ်မည်",
    consentNo: "မသဘောတူပါ / ပယ်ဖျက်မည်",
    detailsPrompt:
      "သင့်ကျန်းမာရေးမေးခွန်းကို အတိုချုံးရေးပို့ပါ။ မပို့လိုပါက “အသေးစိတ်မပို့ဘဲ တင်မည်” ကို ရွေးပါ။\n\n" +
      "အမည်၊ ဖုန်းနံပါတ်၊ လိပ်စာ၊ မှတ်ပုံတင် သို့မဟုတ် အခြားသူ၏ ကိုယ်ရေးအချက်အလက်များ မရေးပါနှင့်။",
    noDetails: "အသေးစိတ်မပို့ဘဲ တင်မည်",
    requestReceived:
      "တောင်းဆိုချက်ကို လက်ခံပြီးပါပြီ။\n\nRequest ID: ",
    requestFailed:
      "တောင်းဆိုချက်ကို ပို့ရာတွင် အခက်အခဲရှိနေပါသည်။ ကျေးဇူးပြု၍ ခဏကြာမှ ပြန်ကြိုးစားပါ သို့မဟုတ် 7887 သို့ ဆက်သွယ်ပါ။",
    detailsTooLong:
      "စာသားသည် ရှည်လွန်းနေပါသည်။ ကိုယ်ရေးအချက်အလက်များ မပါဝင်စေဘဲ စာလုံး ၁၀၀၀ အတွင်း အတိုချုံးရေးပါ။",
    staffNotified:
      "တောင်းဆိုချက်ကို ပို့ပြီးပါပြီ။ ဝန်ဆောင်မှုအဖွဲ့က Telegram မှတစ်ဆင့် ဆက်သွယ်နိုင်ပါသည်။ အရေးပေါ်အခြေအနေတွင် bot ကို မစောင့်ပါနှင့်။",
  },

  en: {
    welcome:
      "Welcome to Htoo Care.\n\n" +
      "This bot provides general health information and service guidance. It does not replace professional medical assessment.",
    chooseLanguage: "Please choose your language.",
    menu: "Please choose a service.",
    health: "Health information",
    symptoms: "Symptom guidance",
    referral: "Hospital/clinic guidance",
    contact: "Contact 7887",
    privacy: "Privacy and safety",
    emergency: "Emergency warning",
    consultation: "Request doctor consultation",
    back: "Back to main menu",
    healthText: "Choose a health information topic.",
    srhr: "Sexual and reproductive health",
    mental: "Mental health",
    general: "General health",
    srhrText:
      "SRHR includes menstrual health, contraception, sexually transmitted infections, and safer relationships.",
    mentalText:
      "If you feel stressed, consider speaking with someone you trust, resting, and contacting a qualified professional if needed.",
    generalText:
      "Balanced nutrition, clean drinking water, adequate sleep, and recommended vaccinations can support general health.",
    symptomPrompt:
      "Choose a symptom category. Do not send your name, phone number, or other identifying information here.",
    symptomPain: "Pain",
    symptomFever: "Fever",
    symptomBreathing: "Difficulty breathing",
    symptomOther: "Other symptom",
    symptomAdvice:
      "This bot cannot diagnose a condition. Contact a qualified health professional if symptoms persist or worsen.",
    referralText:
      "Contact trusted hospitals, clinics, or specialists in your area. A verified directory is not connected to this bot yet.",
    contactText:
      "Confirm availability and charges for 7887 with your phone service provider. This bot does not place calls directly.",
    privacyText:
      "• This bot does not replace a medical assessment.\n" +
      "• Conversation state is temporarily held in server memory and may be lost after a restart.\n" +
      "• If you consent to submit a consultation request, your selected topic and message will be sent to the designated doctor group and staff member.\n" +
      "• Do not send OTPs, passwords, ID numbers, or unnecessary personal information.",
    emergencyText:
      "This may be an emergency. For severe difficulty breathing, severe chest pain, loss of consciousness, uncontrolled bleeding, or signs of stroke, do not wait for this bot. Seek emergency medical care immediately.",
    unknown: "I did not understand that. Use the menu or send /start.",
    cancelled: "The request has been cancelled.",
    topicsTitle: "Choose the health topic for your consultation.",
    topicSrhr: "SRHR",
    topicMenstruation: "Menstruation",
    topicContraception: "Contraception",
    topicPregnancy: "Pregnancy",
    topicGeneral: "General health",
    consent:
      "Privacy and consent\n\n" +
      "If you continue, your selected topic and the information you submit will be sent to the doctor Telegram group and the designated Htoo Care staff member.\n\n" +
      "Members of the Telegram group may see your request. Your Telegram Chat ID will also be sent to the staff member to support follow-up.\n\n" +
      "Do not send your full name, ID number, address, password, or unnecessary personal information. You may decline and cancel.",
    consentYes: "I consent and continue",
    consentNo: "Decline / cancel",
    detailsPrompt:
      "Briefly describe your health question. If you prefer not to provide details, select “Submit without details.”\n\n" +
      "Do not include your name, phone number, address, ID number, or another person's identifying information.",
    noDetails: "Submit without details",
    requestReceived: "Your request has been received.\n\nRequest ID: ",
    requestFailed:
      "We could not send your request. Please try again later or contact 7887.",
    detailsTooLong:
      "Your message is too long. Please shorten it to 1,000 characters and exclude identifying information.",
    staffNotified:
      "Your request has been sent. The service team may follow up through Telegram. Do not wait for this bot in an emergency.",
  },
};

// ========================================
// 4. GENERAL HELPERS
// ========================================
function getSession(chatId) {
  if (!sessions.has(chatId)) {
    sessions.set(chatId, { lang: "my", step: null });
  }
  return sessions.get(chatId);
}

function getLanguage(chatId) {
  return getSession(chatId).lang || "my";
}

function setLanguage(chatId, lang) {
  const current = getSession(chatId);
  current.lang = lang;
  sessions.set(chatId, current);
}

function newRequestId() {
  return "HC-" + crypto.randomBytes(6).toString("hex").toUpperCase();
}

async function send(chatId, message, options = {}) {
  try {
    await bot.sendMessage(chatId, message, options);
    return true;
  } catch (error) {
    console.error("Telegram sendMessage error:", error.message);
    return false;
  }
}

function mainKeyboard(lang) {
  const t = TEXT[lang];

  return {
    inline_keyboard: [
      [
        { text: t.health, callback_data: "health" },
        { text: t.symptoms, callback_data: "symptoms" },
      ],
      [
        { text: t.consultation, callback_data: "consultation" },
      ],
      [
        { text: t.referral, callback_data: "referral" },
        { text: t.contact, callback_data: "contact" },
      ],
      [
        { text: t.privacy, callback_data: "privacy" },
        { text: t.emergency, callback_data: "emergency" },
      ],
      [
        { text: "🌐 Language / ဘာသာစကား", callback_data: "language" },
      ],
    ],
  };
}

function backKeyboard(lang) {
  return {
    inline_keyboard: [
      [{ text: TEXT[lang].back, callback_data: "menu" }],
    ],
  };
}

function languageKeyboard() {
  return {
    inline_keyboard: [
      [{ text: "မြန်မာဘာသာ", callback_data: "lang_my" }],
      [{ text: "English", callback_data: "lang_en" }],
    ],
  };
}

function healthKeyboard(lang) {
  const t = TEXT[lang];

  return {
    inline_keyboard: [
      [{ text: t.srhr, callback_data: "srhr" }],
      [{ text: t.mental, callback_data: "mental" }],
      [{ text: t.general, callback_data: "general" }],
      [{ text: t.back, callback_data: "menu" }],
    ],
  };
}

function symptomKeyboard(lang) {
  const t = TEXT[lang];

  return {
    inline_keyboard: [
      [{ text: t.symptomPain, callback_data: "symptom_pain" }],
      [{ text: t.symptomFever, callback_data: "symptom_fever" }],
      [{ text: t.symptomBreathing, callback_data: "symptom_breathing" }],
      [{ text: t.symptomOther, callback_data: "symptom_other" }],
      [{ text: t.back, callback_data: "menu" }],
    ],
  };
}

function consultationTopicsKeyboard(lang) {
  const t = TEXT[lang];

  return {
    inline_keyboard: [
      [{ text: t.topicSrhr, callback_data: "topic_srhr" }],
      [{ text: t.topicMenstruation, callback_data: "topic_menstruation" }],
      [{ text: t.topicContraception, callback_data: "topic_contraception" }],
      [{ text: t.topicPregnancy, callback_data: "topic_pregnancy" }],
      [{ text: t.topicGeneral, callback_data: "topic_general" }],
      [{ text: t.back, callback_data: "menu" }],
    ],
  };
}

function consentKeyboard(lang) {
  const t = TEXT[lang];

  return {
    inline_keyboard: [
      [{ text: t.consentYes, callback_data: "consent_yes" }],
      [{ text: t.consentNo, callback_data: "consent_no" }],
    ],
  };
}

function detailsKeyboard(lang) {
  return {
    inline_keyboard: [
      [
        {
          text: TEXT[lang].noDetails,
          callback_data: "submit_no_details",
        },
      ],
      [{ text: TEXT[lang].back, callback_data: "menu" }],
    ],
  };
}

async function showMenu(chatId) {
  const lang = getLanguage(chatId);
  const session = getSession(chatId);
  session.step = null;
  session.consultation = null;

  await send(chatId, TEXT[lang].menu, {
    reply_markup: mainKeyboard(lang),
  });
}

async function handleStart(chatId) {
  const session = getSession(chatId);
  session.step = null;
  session.consultation = null;

  await send(chatId, TEXT[session.lang].chooseLanguage, {
    reply_markup: languageKeyboard(),
  });
}

// Simple emergency keyword check; not a clinical triage system.
function containsEmergencyWords(input) {
  const message = String(input || "").toLowerCase();

  const terms = [
    "can't breathe",
    "cannot breathe",
    "difficulty breathing",
    "chest pain",
    "unconscious",
    "severe bleeding",
    "stroke symptoms",
    "အသက်ရှူမဝ",
    "အသက်ရှူမရ",
    "ရင်ဘတ်အရမ်းနာ",
    "သတိလစ်",
    "သွေးထွက်မရပ်",
  ];

  return terms.some((term) => message.includes(term));
}

// ========================================
// 5. CONSULTATION SUBMISSION
// ========================================
const TOPIC_NAMES = {
  srhr: { my: "လိင်နှင့် မျိုးဆက်ပွားကျန်းမာရေး", en: "SRHR" },
  menstruation: { my: "ရာသီစက်ဝန်း", en: "Menstruation" },
  contraception: { my: "သန္ဓေတားနည်း", en: "Contraception" },
  pregnancy: { my: "ကိုယ်ဝန်", en: "Pregnancy" },
  general: { my: "အထွေထွေကျန်းမာရေး", en: "General health" },
};

async function submitConsultation(chatId, details) {
  const session = getSession(chatId);
  const lang = session.lang || "my";
  const consultation = session.consultation;

  if (!consultation || !consultation.topic || !consultation.consent) {
    await send(chatId, TEXT[lang].unknown, {
      reply_markup: mainKeyboard(lang),
    });
    return;
  }

  const requestId = newRequestId();
  const topic = TOPIC_NAMES[consultation.topic][lang];
  const safeDetails = details ? details.trim().slice(0, 1000) : "(No additional details provided)";

  const groupMessage =
    "🩺 Htoo Care — New Consultation Request\n\n" +
    "Request ID: " + requestId + "\n" +
    "Topic: " + topic + "\n" +
    "Language: " + (lang === "my" ? "Myanmar" : "English") + "\n\n" +
    "User's message:\n" + safeDetails + "\n\n" +
    "Consent: Confirmed by user\n" +
    "Please follow the service's clinical and privacy procedures.";

  const staffMessage =
    "📩 Htoo Care — Consultation Follow-up\n\n" +
    "Request ID: " + requestId + "\n" +
    "Topic: " + topic + "\n" +
    "Language: " + (lang === "my" ? "Myanmar" : "English") + "\n" +
    "Telegram Chat ID: " + String(chatId) + "\n\n" +
    "User's message:\n" + safeDetails + "\n\n" +
    "Consent: Confirmed by user\n" +
    "Please follow up through the approved service workflow.";

  // Group receives the request; designated staff also receives Chat ID.
  const results = await Promise.allSettled([
    bot.sendMessage(DOCTOR_GROUP_CHAT_ID, groupMessage),
    bot.sendMessage(CONSULTATION_STAFF_CHAT_ID, staffMessage),
  ]);

  const groupSent = results[0].status === "fulfilled";
  const staffSent = results[1].status === "fulfilled";

  if (!groupSent || !staffSent) {
    console.error(
      "Consultation delivery status:",
      JSON.stringify({ requestId, groupSent, staffSent })
    );

    // Keep request ID for troubleshooting, but do not claim both deliveries succeeded.
    await send(chatId, TEXT[lang].requestFailed);
    session.step = null;
    session.consultation = null;
    return;
  }

  session.step = null;
  session.consultation = null;

  await send(
    chatId,
    TEXT[lang].requestReceived + requestId + "\n\n" +
      TEXT[lang].staffNotified,
    { reply_markup: mainKeyboard(lang) }
  );

  console.log("Consultation request sent:", requestId);
}

// ========================================
// 6. COMMANDS
// ========================================
bot.onText(/^\/start(?:@\w+)?(?:\s.*)?$/, async (msg) => {
  await handleStart(msg.chat.id);
});

bot.onText(/^\/menu(?:@\w+)?$/, async (msg) => {
  await showMenu(msg.chat.id);
});

bot.onText(/^\/privacy(?:@\w+)?$/, async (msg) => {
  const lang = getLanguage(msg.chat.id);
  await send(msg.chat.id, TEXT[lang].privacyText, {
    reply_markup: backKeyboard(lang),
  });
});

bot.onText(/^\/help(?:@\w+)?$/, async (msg) => {
  await showMenu(msg.chat.id);
});

bot.onText(/^\/cancel(?:@\w+)?$/, async (msg) => {
  const chatId = msg.chat.id;
  const session = getSession(chatId);
  session.step = null;
  session.consultation = null;

  await send(chatId, TEXT[session.lang].cancelled, {
    reply_markup: mainKeyboard(session.lang),
  });
});

// ========================================
// 7. INLINE BUTTON HANDLING
// ========================================
bot.on("callback_query", async (query) => {
  const chatId = query.message?.chat?.id;
  const data = query.data;

  try {
    await bot.answerCallbackQuery(query.id);
  } catch (error) {
    console.error("Callback answer error:", error.message);
  }

  if (!chatId || !data) return;

  const session = getSession(chatId);

  if (data === "lang_my" || data === "lang_en") {
    session.lang = data === "lang_my" ? "my" : "en";
    session.step = null;
    session.consultation = null;

    await send(chatId, TEXT[session.lang].welcome);
    await showMenu(chatId);
    return;
  }

  const lang = getLanguage(chatId);
  const t = TEXT[lang];

  switch (data) {
    case "language":
      await send(chatId, t.chooseLanguage, {
        reply_markup: languageKeyboard(),
      });
      return;

    case "menu":
      await showMenu(chatId);
      return;

    case "health":
      await send(chatId, t.healthText, {
        reply_markup: healthKeyboard(lang),
      });
      return;

    case "srhr":
      await send(chatId, t.srhrText, {
        reply_markup: backKeyboard(lang),
      });
      return;

    case "mental":
      await send(chatId, t.mentalText, {
        reply_markup: backKeyboard(lang),
      });
      return;

    case "general":
      await send(chatId, t.generalText, {
        reply_markup: backKeyboard(lang),
      });
      return;

    case "symptoms":
      await send(chatId, t.symptomPrompt, {
        reply_markup: symptomKeyboard(lang),
      });
      return;

    case "symptom_pain":
    case "symptom_fever":
    case "symptom_breathing":
    case "symptom_other":
      if (data === "symptom_breathing") {
        await send(chatId, t.emergencyText, {
          reply_markup: backKeyboard(lang),
        });
      } else {
        await send(chatId, t.symptomAdvice, {
          reply_markup: backKeyboard(lang),
        });
      }
      return;

    case "referral":
      await send(chatId, t.referralText, {
        reply_markup: backKeyboard(lang),
      });
      return;

    case "contact":
      await send(chatId, t.contactText, {
        reply_markup: backKeyboard(lang),
      });
      return;

    case "privacy":
      await send(chatId, t.privacyText, {
        reply_markup: backKeyboard(lang),
      });
      return;

    case "emergency":
      await send(chatId, t.emergencyText, {
        reply_markup: backKeyboard(lang),
      });
      return;

    // Start consultation request
    case "consultation":
      session.step = "choose_topic";
      session.consultation = { consent: false, topic: null };

      await send(chatId, t.topicsTitle, {
        reply_markup: consultationTopicsKeyboard(lang),
      });
      return;

    case "topic_srhr":
    case "topic_menstruation":
    case "topic_contraception":
    case "topic_pregnancy":
    case "topic_general": {
      const topic = data.replace("topic_", "");
      session.consultation = { topic, consent: false };
      session.step = "awaiting_consent";

      await send(chatId, t.consent, {
        reply_markup: consentKeyboard(lang),
      });
      return;
    }

    case "consent_yes":
      if (!session.consultation || !session.consultation.topic) {
        await send(chatId, t.unknown, {
          reply_markup: mainKeyboard(lang),
        });
        return;
      }

      session.consultation.consent = true;
      session.step = "awaiting_details";

      await send(chatId, t.detailsPrompt, {
        reply_markup: detailsKeyboard(lang),
      });
      return;

    case "consent_no":
      session.step = null;
      session.consultation = null;

      await send(chatId, t.cancelled, {
        reply_markup: mainKeyboard(lang),
      });
      return;

    case "submit_no_details":
      if (
        session.step !== "awaiting_details" ||
        !session.consultation?.consent
      ) {
        await send(chatId, t.unknown, {
          reply_markup: mainKeyboard(lang),
        });
        return;
      }

      await submitConsultation(chatId, "");
      return;

    default:
      await send(chatId, t.unknown, {
        reply_markup: mainKeyboard(lang),
      });
  }
});

// ========================================
// 8. FREE-TEXT MESSAGE HANDLING
// ========================================
bot.on("message", async (msg) => {
  if (!msg.chat || !msg.text) return;

  const input = msg.text.trim();

  // Commands are handled by command listeners.
  if (input.startsWith("/")) return;

  const chatId = msg.chat.id;
  const session = getSession(chatId);
  const lang = session.lang || "my";

  // Emergency warning takes priority over the normal intake flow.
  if (containsEmergencyWords(input)) {
    await send(chatId, TEXT[lang].emergencyText, {
      reply_markup: backKeyboard(lang),
    });
    return;
  }

  if (session.step === "awaiting_details") {
    if (!session.consultation?.consent) {
      session.step = null;
      session.consultation = null;
      await send(chatId, TEXT[lang].unknown, {
        reply_markup: mainKeyboard(lang),
      });
      return;
    }

    if (input.length > 1000) {
      await send(chatId, TEXT[lang].detailsTooLong, {
        reply_markup: detailsKeyboard(lang),
      });
      return;
    }

    await submitConsultation(chatId, input);
    return;
  }

  await send(chatId, TEXT[lang].unknown, {
    reply_markup: mainKeyboard(lang),
  });
});

// ========================================
// 9. HEALTH-CHECK ENDPOINTS
// ========================================
app.get("/", (_req, res) => {
  res.status(200).send("Htoo Care Telegram Bot is running.");
});

app.get("/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    service: "htoo-care-telegram-bot",
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Htoo Care server listening on port ${PORT}`);
});

bot.on("polling_error", (error) => {
  console.error("Telegram polling error:", error.message);
});

process.on("unhandledRejection", (error) => {
  console.error("Unhandled rejection:", error);
});

process.on("uncaughtException", (error) => {
  console.error("Uncaught exception:", error);
});
