
"use strict";

const crypto = require("crypto");
const TelegramBot = require("node-telegram-bot-api");
const express = require("express");
const mysql = require("mysql2/promise");

// ========================================
// 1. CONFIGURATION
// ========================================
const TOKEN = process.env.TELEGRAM_BOT_TOKEN;

// These two IDs are optional for now.
const DOCTOR_GROUP_CHAT_ID =
  process.env.DOCTOR_GROUP_CHAT_ID || "";
const CONSULTATION_STAFF_CHAT_ID =
  process.env.CONSULTATION_STAFF_CHAT_ID || "";

const PORT = Number(process.env.PORT || 3000);

const MYSQL_HOST = process.env.MYSQL_HOST;
const MYSQL_PORT = Number(process.env.MYSQL_PORT || 3306);
const MYSQL_DATABASE = process.env.MYSQL_DATABASE;
const MYSQL_USER = process.env.MYSQL_USER;
const MYSQL_PASSWORD = process.env.MYSQL_PASSWORD;

if (!TOKEN) {
  console.error("Missing TELEGRAM_BOT_TOKEN.");
  process.exit(1);
}

if (
  !MYSQL_HOST ||
  !MYSQL_DATABASE ||
  !MYSQL_USER ||
  !MYSQL_PASSWORD
) {
  console.error("Missing required MySQL environment variables.");
  process.exit(1);
}

const pool = mysql.createPool({
  host: MYSQL_HOST,
  port: MYSQL_PORT,
  database: MYSQL_DATABASE,
  user: MYSQL_USER,
  password: MYSQL_PASSWORD,
  waitForConnections: true,
  connectionLimit: 5,
  queueLimit: 0,
  charset: "utf8mb4",
  connectTimeout: 10000
});

const app = express();
app.use(express.json());

const bot = new TelegramBot(TOKEN, { polling: true });
const sessions = new Map();

