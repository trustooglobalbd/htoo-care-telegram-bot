
"use strict";

const TelegramBot = require("node-telegram-bot-api");
const express = require("express");

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const PORT = process.env.PORT || 3000;
const CONTACT_NUMBER = "7887";

if (!TOKEN) {
  console.error(
    "ERROR: TELEGRAM_BOT_TOKEN is missing. Set it in FadeHost Environment Variables."
  );
  process.exit(1);
}

const app = express();
app.use(express.json());

const bot = new TelegramBot(TOKEN, { polling: true });

// Keep temporary conversation state in memory.
// This is cleared if the server restarts.
const sessions = new Map();

const TEXT = {
  my: {
    welcome:
      "မင်္ဂလာပါ။ Htoo Care မှ ကြိုဆိုပါတယ်။\n\n" +
      "ဤ bot သည် အထွေထွေကျန်းမာရေးအချက်အလက်နှင့် ဝန်ဆောင်မှုလမ်းညွှန်များ ပေးရန်ဖြစ်ပြီး ဆရာဝန်၏ စစ်ဆေးမှုကို အစားမထိုးနိုင်ပါ။",
    chooseLanguage: "ဘာသာစကား ရွေးချယ်ပါ။",
    menu: "အောက်ပါဝန်ဆောင်မှုများထဲမှ ရွေးချယ်ပါ။",
    health: "ကျန်းမာရေးအချက်အလက်",
    symptoms: "လက္ခဏာအကြောင်း လမ်းညွှန်",
    referral: "ဆေးရုံ/ဆေးခန်း လမ်းညွှန်",
    contact: "7887 ဆက်သွယ်ရန်",
    privacy: "ကိုယ်ရေးအချက်အလက်နှင့် လုံခြုံရေး",
    emergency: "အရေးပေါ်သတိပေးချက်",
    back: "ပင်မမီနူးသို့ ပြန်သွားရန်",
    healthText:
      "ကျန်းမာရေးဆိုင်ရာ အထွေထွေအချက်အလက်များအတွက် အောက်ပါအကြောင်းအရာကို ရွေးပါ။",
    srhr: "လိင်နှင့် မျိုးဆက်ပွားကျန်းမာရေး",
    mental: "စိတ်ကျန်းမာရေး",
    general: "အထွေထွေကျန်းမာရေး",
    srhrText:
      "လိင်နှင့် မျိုးဆက်ပွားကျန်းမာရေး (SRHR) တွင် ရာသီစက်ဝန်း၊ သန္ဓေတားနည်းများ၊ လိင်မှတစ်ဆင့် ကူးစက်နိုင်သောရောဂါများနှင့် သဘောတူညီမှုရှိသော လုံခြုံသည့်ဆက်ဆံရေးတို့ ပါဝင်ပါတယ်။ သင့်အခြေအနေအလိုက် ကျွမ်းကျင်သူထံမှ အကြံဉာဏ်ရယူပါ။",
    mentalText:
      "စိတ်ဖိစီးမှုများပါက ယုံကြည်ရသူတစ်ဦးနှင့် ပြောဆိုခြင်း၊ အနားယူခြင်းနှင့် လိုအပ်ပါက စိတ်ကျန်းမာရေးပညာရှင်ထံ ဆက်သွယ်ခြင်းတို့ကို စဉ်းစားပါ။ မိမိကိုယ်ကို ထိခိုက်စေနိုင်သည့် အန္တရာယ်ရှိပါက ချက်ချင်း လူကိုယ်တိုင် အကူအညီရယူပါ။",
    generalText:
      "ရောဂါကာကွယ်ရေးအတွက် သန့်ရှင်းသောရေသောက်ခြင်း၊ အာဟာရမျှတစွာစားခြင်း၊ လုံလောက်စွာအိပ်စက်ခြင်းနှင့် လိုအပ်သည့် ကာကွယ်ဆေးများ ထိုးနှံခြင်းတို့က အထောက်အကူပြုနိုင်ပါတယ်။",
    symptomPrompt:
      "လက်ရှိအဆင်မပြေမှုကို အောက်ပါအမျိုးအစားမှ ရွေးပါ။ အမည်၊ ဖုန်းနံပါတ် သို့မဟုတ် အခြားကိုယ်ရေးအချက်အလက်များ မပို့ပါနှင့်။",
    symptomPain: "နာကျင်မှု",
    symptomFever: "ဖျားနာခြင်း",
    symptomBreathing: "အသက်ရှူမဝခြင်း",
    symptomOther: "အခြားလက္ခဏာ",
    symptomAdvice:
      "ဒီ bot က ရောဂါအတည်ပြုမပေးနိုင်ပါ။ လက္ခဏာများ ဆက်လက်ဖြစ်ပွားခြင်း၊ ပိုဆိုးလာခြင်း သို့မဟုတ် စိုးရိမ်စရာဖြစ်ခြင်းရှိပါက ကျန်းမာရေးဝန်ထမ်းထံ ဆက်သွယ်ပါ။",
    referralText:
      "ဆေးရုံ၊ ဆေးခန်း သို့မဟုတ် အထူးကုကို ရှာဖွေရန် သင့်ဒေသရှိ ယုံကြည်စိတ်ချရသော ကျန်းမာရေးဝန်ဆောင်မှုများကို ဆက်သွယ်ပါ။ လက်ရှိတွင် ဤ bot ၌ အတည်ပြုထားသော ဆေးရုံစာရင်း မချိတ်ဆက်ရသေးပါ။",
    contactText:
      "7887 သို့ ဆက်သွယ်ရန် စမ်းသပ်နိုင်ပါသည်။ ခေါ်ဆိုမှုရရှိနိုင်မှုနှင့် ကုန်ကျစရိတ်ကို သင့်ဖုန်းလိုင်းဝန်ဆောင်မှုပေးသူထံ အတည်ပြုပါ။ ဤ bot မှ ခေါ်ဆိုမှုကို တိုက်ရိုက်ချိတ်ဆက်ပေးခြင်း မရှိပါ။",
    privacyText:
      "• ဤ bot သည် သင့်အတွက် ဆရာဝန်အစား ရောဂါအတည်ပြုမပေးပါ။\n" +
      "• ဤဗားရှင်းသည် သင်ပို့သော စကားဝိုင်းကို database ထဲသို့ ရည်ရွယ်ချက်ရှိရှိ မသိမ်းဆည်းပါ။\n" +
      "• စကားဝိုင်းအခြေအနေကို bot အလုပ်လုပ်နေစဉ် memory ထဲတွင် ယာယီသိမ်းနိုင်ပြီး server restart လုပ်ပါက ပျောက်သွားနိုင်သည်။\n" +
      "• ကိုယ်ရေးအချက်အလက်၊ OTP၊ password သို့မဟုတ် ဆေးမှတ်တမ်းအပြည့်အစုံ မပို့ပါနှင့်။",
    emergencyText:
      "အရေးပေါ်အခြေအနေ ဖြစ်နိုင်ပါတယ်။ အသက်ရှူမဝခြင်း၊ ရင်ဘတ်အလွန်နာခြင်း၊ သတိလစ်ခြင်း၊ သွေးထွက်မရပ်ခြင်း သို့မဟုတ် လေဖြတ်ခြင်းလက္ခဏာများ ရှိပါက bot ကို မစောင့်ဘဲ နီးစပ်ရာ အရေးပေါ်ကျန်းမာရေးဝန်ဆောင်မှုထံ ချက်ချင်းသွားပါ။",
    unknown:
      "နားမလည်ပါ။ အောက်ပါမီနူးမှ ရွေးချယ်ပါ သို့မဟုတ် /start ကို ပို့ပါ။",
    cancelled: "လုပ်ဆောင်မှုကို ပယ်ဖျက်ပြီးပါပြီ။",
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
    back: "Back to main menu",
    healthText: "Choose a general health information topic.",
    srhr: "Sexual and reproductive health",
    mental: "Mental health",
    general: "General health",
    srhrText:
      "Sexual and reproductive health includes menstrual health, contraception, sexually transmitted infections, and consensual, safer relationships. Seek qualified advice for your individual situation.",
    mentalText:
      "If you feel stressed, consider speaking with someone you trust, resting, and contacting a mental health professional if needed. If you may harm yourself or are in immediate danger, seek in-person emergency help now.",
    generalText:
      "Clean drinking water, balanced nutrition, adequate sleep, and recommended vaccinations can support general health.",
    symptomPrompt:
      "Choose the type of symptom you are concerned about. Please do not send your name, phone number, or other identifying information.",
    symptomPain: "Pain",
    symptomFever: "Fever",
    symptomBreathing: "Difficulty breathing",
    symptomOther: "Other symptom",
    symptomAdvice:
      "This bot cannot diagnose a condition. Contact a qualified health professional if symptoms persist, worsen, or concern you.",
    referralText:
      "For hospital, clinic, or specialist referrals, contact trusted health services in your area. A verified hospital directory is not connected to this version of the bot yet.",
    contactText:
      "You can try contacting 7887. Confirm availability and charges with your phone service provider. This bot does not place calls directly.",
    privacyText:
      "• This bot does not diagnose medical conditions.\n" +
      "• This version does not intentionally save your messages to a database.\n" +
      "• Conversation state may be held temporarily in memory while the bot runs and may be lost after a restart.\n" +
      "• Do not send identity details, OTPs, passwords, or full medical records.",
    emergencyText:
      "This may be an emergency. For severe difficulty breathing, severe chest pain, loss of consciousness, uncontrolled bleeding, or signs of stroke, do not wait for this bot. Seek emergency medical care immediately.",
    unknown:
      "I did not understand that. Please use the menu or send /start.",
    cancelled: "The action has been cancelled.",
  },
};