// ========================================
// 2. BILINGUAL TEXT
// ========================================
const TEXT = {
  my: {
    welcome:
      "မင်္ဂလာပါ။ Htoo Care မှ ကြိုဆိုပါတယ်။\n\n" +
      "ဤ bot သည် ကျန်းမာရေးအချက်အလက်နှင့် ဝန်ဆောင်မှုလမ်းညွှန်များ ပေးပါသည်။ ဆရာဝန်၏ စစ်ဆေးမှုကို အစားမထိုးနိုင်ပါ။",
    chooseLanguage: "ဘာသာစကား ရွေးချယ်ပါ။",
    menu: "ဝန်ဆောင်မှုတစ်ခုကို ရွေးချယ်ပါ။",
    health: "ကျန်းမာရေးအချက်အလက်",
    symptoms: "လက္ခဏာလမ်းညွှန်",
    referral: "ဆေးရုံ/ဆေးခန်း လမ်းညွှန်",
    contact: "7887 ဆက်သွယ်ရန်",
    privacy: "ကိုယ်ရေးအချက်အလက်နှင့် လုံခြုံရေး",
    emergency: "အရေးပေါ်သတိပေးချက်",
    consultation: "ဆရာဝန်နှင့် တိုင်ပင်ရန်",
    heat: "🌡️ El Niño / အပူဒဏ်ကာကွယ်ရေး",
    back: "ပင်မမီနူးသို့ ပြန်ရန်",
    healthText: "ကျန်းမာရေးအကြောင်းအရာကို ရွေးချယ်ပါ။",
    srhr: "လိင်နှင့် မျိုးဆက်ပွားကျန်းမာရေး",
    mental: "စိတ်ကျန်းမာရေး",
    general: "အထွေထွေကျန်းမာရေး",
    srhrText:
      "SRHR တွင် ရာသီစက်ဝန်း၊ သန္ဓေတားနည်းများ၊ လိင်မှတစ်ဆင့် ကူးစက်နိုင်သောရောဂါများနှင့် လုံခြုံသောဆက်ဆံရေးတို့ ပါဝင်ပါသည်။",
    mentalText:
      "စိတ်ဖိစီးမှုများပါက ယုံကြည်ရသူနှင့် ပြောဆိုပါ။ လိုအပ်ပါက ကျွမ်းကျင်သူထံ ဆက်သွယ်ပါ။",
    generalText:
      "အာဟာရမျှတစွာစားခြင်း၊ သန့်ရှင်းသောရေသောက်ခြင်း၊ လုံလောက်စွာအိပ်စက်ခြင်းနှင့် ကာကွယ်ဆေးထိုးခြင်းတို့က ကျန်းမာရေးကို အထောက်အကူပြုနိုင်ပါသည်။",
    symptomPrompt: "လက္ခဏာအမျိုးအစားကို ရွေးပါ။",
    symptomPain: "နာကျင်မှု",
    symptomFever: "ဖျားနာခြင်း",
    symptomBreathing: "အသက်ရှူမဝခြင်း",
    symptomOther: "အခြားလက္ခဏာ",
    symptomAdvice:
      "ဤ bot သည် ရောဂါအတည်ပြုမပေးနိုင်ပါ။ လက္ခဏာများ ဆက်လက်ဖြစ်ပွားခြင်း သို့မဟုတ် ပိုဆိုးလာခြင်းရှိပါက ကျန်းမာရေးဝန်ထမ်းထံ ဆက်သွယ်ပါ။",
    referralText:
      "သင့်ဒေသရှိ ယုံကြည်စိတ်ချရသော ဆေးရုံ၊ ဆေးခန်း သို့မဟုတ် အထူးကုဝန်ဆောင်မှုထံ ဆက်သွယ်ပါ။ အတည်ပြုထားသော ဆေးခန်းစာရင်းကို ဤ bot တွင် မချိတ်ဆက်ရသေးပါ။",
    contactText:
      "7887 သို့ ဆက်သွယ်နိုင်မှုနှင့် ကုန်ကျစရိတ်ကို အတည်ပြုပါ။ ဤ bot သည် ဖုန်းခေါ်ဆိုမှုကို တိုက်ရိုက်မချိတ်ဆက်ပေးပါ။",
    privacyText:
      "• ဤ bot သည် ဆရာဝန်၏ စစ်ဆေးမှုကို အစားမထိုးနိုင်ပါ။\n" +
      "• Bot session သည် server memory ထဲတွင် ယာယီသိမ်းထားပြီး server restart ဖြစ်ပါက ပျောက်သွားနိုင်ပါသည်။\n" +
      "• Consultation request ကို MySQL ထဲသိမ်းဆည်းပါမည်။ သတ်မှတ်ထားသော Telegram Group ID များ ထည့်ထားမှသာ အဖွဲ့များထံ အကြောင်းကြားနိုင်ပါမည်။\n" +
      "• OTP၊ password၊ မှတ်ပုံတင်နံပါတ်နှင့် မလိုအပ်သော ကိုယ်ရေးအချက်အလက်များ မပို့ပါနှင့်။",
    emergencyText:
      "🚨 အရေးပေါ်သတိပေးချက်\n\n" +
      "အသက်ရှူမဝခြင်း၊ ရင်ဘတ်အလွန်နာခြင်း၊ သတိလစ်ခြင်း၊ တက်ခြင်း၊ စိတ်ရှုပ်ထွေးခြင်း သို့မဟုတ် သွေးထွက်မရပ်ခြင်းရှိပါက bot ကို မစောင့်ဘဲ အရေးပေါ်ဆေးကုသမှု ချက်ချင်းရယူပါ။",
    unknown: "နားမလည်ပါ။ မီနူးမှ ရွေးချယ်ပါ သို့မဟုတ် /start ပို့ပါ။",
    cancelled: "လုပ်ဆောင်မှုကို ပယ်ဖျက်ပြီးပါပြီ။",
    heatAvoid: "ရှောင်ရန် / ဆောင်ရန်",
    heatWater: "ရေဓာတ်နှင့် သောက်ရေ",
    heatSymptoms: "အပူဒဏ်လက္ခဏာများ",
    heatEmergency: "အပူလွန်ကဲမှု အရေးပေါ်အခြေအနေ",
    heatAvoidText:
      "✅ ဆောင်ရန်\n" +
      "• ရေကို ပုံမှန်သောက်ပါ။\n" +
      "• ပေါ့ပါးပြီး လေဝင်လေထွက်ကောင်းသော အဝတ်အစားဝတ်ပါ။\n" +
      "• အိမ်ကို အေးမြအောင်ထားပါ။\n" +
      "• အပြင်အလုပ်ကို ဖြစ်နိုင်လျှင် အေးသောအချိန်သို့ ရွှေ့ပါ။\n" +
      "• ကလေး၊ သက်ကြီးရွယ်အို၊ ကိုယ်ဝန်ဆောင်နှင့် နာတာရှည်ရောဂါရှိသူများကို ဂရုစိုက်ပါ။\n\n" +
      "❌ အပူဆုံးအချိန်တွင် ပြင်းထန်သော ကိုယ်လက်လှုပ်ရှားမှု မလုပ်ပါနှင့်။ ကလေးကို ရပ်ထားသောကားထဲတွင် တစ်ယောက်တည်း မထားပါနှင့်။",
    heatWaterText:
      "• သန့်ရှင်းလုံခြုံသော သောက်ရေကို အသုံးပြုပါ။\n" +
      "• ORS ကို အထုပ်ပေါ်ညွှန်ကြားချက်အတိုင်း ဖျော်ပါ။\n" +
      "• နှလုံး၊ ကျောက်ကပ်ရောဂါကြောင့် ရေသောက်ပမာဏ ကန့်သတ်ထားသူများသည် ဆရာဝန်ညွှန်ကြားချက်ကို လိုက်နာပါ။",
    heatSymptomsText:
      "အပူဒဏ်လက္ခဏာများမှာ ခေါင်းကိုက်ခြင်း၊ မူးဝေခြင်း၊ အားနည်းခြင်း၊ ချွေးထွက်များခြင်း၊ ကြွက်တက်ခြင်း၊ ပျို့အန်ခြင်းနှင့် ရေငတ်ခြင်းတို့ ဖြစ်နိုင်ပါသည်။\n\n" +
      "အလုပ်ရပ်ပါ။ အေးမြသောနေရာသို့ ရွှေ့ပါ။ ကိုယ်ကို အေးအောင်လုပ်ပါ။ သတိကောင်းပြီး မျိုချနိုင်မှသာ ရေကို နည်းနည်းစီ သောက်ပါ။ မသက်သာလျှင် ဆေးကုသမှုရယူပါ။",
    heatEmergencyText:
      "🚨 အပူလွန်ကဲမှုသည် အသက်အန္တရာယ်ရှိနိုင်ပါသည်။\n\n" +
      "စိတ်ရှုပ်ထွေးခြင်း၊ တက်ခြင်း၊ သတိလစ်ခြင်းရှိပါက အရေးပေါ်ဆေးကုသမှု ချက်ချင်းရယူပါ။ လူနာကို အေးမြသောနေရာသို့ ရွှေ့ပြီး ကိုယ်ကို အေးအောင်လုပ်ပါ။ သတိလစ်နေသူကို ပါးစပ်မှ ရေ၊ အစာ၊ ဆေး မတိုက်ပါနှင့်။",
    topicsTitle: "တိုင်ပင်လိုသော ကျန်းမာရေးခေါင်းစဉ်ကို ရွေးပါ။",
    topicSrhr: "SRHR",
    topicMenstruation: "ရာသီစက်ဝန်း",
    topicContraception: "သန္ဓေတားနည်း",
    topicPregnancy: "ကိုယ်ဝန်",
    topicGeneral: "အထွေထွေကျန်းမာရေး",
    consent:
      "ကိုယ်ရေးအချက်အလက်နှင့် သဘောတူညီချက်\n\n" +
      "သင်ရွေးချယ်ထားသော ခေါင်းစဉ်နှင့် သင်ပေးပို့သော အချက်အလက်များကို MySQL ထဲ သိမ်းဆည်းပါမည်။ Telegram Group ID များ ထည့်ထားပါက သက်ဆိုင်ရာအဖွဲ့များထံလည်း ပို့နိုင်ပါသည်။\n\n" +
      "သင့် Telegram Chat ID ကိုလည်း follow-up အတွက် သိမ်းဆည်းပါမည်။ မလိုအပ်သော ကိုယ်ရေးအချက်အလက်များ မပို့ပါနှင့်။",
    consentYes: "သဘောတူပြီး ဆက်လုပ်မည်",
    consentNo: "မသဘောတူပါ / ပယ်ဖျက်မည်",
    detailsPrompt:
      "သင့်ကျန်းမာရေးမေးခွန်းကို အတိုချုံးရေးပို့ပါ။\n\n" +
      "အမည်၊ ဖုန်းနံပါတ်၊ လိပ်စာ၊ မှတ်ပုံတင် သို့မဟုတ် password မရေးပါနှင့်။",
    noDetails: "အသေးစိတ်မပို့ဘဲ တင်မည်",
    requestReceived: "တောင်းဆိုချက်ကို Database ထဲ သိမ်းဆည်းပြီးပါပြီ။ Request ID: ",
    requestSavedNoNotice:
      "တောင်းဆိုချက်ကို Database ထဲ သိမ်းဆည်းပြီးပါပြီ။ သို့သော် ဆရာဝန်အဖွဲ့/ဝန်ထမ်းထံ အကြောင်းကြားမှု မပြုလုပ်နိုင်သေးပါ။ Request ID: ",
    requestFailed:
      "တောင်းဆိုချက်ကို Database ထဲ သိမ်းဆည်းရာတွင် အခက်အခဲရှိနေပါသည်။ ခဏကြာမှ ပြန်ကြိုးစားပါ။",
    detailsTooLong: "စာသားကို စာလုံး ၁၀၀၀ အတွင်း အတိုချုံးရေးပါ။"
  },

  en: {
    welcome:
      "Welcome to Htoo Care.\n\nThis bot provides general health information and service guidance. It does not replace professional medical assessment.",
    chooseLanguage: "Please choose your language.",
    menu: "Please choose a service.",
    health: "Health information",
    symptoms: "Symptom guidance",
    referral: "Hospital/clinic guidance",
    contact: "Contact 7887",
    privacy: "Privacy and safety",
    emergency: "Emergency warning",
    consultation: "Request doctor consultation",
    heat: "🌡️ El Niño / Heat Safety",
    back: "Back to main menu",
    healthText: "Choose a health information topic.",
    srhr: "Sexual and reproductive health",
    mental: "Mental health",
    general: "General health",
    srhrText:
      "SRHR includes menstrual health, contraception, sexually transmitted infections and safer relationships.",
    mentalText:
      "Consider speaking with someone you trust and contacting a qualified professional if needed.",
    generalText:
      "Balanced nutrition, safe drinking water, adequate sleep and recommended vaccinations can support general health.",
    symptomPrompt: "Choose a symptom category.",
    symptomPain: "Pain",
    symptomFever: "Fever",
    symptomBreathing: "Difficulty breathing",
    symptomOther: "Other symptom",
    symptomAdvice:
      "This bot cannot diagnose a condition. Contact a qualified health professional if symptoms persist or worsen.",
    referralText:
      "Contact trusted health services in your area. A verified clinic directory is not connected to this bot yet.",
    contactText:
      "Confirm availability and charges for 7887. This bot does not place calls directly.",
    privacyText:
      "• This bot does not replace a medical assessment.\n" +
      "• Session state is temporary and may be lost after a server restart.\n" +
      "• Consultation requests are stored in MySQL. Telegram notifications require the relevant group IDs to be configured.\n" +
      "• Do not send OTPs, passwords, ID numbers or unnecessary personal information.",
    emergencyText:
      "🚨 EMERGENCY WARNING\n\n" +
      "For severe difficulty breathing, severe chest pain, loss of consciousness, seizures, confusion or uncontrolled bleeding, seek emergency medical care immediately. Do not wait for the bot.",
    unknown: "I did not understand that. Use the menu or send /start.",
    cancelled: "The action has been cancelled.",
    heatAvoid: "Do and Don't",
    heatWater: "Hydration and safe water",
    heatSymptoms: "Heat-illness symptoms",
    heatEmergency: "Heatstroke emergency",
    heatAvoidText:
      "DO:\n• Drink water regularly.\n• Wear light, loose clothing.\n• Keep your home cool.\n• Move outdoor work to cooler hours where possible.\n• Check on children, older adults, pregnant people and people with chronic illness.\n\n" +
      "AVOID strenuous activity during the hottest hours and never leave a child alone in a parked vehicle.",
    heatWaterText:
      "• Use safe drinking water.\n• Prepare ORS exactly as directed on the packet.\n• Follow your clinician's advice if you have a fluid restriction due to heart or kidney disease.",
    heatSymptomsText:
      "Possible heat-illness symptoms include headache, dizziness, weakness, heavy sweating, muscle cramps, nausea and intense thirst.\n\n" +
      "Stop activity, move to a cool place and cool the skin. Give water only if the person is fully alert and can swallow safely. Seek medical care if symptoms persist.",
    heatEmergencyText:
      "🚨 Heatstroke can be life-threatening. Confusion, seizures or loss of consciousness in extreme heat require immediate emergency medical care. Move the person to a cool place and begin cooling. Do not give anything by mouth to an unconscious person.",
    topicsTitle: "Choose a health topic for consultation.",
    topicSrhr: "SRHR",
    topicMenstruation: "Menstruation",
    topicContraception: "Contraception",
    topicPregnancy: "Pregnancy",
    topicGeneral: "General health",
    consent:
      "Privacy and consent\n\nYour selected topic and submitted information will be stored in MySQL. If Telegram group IDs are configured, the request can also be sent to those groups.\n\nYour Telegram Chat ID will be stored for follow-up. Do not send unnecessary identifying information.",
    consentYes: "I consent and continue",
    consentNo: "Decline / cancel",
    detailsPrompt:
      "Briefly describe your health question.\n\nDo not include your name, phone number, address, ID number or password.",
    noDetails: "Submit without details",
    requestReceived: "Your request was saved to the database. Request ID: ",
    requestSavedNoNotice:
      "Your request was saved, but Telegram group/staff notifications are not configured or could not be delivered. Request ID: ",
    requestFailed:
      "We could not save your request to the database. Please try again later.",
    detailsTooLong: "Please shorten your message to 1,000 characters."
  }
};

// ========================================
// 3. SESSION AND KEYBOARD HELPERS
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
        { text: t.symptoms, callback_data: "symptoms" }
      ],
      [{ text: t.heat, callback_data: "heat" }],
      [{ text: t.consultation, callback_data: "consultation" }],
      [
        { text: t.referral, callback_data: "referral" },
        { text: t.contact, callback_data: "contact" }
      ],
      [
        { text: t.privacy, callback_data: "privacy" },
        { text: t.emergency, callback_data: "emergency" }
      ],
      [{ text: "🌐 Language / ဘာသာစကား", callback_data: "language" }]
    ]
  };
}

function backKeyboard(lang) {
  return {
    inline_keyboard: [
      [{ text: TEXT[lang].back, callback_data: "menu" }]
    ]
  };
}

function languageKeyboard() {
  return {
    inline_keyboard: [
      [{ text: "မြန်မာဘာသာ", callback_data: "lang_my" }],
      [{ text: "English", callback_data: "lang_en" }]
    ]
  };
}

function healthKeyboard(lang) {
  const t = TEXT[lang];
  return {
    inline_keyboard: [
      [{ text: t.srhr, callback_data: "srhr" }],
      [{ text: t.mental, callback_data: "mental" }],
      [{ text: t.general, callback_data: "general" }],
      [{ text: t.back, callback_data: "menu" }]
    ]
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
      [{ text: t.back, callback_data: "menu" }]
    ]
  };
}