function getLanguage(chatId) {
  return sessions.get(chatId)?.lang || "my";
}

function setLanguage(chatId, lang) {
  const current = sessions.get(chatId) || {};
  sessions.set(chatId, { ...current, lang });
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

function languageKeyboard() {
  return {
    inline_keyboard: [
      [{ text: "မြန်မာဘာသာ", callback_data: "lang_my" }],
      [{ text: "English", callback_data: "lang_en" }],
    ],
  };
}

async function send(chatId, message, options = {}) {
  try {
    await bot.sendMessage(chatId, message, options);
  } catch (error) {
    console.error("Telegram sendMessage error:", error.message);
  }
}

function containsEmergencyWords(text) {
  const message = String(text || "").toLowerCase();

  const englishTerms = [
    "can't breathe",
    "cannot breathe",
    "difficulty breathing",
    "chest pain",
    "unconscious",
    "severe bleeding",
    "stroke symptoms",
  ];

  const myanmarTerms = [
    "အသက်ရှူမဝ",
    "အသက်ရှူမရ",
    "ရင်ဘတ်အရမ်းနာ",
    "သတိလစ်",
    "သွေးထွက်မရပ်",
  ];

  return [...englishTerms, ...myanmarTerms].some((term) =>
    message.includes(term)
  );
}

async function showMenu(chatId) {
  const lang = getLanguage(chatId);

  await send(chatId, TEXT[lang].menu, {
    reply_markup: mainKeyboard(lang),
  });
}

async function handleStart(chatId) {
  const lang = getLanguage(chatId);

  await send(chatId, TEXT[lang].chooseLanguage, {
    reply_markup: languageKeyboard(),
  });
}

// Commands
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
  const lang = getLanguage(msg.chat.id);
  await send(msg.chat.id, TEXT[lang].menu, {
    reply_markup: mainKeyboard(lang),
  });
});