function heatSafetyKeyboard(lang) {
  const t = TEXT[lang];
  return {
    inline_keyboard: [
      [{ text: t.heatAvoid, callback_data: "heat_avoid" }],
      [{ text: t.heatWater, callback_data: "heat_water" }],
      [{ text: t.heatSymptoms, callback_data: "heat_symptoms" }],
      [{ text: t.heatEmergency, callback_data: "heat_emergency" }],
      [{ text: t.back, callback_data: "menu" }]
    ]
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
      [{ text: t.back, callback_data: "menu" }]
    ]
  };
}

function consentKeyboard(lang) {
  const t = TEXT[lang];
  return {
    inline_keyboard: [
      [{ text: t.consentYes, callback_data: "consent_yes" }],
      [{ text: t.consentNo, callback_data: "consent_no" }]
    ]
  };
}

function detailsKeyboard(lang) {
  const t = TEXT[lang];
  return {
    inline_keyboard: [
      [{ text: t.noDetails, callback_data: "submit_no_details" }],
      [{ text: t.back, callback_data: "menu" }]
    ]
  };
}

async function showMenu(chatId) {
  const session = getSession(chatId);
  const lang = getLanguage(chatId);
  session.step = null;
  session.consultation = null;

  await send(chatId, TEXT[lang].menu, {
    reply_markup: mainKeyboard(lang)
  });
}

async function handleStart(chatId) {
  const session = getSession(chatId);
  const lang = getLanguage(chatId);
  session.step = null;
  session.consultation = null;

  await send(chatId, TEXT[lang].chooseLanguage, {
    reply_markup: languageKeyboard()
  });
}

// ========================================
// 4. EMERGENCY KEYWORD CHECK
// ========================================
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
    "heatstroke",
    "heat stroke",
    "seizure",
    "not responding",
    "confused in the heat",
    "အသက်ရှူမဝ",
    "အသက်ရှူမရ",
    "ရင်ဘတ်အရမ်းနာ",
    "သတိလစ်",
    "သွေးထွက်မရပ်",
    "စိတ်ရှုပ်ထွေး",
    "တက်နေ",
    "ပုံမှန်မတုံ့ပြန်",
    "အပူလွန်ကဲ"
  ];

  return terms.some((term) => message.includes(term));
}

// ========================================
// 5. CONSULTATION + MYSQL
// ========================================
const TOPIC_NAMES = {
  srhr: {
    my: "လိင်နှင့် မျိုးဆက်ပွားကျန်းမာရေး",
    en: "SRHR"
  },
  menstruation: {
    my: "ရာသီစက်ဝန်း",
    en: "Menstruation"
  },
  contraception: {
    my: "သန္ဓေတားနည်း",
    en: "Contraception"
  },
  pregnancy: {
    my: "ကိုယ်ဝန်",
    en: "Pregnancy"
  },
  general: {
    my: "အထွေထွေကျန်းမာရေး",
    en: "General health"
  }
};