// Inline button handling
bot.on("callback_query", async (query) => {
  const chatId = query.message?.chat?.id;
  const data = query.data;

  try {
    await bot.answerCallbackQuery(query.id);
  } catch (error) {
    console.error("Callback answer error:", error.message);
  }

  if (!chatId || !data) return;

  if (data === "lang_my" || data === "lang_en") {
    const lang = data === "lang_my" ? "my" : "en";
    setLanguage(chatId, lang);

    await send(chatId, TEXT[lang].welcome);
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
    case "symptom_other": {
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
    }

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

    default:
      await send(chatId, t.unknown, {
        reply_markup: mainKeyboard(lang),
      });
  }
});

// Free-text messages
bot.on("message", async (msg) => {
  if (!msg.chat || !msg.text) return;

  const text = msg.text.trim();

  // Commands are handled by the command listeners above.
  if (text.startsWith("/")) return;

  const chatId = msg.chat.id;
  const lang = getLanguage(chatId);

  if (containsEmergencyWords(text)) {
    await send(chatId, TEXT[lang].emergencyText, {
      reply_markup: backKeyboard(lang),
    });
    return;
  }

  await send(chatId, TEXT[lang].unknown, {
    reply_markup: mainKeyboard(lang),
  });
});

// Simple health-check endpoint for FadeHost.
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