function newRequestId() {
  return "HC-" + crypto.randomBytes(6).toString("hex").toUpperCase();
}

async function submitConsultation(chatId, details) {
  const session = getSession(chatId);
  const lang = getLanguage(chatId);
  const consultation = session.consultation;

  if (
    session.step !== "awaiting_details" ||
    !consultation ||
    !consultation.topic ||
    consultation.consent !== true
  ) {
    await send(chatId, TEXT[lang].unknown, {
      reply_markup: mainKeyboard(lang)
    });
    return;
  }

  const topic = consultation.topic;
  const topicName = TOPIC_NAMES[topic]?.[lang];

  if (!topicName) {
    await send(chatId, TEXT[lang].unknown, {
      reply_markup: mainKeyboard(lang)
    });
    return;
  }

  const safeDetails = details
    ? String(details).trim().slice(0, 1000)
    : "";

  const requestId = newRequestId();

  // Save to MySQL first. Do not send health details if saving fails.
  try {
    await pool.execute(
      `INSERT INTO consultation_requests
       (request_id, telegram_chat_id, topic, language, details,
        consent_given, consent_at, status)
       VALUES (?, ?, ?, ?, ?, 1, ?, 'pending')`,
      [
        requestId,
        String(chatId),
        topic,
        lang,
        safeDetails || null,
        consultation.consentAt || new Date()
      ]
    );
  } catch (error) {
    console.error("Consultation database save failed:", {
      code: error.code || "UNKNOWN",
      requestId
    });

    session.step = null;
    session.consultation = null;

    await send(chatId, TEXT[lang].requestFailed, {
      reply_markup: mainKeyboard(lang)
    });
    return;
  }

  const displayDetails =
    safeDetails || "(No additional details provided)";

  const groupMessage =
    "🩺 Htoo Care — Consultation Request\n\n" +
    "Request ID: " + requestId + "\n" +
    "Topic: " + topicName + "\n" +
    "Language: " + (lang === "my" ? "Myanmar" : "English") + "\n\n" +
    "User message:\n" + displayDetails + "\n\n" +
    "Consent: Confirmed";

  const staffMessage =
    "📩 Htoo Care — Consultation Follow-up\n\n" +
    "Request ID: " + requestId + "\n" +
    "Topic: " + topicName + "\n" +
    "Language: " + (lang === "my" ? "Myanmar" : "English") + "\n" +
    "Telegram Chat ID: " + String(chatId) + "\n\n" +
    "User message:\n" + displayDetails + "\n\n" +
    "Consent: Confirmed";

  // Only notify destinations that have been configured.
  const notificationTasks = [];

  if (DOCTOR_GROUP_CHAT_ID.trim()) {
    notificationTasks.push(
      bot.sendMessage(DOCTOR_GROUP_CHAT_ID, groupMessage)
    );
  }

  if (CONSULTATION_STAFF_CHAT_ID.trim()) {
    notificationTasks.push(
      bot.sendMessage(CONSULTATION_STAFF_CHAT_ID, staffMessage)
    );
  }

  const results = await Promise.allSettled(notificationTasks);

  const notificationsConfigured = notificationTasks.length > 0;
  const allNotificationsSent =
    notificationsConfigured &&
    results.every((result) => result.status === "fulfilled");

  if (!allNotificationsSent) {
    console.warn("Consultation saved; notifications incomplete:", {
      requestId,
      configuredDestinations: notificationTasks.length,
      failedDestinations: results.filter(
        (result) => result.status === "rejected"
      ).length
    });
  }

  session.step = null;
  session.consultation = null;

  if (allNotificationsSent) {
    await send(
      chatId,
      TEXT[lang].requestReceived +
        requestId +
        "\n\n" +
        (lang === "my"
          ? "ဝန်ဆောင်မှုအဖွဲ့က follow-up လုပ်ရန် ဆောင်ရွက်နိုင်ပါသည်။ အရေးပေါ်အခြေအနေတွင် bot ကို မစောင့်ပါနှင့်။"
          : "The configured team has been notified. Do not wait for the bot in an emergency."),
      { reply_markup: mainKeyboard(lang) }
    );
  } else {
    await send(
      chatId,
      TEXT[lang].requestSavedNoNotice +
        requestId +
        "\n\n" +
        (lang === "my"
          ? "တောင်းဆိုချက်ကို Database ထဲ သိမ်းထားပါသည်။ ဆရာဝန်အဖွဲ့နှင့် ဝန်ထမ်းထံ အကြောင်းကြားနိုင်ရန် Chat ID များကို နောက်မှ ထည့်သွင်းရန် လိုအပ်ပါသည်။"
          : "The request is stored. Configure the doctor group and/or staff chat IDs to enable Telegram notifications."),
      { reply_markup: mainKeyboard(lang) }
    );
  }

  console.log("Consultation request saved:", requestId);
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
    reply_markup: backKeyboard(lang)
  });
});

bot.onText(/^\/help(?:@\w+)?$/, async (msg) => {
  await showMenu(msg.chat.id);
});

bot.onText(/^\/cancel(?:@\w+)?$/, async (msg) => {
  const session = getSession(msg.chat.id);
  const lang = getLanguage(msg.chat.id);

  session.step = null;
  session.consultation = null;

  await send(msg.chat.id, TEXT[lang].cancelled, {
    reply_markup: mainKeyboard(lang)
  });
});

// ========================================
// 7. BUTTON HANDLING
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
        reply_markup: languageKeyboard()
      });
      return;

    case "menu":
      await showMenu(chatId);
      return;

    case "health":
      await send(chatId, t.healthText, {
        reply_markup: healthKeyboard(lang)
      });
      return;

    case "srhr":
      await send(chatId, t.srhrText, {
        reply_markup: backKeyboard(lang)
      });
      return;

    case "mental":
      await send(chatId, t.mentalText, {
        reply_markup: backKeyboard(lang)
      });
      return;

    case "general":
      await send(chatId, t.generalText, {
        reply_markup: backKeyboard(lang)
      });
      return;

    case "symptoms":
      await send(chatId, t.symptomPrompt, {
        reply_markup: symptomKeyboard(lang)
      });
      return;

    case "symptom_pain":
    case "symptom_fever":
    case "symptom_other":
      await send(chatId, t.symptomAdvice, {
        reply_markup: backKeyboard(lang)
      });
      return;

    case "symptom_breathing":
      await send(chatId, t.emergencyText, {
        reply_markup: backKeyboard(lang)
      });
      return;

    case "referral":
      await send(chatId, t.referralText, {
        reply_markup: backKeyboard(lang)
      });
      return;

    case "contact":
      await send(chatId, t.contactText, {
        reply_markup: backKeyboard(lang)
      });
      return;

    case "privacy":
      await send(chatId, t.privacyText, {
        reply_markup: backKeyboard(lang)
      });
      return;

    case "emergency":
      await send(chatId, t.emergencyText, {
        reply_markup: backKeyboard(lang)
      });
      return;

    case "heat":
      await send(chatId, t.heat, {
        reply_markup: heatSafetyKeyboard(lang)
      });
      return;

    case "heat_avoid":
      await send(chatId, t.heatAvoidText, {
        reply_markup: heatSafetyKeyboard(lang)
      });
      return;

    case "heat_water":
      await send(chatId, t.heatWaterText, {
        reply_markup: heatSafetyKeyboard(lang)
      });
      return;

    case "heat_symptoms":
      await send(chatId, t.heatSymptomsText, {
        reply_markup: heatSafetyKeyboard(lang)
      });
      return;

    case "heat_emergency":
      await send(chatId, t.heatEmergencyText, {
        reply_markup: heatSafetyKeyboard(lang)
      });
      return;

    case "consultation":
      session.step = "choose_topic";
      session.consultation = {
        topic: null,
        consent: false,
        consentAt: null
      };

      await send(chatId, t.topicsTitle, {
        reply_markup: consultationTopicsKeyboard(lang)
      });
      return;

    case "topic_srhr":
    case "topic_menstruation":
    case "topic_contraception":
    case "topic_pregnancy":
    case "topic_general": {
      const topic = data.replace("topic_", "");

      session.consultation = {
        topic,
        consent: false,
        consentAt: null
      };
      session.step = "awaiting_consent";

      await send(chatId, t.consent, {
        reply_markup: consentKeyboard(lang)
      });
      return;
    }

    case "consent_yes":
      if (
        session.step !== "awaiting_consent" ||
        !session.consultation?.topic
      ) {
        await send(chatId, t.unknown, {
          reply_markup: mainKeyboard(lang)
        });
        return;
      }

      session.consultation.consent = true;
      session.consultation.consentAt = new Date();
      session.step = "awaiting_details";

      await send(chatId, t.detailsPrompt, {
        reply_markup: detailsKeyboard(lang)
      });
      return;

    case "consent_no":
      session.step = null;
      session.consultation = null;

      await send(chatId, t.cancelled, {
        reply_markup: mainKeyboard(lang)
      });
      return;

    case "submit_no_details":
      if (
        session.step !== "awaiting_details" ||
        !session.consultation?.consent
      ) {
        await send(chatId, t.unknown, {
          reply_markup: mainKeyboard(lang)
        });
        return;
      }

      await submitConsultation(chatId, "");
      return;

    default:
      await send(chatId, t.unknown, {
        reply_markup: mainKeyboard(lang)
      });
  }
});

// ========================================
// 8. FREE-TEXT MESSAGES
// ========================================
bot.on("message", async (msg) => {
  if (!msg.chat || !msg.text) return;

  const input = msg.text.trim();
  if (input.startsWith("/")) return;

  const chatId = msg.chat.id;
  const session = getSession(chatId);
  const lang = getLanguage(chatId);

  // Allow the consultation text to be submitted first.
  // Emergency terms in a consultation message are handled by
  // the healthcare team; users should still seek urgent care.
  if (session.step === "awaiting_details") {
    if (!session.consultation?.consent) {
      session.step = null;
      session.consultation = null;

      await send(chatId, TEXT[lang].unknown, {
        reply_markup: mainKeyboard(lang)
      });
      return;
    }

    if (input.length > 1000) {
      await send(chatId, TEXT[lang].detailsTooLong, {
        reply_markup: detailsKeyboard(lang)
      });
      return;
    }

    if (containsEmergencyWords(input)) {
      await send(chatId, TEXT[lang].emergencyText);
    }

    await submitConsultation(chatId, input);
    return;
  }

  if (containsEmergencyWords(input)) {
    await send(chatId, TEXT[lang].emergencyText, {
      reply_markup: backKeyboard(lang)
    });
    return;
  }

  await send(chatId, TEXT[lang].unknown, {
    reply_markup: mainKeyboard(lang)
  });
});

// ========================================
// 9. FADEHOST HEALTH CHECK
// ========================================
app.get("/", (_req, res) => {
  res.status(200).send("Htoo Care Telegram Bot is running.");
});

app.get("/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");

    res.status(200).json({
      status: "ok",
      service: "htoo-care-telegram-bot",
      database: "ok"
    });
  } catch (error) {
    console.error(
      "Health check database error:",
      error.code || error.message
    );

    res.status(503).json({
      status: "degraded",
      service: "htoo-care-telegram-bot",
      database: "error"
    });
  }
});

const server = app.listen(PORT, "0.0.0.0", () => {
  console.log("Htoo Care server listening on port " + PORT);

  if (!DOCTOR_GROUP_CHAT_ID) {
    console.warn("Doctor group notifications are not configured.");
  }

  if (!CONSULTATION_STAFF_CHAT_ID) {
    console.warn("Staff notifications are not configured.");
  }
});

bot.on("polling_error", (error) => {
  console.error("Telegram polling error:", error.message);
});

process.on("unhandledRejection", (error) => {
  console.error("Unhandled rejection:", error);
});

async function shutdown(signal) {
  console.log("Received " + signal + "; shutting down.");

  try {
    await bot.stopPolling();
  } catch (_) {}

  try {
    await pool.end();
  } catch (_) {}

  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
