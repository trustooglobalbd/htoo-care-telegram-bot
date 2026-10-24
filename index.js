
const TelegramBot = require("node-telegram-bot-api");
const express = require("express");

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const PORT = process.env.PORT || 8080;

if (!TELEGRAM_BOT_TOKEN) {
  throw new Error("TELEGRAM_BOT_TOKEN is missing.");
}

const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, {
  polling: true,
});

const app = express();
app.get("/", (_req, res) => res.status(200).send("Htoo Care Bot is running."));
app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok", service: "Htoo Care Bot" });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Htoo Care web server running on port ${PORT}`);
});

// User preferences are kept in memory.
// They reset when the bot restarts.
const userLanguages = new Map();
const waitingForHealthQuestion = new Set();

const DEFAULT_LANGUAGE = "mm";

// --------------------------------------------------
// BILINGUAL TEXT
// --------------------------------------------------

const TEXT = {
  mm: {
    welcome:
      "မင်္ဂလာပါ။ Htoo Care မှ ကြိုဆိုပါတယ်။\n\n" +
      "ကျန်းမာရေးအသိပညာပေး အချက်အလက်များကို ဖတ်ရှုနိုင်ပြီး SRHR အကြောင်းအရာများကိုလည်း လေ့လာနိုင်ပါတယ်။\n\n" +
      "အောက်ပါ Menu မှ ရွေးချယ်ပါ။",

    en: "English",
    mm: "မြန်မာ",
    menu: "🏠 ပင်မ Menu",
    back: "⬅️ နောက်သို့",
    changeLanguage: "🌐 ဘာသာစကားပြောင်းရန်",
    readTopic: "📖 အကြောင်းအရာဖတ်ရန်",
    health: "🩺 ကျန်းမာရေးအချက်အလက်",
    srhr: "🌸 SRHR ကျန်းမာရေး",
    call7887: "📞 7887 သို့ခေါ်ရန်",
    overseas: "🌏 ပြည်ပရောက် မြန်မာများအတွက်",
    about: "ℹ️ Htoo Care အကြောင်း",

    chooseLanguage: "ဘာသာစကားကို ရွေးချယ်ပါ။",
    languageChanged: "ဘာသာစကားကို မြန်မာဘာသာသို့ ပြောင်းပြီးပါပြီ။",
    languageChangedEn: "Language changed to English.",

    healthPrompt:
      "သိလိုသော ကျန်းမာရေးမေးခွန်းကို ရေးပို့ပါ။\n\n" +
      "သတိပြုရန် — Bot မှရရှိသော အဖြေသည် ပညာပေးအချက်အလက်သာဖြစ်ပြီး ဆရာဝန်၏ စစ်ဆေးမှုနှင့် အကြံပြုချက်ကို အစားမထိုးနိုင်ပါ။",

    healthPromptEn:
      "Please type your general health question.\n\n" +
      "Note: Bot responses are for general education only and do not replace a clinician's assessment or advice.",

    thinking: "အချက်အလက်ကို ပြင်ဆင်နေပါတယ်။ ခဏစောင့်ပေးပါ။",
    error:
      "လက်ရှိတွင် အဖြေထုတ်ပေးရန် အခက်အခဲရှိနေပါတယ်။ ခဏအကြာတွင် ထပ်မံကြိုးစားပါ သို့မဟုတ် ကျန်းမာရေးပညာရှင်နှင့် တိုင်ပင်ပါ။",
    errorEn:
      "I couldn't prepare a response right now. Please try again later or consult a qualified healthcare professional.",

    disclaimer:
      "⚠️ ဤအချက်အလက်သည် ကျန်းမာရေးပညာပေးရန်အတွက်သာ ဖြစ်ပါတယ်။ ရောဂါရှာဖွေခြင်း သို့မဟုတ် ဆရာဝန်၏ အကြံပြုချက်ကို အစားမထိုးနိုင်ပါ။ အရေးပေါ်လက္ခဏာရှိပါက Bot ကို စောင့်မနေဘဲ အရေးပေါ်ကျန်းမာရေးဝန်ဆောင်မှုကို ချက်ချင်းဆက်သွယ်ပါ။",

    disclaimerEn:
      "⚠️ This information is for health education only. It does not provide a diagnosis or replace professional medical advice. If you have emergency symptoms, seek emergency medical care immediately.",

    srhrIntro:
      "🌸 SRHR ဆိုသည်မှာ လိင်ပိုင်းဆိုင်ရာနှင့် မျိုးဆက်ပွားကျန်းမာရေးဆိုင်ရာ အကြောင်းအရာများ ဖြစ်ပါတယ်။\n\n" +
      "သိလိုသော အမျိုးအစားကို ရွေးချယ်ပါ။",

    categoryMenstrual: "🩸 ရာသီသွေးနှင့် ရာသီစက်ဝန်း",
    categoryPregnancy: "🤰 ကိုယ်ဝန်ဆောင်နှင့် မိခင်ကျန်းမာရေး",
    categorySexual: "🌷 လိင်နှင့် မျိုးဆက်ပွားကျန်းမာရေး",
    categorySupport: "🩺 ကျန်းမာရေးအကူအညီ",

    topicPending:
      "ဤအကြောင်းအရာကို ဆေးဘက်ဆိုင်ရာ ကျွမ်းကျင်သူမှ စစ်ဆေးအတည်ပြုနေဆဲဖြစ်သောကြောင့် လက်ရှိတွင် အပြည့်အစုံ မဖော်ပြနိုင်သေးပါ။\n\n" +
      "ကျေးဇူးပြု၍ ဆရာဝန်အတည်ပြုပြီးမှ ထုတ်ပြန်မည့် အချက်အလက်များကိုသာ အသုံးပြုပါ။",

    topicPendingEn:
      "This topic is awaiting clinical review and approval, so the full content is not available yet. Only content approved by a qualified healthcare professional should be published.",

    aboutText:
      "Htoo Care သည် ကျန်းမာရေးအသိပညာပေး အချက်အလက်များကို ရရှိနိုင်ရန် ကူညီပေးသော Telegram Bot ဖြစ်ပါတယ်။\n\n" +
      "Bot မှပေးသော အချက်အလက်များသည် ဆရာဝန်၏ စစ်ဆေးမှုကို အစားမထိုးနိုင်ပါ။",

    aboutTextEn:
      "Htoo Care is a Telegram bot designed to help users access general health education information.\n\n" +
      "Information from the bot does not replace a clinician's assessment.",

    callText:
      "📞 7887 Healthcare Call Center\n\n" +
      "7887 သို့ ဖုန်းခေါ်ဆိုပြီး ကျန်းမာရေးအကူအညီ ရရှိနိုင်မှုကို စုံစမ်းနိုင်ပါတယ်။ ဖုန်းခေါ်ဆိုခနှင့် ဝန်ဆောင်မှုရရှိနိုင်မှုသည် သင့်ဖုန်းကွန်ရက်နှင့် သက်ဆိုင်ရာ ဝန်ဆောင်မှုစည်းကမ်းများအပေါ် မူတည်နိုင်ပါတယ်။",

    overseasText:
      "🌏 ပြည်ပရောက် မြန်မာနိုင်ငံသားများအတွက် ကျန်းမာရေးအကူအညီ\n\n" +
      "ဆက်သွယ်ရန် ဖုန်းနံပါတ် — 09 442 111 110\n\n" +
      "Phone၊ Viber သို့မဟုတ် Telegram မှ ဆက်သွယ်နိုင်မှုကို စုံစမ်းနိုင်ပါတယ်။ ဆက်သွယ်ရေးလမ်းကြောင်းနှင့် ဝန်ဆောင်မှုရရှိနိုင်မှုကို မဆက်သွယ်မီ အတည်ပြုပါ။\n\n" +
      "ဤနံပါတ်သည် အရေးပေါ်ဝန်ဆောင်မှုနံပါတ်ဟု မယူဆပါနှင့်။ အရေးပေါ်အခြေအနေတွင် သင်နေထိုင်ရာဒေသ၏ အရေးပေါ်ကျန်းမာရေးဝန်ဆောင်မှုကို ဆက်သွယ်ပါ။",
  },

  en: {
    welcome:
      "Welcome to Htoo Care.\n\n" +
      "Explore general health education information and sexual and reproductive health topics.\n\n" +
      "Please choose an option below.",

    en: "English",
    mm: "မြန်မာ",
    menu: "🏠 Main Menu",
    back: "⬅️ Back",
    changeLanguage: "🌐 Change Language",
    readTopic: "📖 Read Topic",
    health: "🩺 Health Information",
    srhr: "🌸 SRHR Topics",
    call7887: "📞 Call 7887",
    overseas: "🌏 Health Support for Myanmar Nationals Abroad",
    about: "ℹ️ About Htoo Care",

    chooseLanguage: "Please choose your language.",
    languageChanged: "Language changed to English.",
    languageChangedEn: "Language changed to English.",

    healthPrompt:
      "Please type your general health question.\n\n" +
      "Note: Bot responses are for general education only and do not replace a clinician's assessment or advice.",

    healthPromptEn:
      "Please type your general health question.\n\n" +
      "Note: Bot responses are for general education only and do not replace a clinician's assessment or advice.",

    thinking: "Preparing health information. Please wait.",
    error:
      "I couldn't prepare a response right now. Please try again later or consult a qualified healthcare professional.",
    errorEn:
      "I couldn't prepare a response right now. Please try again later or consult a qualified healthcare professional.",

    disclaimer:
      "⚠️ This information is for health education only. It does not provide a diagnosis or replace professional medical advice. If you have emergency symptoms, seek emergency medical care immediately.",

    disclaimerEn:
      "⚠️ This information is for health education only. It does not provide a diagnosis or replace professional medical advice. If you have emergency symptoms, seek emergency medical care immediately.",

    srhrIntro:
      "🌸 Sexual and reproductive health information.\n\nPlease choose a category.",

    categoryMenstrual: "🩸 Menstrual Health",
    categoryPregnancy: "🤰 Pregnancy and Maternal Health",
    categorySexual: "🌷 Sexual and Reproductive Health",
    categorySupport: "🩺 Health Support",

    topicPending:
      "This topic is awaiting clinical review and approval, so the full content is not available yet. Only content approved by a qualified healthcare professional should be published.",

    topicPendingEn:
      "This topic is awaiting clinical review and approval, so the full content is not available yet. Only content approved by a qualified healthcare professional should be published.",

    aboutText:
      "Htoo Care is a Telegram bot designed to help users access general health education information.\n\n" +
      "Information from the bot does not replace a clinician's assessment.",

    aboutTextEn:
      "Htoo Care is a Telegram bot designed to help users access general health education information.\n\n" +
      "Information from the bot does not replace a clinician's assessment.",

    callText:
      "📞 7887 Healthcare Call Center\n\n" +
      "You may call 7887 to ask about access to healthcare support. Call charges and availability may depend on your mobile network and the applicable service terms.",

    overseasText:
      "🌏 Health support for Myanmar nationals abroad\n\n" +
      "Contact number: 09 442 111 110\n\n" +
      "Please verify the availability of Phone, Viber, or Telegram support before contacting this number.\n\n" +
      "This number should not be treated as an emergency hotline. In an emergency, contact the emergency health services where you live.",
  },
};

// --------------------------------------------------
// SRHR CONTENT
// All topics remain unapproved until reviewed.
// Change approved to true ONLY after qualified review.
// --------------------------------------------------

const SRHR_TOPICS = [
  {
    id: "menstrual_cycle",
    category: "menstrual",
    title_mm: "ရာသီစက်ဝန်းကို နားလည်ခြင်း",
    title_en: "Understanding the Menstrual Cycle",
    content_mm:
      "ရာသီစက်ဝန်းသည် ရာသီသွေးစဆင်းသည့်နေ့မှ နောက်တစ်ကြိမ် ရာသီသွေးစဆင်းသည့်နေ့အထိ တွက်ချက်သော စက်ဝန်းဖြစ်ပါတယ်။ လူတစ်ဦးနှင့်တစ်ဦး စက်ဝန်းကြာချိန်နှင့် လက္ခဏာများ ကွာခြားနိုင်ပါတယ်။\n\n" +
      "ရာသီသွေးအလွန်များခြင်း၊ နေ့စဉ်လုပ်ငန်းများ မလုပ်နိုင်လောက်အောင် နာကျင်ခြင်း သို့မဟုတ် ပုံမှန်အခြေအနေမှ သိသိသာသာ ပြောင်းလဲခြင်းရှိပါက ကျန်းမာရေးပညာရှင်နှင့် တိုင်ပင်ပါ။",
    content_en:
      "The menstrual cycle is counted from the first day of one period to the first day of the next. Cycle length and symptoms can vary from person to person.\n\n" +
      "Consult a healthcare professional if bleeding is very heavy, pain disrupts daily activities, or your usual pattern changes significantly.",
    source_url: "https://www.who.int/news-room/fact-sheets/detail/menstrual-health",
    approved: false,
    reviewed_by: "",
    reviewed_date: "",
  },
  {
    id: "menstrual_hygiene",
    category: "menstrual",
    title_mm: "ရာသီလာချိန် သန့်ရှင်းရေး",
    title_en: "Menstrual Hygiene",
    content_mm:
      "ရာသီလာချိန်တွင် မိမိအတွက် သင့်တော်ပြီး သန့်ရှင်းသော ရာသီသုံးပစ္စည်းကို အသုံးပြုပါ။ အသုံးပြုသည့်ပစ္စည်း၏ ညွှန်ကြားချက်အတိုင်း လဲလှယ်၊ ဆေးကြော သို့မဟုတ် စွန့်ပစ်ပါ။ လက်ကို ဆပ်ပြာနှင့် ရေဖြင့် ဆေးကြောပါ။\n\n" +
      "ယားယံခြင်း၊ အနံ့မမှန်ခြင်း၊ နာကျင်ခြင်း သို့မဟုတ် အခြားစိုးရိမ်ရသော လက္ခဏာများရှိပါက ကျန်းမာရေးပညာရှင်နှင့် တိုင်ပင်ပါ။",
    content_en:
      "Use clean menstrual products that suit your needs. Change, wash, or dispose of them according to the product instructions, and wash your hands with soap and water.\n\n" +
      "Seek professional advice if you experience itching, unusual odour, pain, or other concerning symptoms.",
    source_url: "https://www.unicef.org/wash/menstrual-hygiene",
    approved: false,
    reviewed_by: "",
    reviewed_date: "",
  },
  {
    id: "antenatal_care",
    category: "pregnancy",
    title_mm: "ကိုယ်ဝန်ဆောင်စောင့်ရှောက်မှု",
    title_en: "Antenatal Care",
    content_mm:
      "ကိုယ်ဝန်ရှိကြောင်း သိရှိပါက ကျန်းမာရေးဝန်ထမ်းနှင့် စောစီးစွာ ဆက်သွယ်ပြီး ကိုယ်ဝန်ဆောင်စစ်ဆေးမှုများ စတင်ပါ။ စစ်ဆေးမှုများတွင် မိခင်နှင့် ကလေး၏ ကျန်းမာရေးကို စောင့်ကြည့်ခြင်း၊ လိုအပ်သော စမ်းသပ်မှုများနှင့် ကျန်းမာရေးအကြံပြုချက်များ ပါဝင်နိုင်ပါတယ်။\n\n" +
      "မိမိအတွက် သင့်တော်သော စစ်ဆေးမှုအစီအစဉ်ကို ကျန်းမာရေးပညာရှင်နှင့် တိုင်ပင်ပါ။",
    content_en:
      "If you think you are pregnant, contact a healthcare professional early to begin antenatal care. Visits may include monitoring the health of the pregnant person and baby, recommended tests, and health advice.\n\n" +
      "Discuss an appropriate schedule with your healthcare professional.",
    source_url: "https://www.who.int/tools/your-life-your-health/life-phase/pregnancy--birth-and-after-childbirth/getting-the-health-services-you-need-during-pregnancy",
    approved: false,
    reviewed_by: "",
    reviewed_date: "",
  },
  {
    id: "pregnancy_warning_signs",
    category: "pregnancy",
    title_mm: "ကိုယ်ဝန်ဆောင်စဉ် အရေးပေါ်လက္ခဏာများ",
    title_en: "Pregnancy Warning Signs",
    content_mm:
      "ကိုယ်ဝန်ဆောင်စဉ် သွေးဆင်းခြင်း၊ ပြင်းထန်သော ဝမ်းဗိုက်နာကျင်ခြင်း၊ ပြင်းထန်သော ခေါင်းကိုက်ခြင်း၊ အမြင်ဝေဝါးခြင်း၊ တက်ခြင်း သို့မဟုတ် အသက်ရှူခက်ခဲခြင်းတို့ ဖြစ်ပါက အရေးပေါ်ဆေးကုသမှုကို ချက်ချင်း ရယူပါ။\n\n" +
      "Bot မှ အဖြေကို စောင့်မနေပါနှင့်။",
    content_en:
      "During pregnancy, vaginal bleeding, severe abdominal pain, a severe headache, blurred vision, seizures, or difficulty breathing may require urgent medical attention.\n\n" +
      "Seek emergency medical care immediately. Do not wait for a bot response.",
    source_url: "https://www.who.int/tools/your-life-your-health/life-phase/pregnancy--birth-and-after-childbirth/getting-the-health-services-you-need-during-pregnancy",
    approved: false,
    reviewed_by: "",
    reviewed_date: "",
  },
  {
    id: "contraception",
    category: "sexual",
    title_mm: "ကိုယ်ဝန်တားနည်းများ",
    title_en: "Contraception",
    content_mm:
      "ကိုယ်ဝန်တားနည်းများတွင် ကွန်ဒုံး၊ သောက်ဆေး၊ ထိုးဆေး၊ လက်မောင်းထည့်ပစ္စည်းနှင့် သားအိမ်တွင်းထည့်ပစ္စည်းတို့ ပါဝင်နိုင်ပါတယ်။ နည်းလမ်းတစ်ခုချင်းစီ၏ အသုံးပြုပုံ၊ ထိရောက်မှုနှင့် သင့်တော်မှု ကွာခြားနိုင်ပါတယ်။\n\n" +
      "မိမိ၏ ကျန်းမာရေးအခြေအနေနှင့် ကိုက်ညီသောနည်းလမ်းကို ရွေးချယ်ရန် ကျန်းမာရေးပညာရှင်နှင့် တိုင်ပင်ပါ။ ကွန်ဒုံးသည် လိင်မှတစ်ဆင့် ကူးစက်နိုင်သော ရောဂါအချို့၏ အန္တရာယ်ကိုလည်း လျှော့ချနိုင်ပါတယ်။",
    content_en:
      "Contraceptive methods include condoms, pills, injections, implants, and intrauterine devices. Methods differ in use, effectiveness, and suitability.\n\n" +
      "Discuss your needs and health circumstances with a healthcare professional. Condoms can also reduce the risk of many sexually transmitted infections.",
    source_url: "https://www.who.int/en/news-room/fact-sheets/detail/family-planning-contraception",
    approved: false,
    reviewed_by: "",
    reviewed_date: "",
  },
  {
    id: "sti_information",
    category: "sexual",
    title_mm: "လိင်မှတစ်ဆင့် ကူးစက်နိုင်သော ရောဂါများ",
    title_en: "Sexually Transmitted Infections",
    content_mm:
      "လိင်မှတစ်ဆင့် ကူးစက်နိုင်သော ရောဂါအချို့တွင် လက္ခဏာမပြနိုင်ပါ။ ပုံမှန်မဟုတ်သော အရည်ဆင်းခြင်း၊ အနာဖြစ်ခြင်း၊ ဆီးသွားစဉ် နာကျင်ခြင်း စသည့် လက္ခဏာများရှိပါက သို့မဟုတ် ကူးစက်နိုင်ခြေရှိသည်ဟု စိုးရိမ်ပါက ကျန်းမာရေးပညာရှင်ထံမှ စစ်ဆေးမှုနှင့် အကြံပြုချက် ရယူပါ။\n\n" +
      "ကိုယ်တိုင်ဆေးသောက်ခြင်းထက် သင့်တော်သော စစ်ဆေးမှုနှင့် ကုသမှုကို ရယူပါ။",
    content_en:
      "Some sexually transmitted infections may cause no symptoms. If you notice unusual discharge, sores, pain when urinating, or think you may have been exposed, seek testing and advice from a qualified healthcare professional.\n\n" +
      "Get appropriate testing and treatment rather than self-medicating.",
    source_url: "https://www.who.int/news-room/fact-sheets/detail/sexually-transmitted-infections-%28stis%29",
    approved: false,
    reviewed_by: "",
    reviewed_date: "",
  },
  {
    id: "consent_and_safety",
    category: "sexual",
    title_mm: "သဘောတူညီမှုနှင့် ကိုယ်ပိုင်လုံခြုံရေး",
    title_en: "Consent and Personal Safety",
    content_mm:
      "မည်သည့်လိင်ပိုင်းဆိုင်ရာ ထိတွေ့မှုမဆို လွတ်လပ်စွာပေးထားသော သဘောတူညီမှု လိုအပ်ပါတယ်။ ဖိအားပေးခြင်း၊ ခြိမ်းခြောက်ခြင်း သို့မဟုတ် အတင်းအကျပ်ပြုခြင်းသည် လွတ်လပ်သော သဘောတူညီမှု မဟုတ်ပါ။ မိမိမလိုလားသောအရာကို ငြင်းဆိုနိုင်ပါတယ်။\n\n" +
      "မလုံခြုံဟု ခံစားရပါက ယုံကြည်ရသောသူ သို့မဟုတ် သက်ဆိုင်ရာ ကျန်းမာရေးနှင့် ကာကွယ်စောင့်ရှောက်ရေးဝန်ဆောင်မှုထံ အကူအညီတောင်းပါ။",
    content_en:
      "Any sexual activity requires freely given consent. Pressure, threats, or force are not freely given consent. You have the right to say no to anything you do not want.\n\n" +
      "If you feel unsafe, seek help from a trusted person or an appropriate health or safeguarding service.",
    source_url: "https://www.who.int/health-topics/sexual-health",
    approved: false,
    reviewed_by: "",
    reviewed_date: "",
  },
  {
    id: "postnatal_care",
    category: "pregnancy",
    title_mm: "မီးဖွားပြီးနောက် မိခင်ကျန်းမာရေး",
    title_en: "Postnatal Maternal Health",
    content_mm:
      "မီးဖွားပြီးနောက် မိခင်၏ ကျန်းမာရေး၊ သွေးဆင်းမှု၊ နာကျင်မှု၊ နို့တိုက်ကျွေးမှုနှင့် စိတ်ပိုင်းဆိုင်ရာ အခြေအနေများကို စောင့်ကြည့်ရန် လိုအပ်ပါတယ်။ သက်ဆိုင်ရာ ကျန်းမာရေးဝန်ထမ်းနှင့် မီးဖွားပြီးနောက် စစ်ဆေးမှုများကို ဆွေးနွေးပါ။\n\n" +
      "သွေးအလွန်များစွာဆင်းခြင်း၊ အသက်ရှူခက်ခဲခြင်း၊ ရင်ဘတ်နာခြင်း၊ ပြင်းထန်သော ခေါင်းကိုက်ခြင်း သို့မဟုတ် အဖျားမြင့်ခြင်းရှိပါက အရေးပေါ်ကုသမှု ရယူပါ။",
    content_en:
      "After childbirth, monitor maternal recovery, bleeding, pain, feeding, and emotional wellbeing. Discuss postnatal check-ups with a healthcare professional.\n\n" +
      "Seek urgent care for very heavy bleeding, difficulty breathing, chest pain, a severe headache, or a high fever.",
    source_url: "https://www.who.int/tools/your-life-your-health/life-phase/pregnancy--birth-and-after-childbirth/getting-the-health-services-you-need-after-childbirth",
    approved: false,
    reviewed_by: "",
    reviewed_date: "",
  },
];

const CATEGORY_IDS = {
  menstrual: "categoryMenstrual",
  pregnancy: "categoryPregnancy",
  sexual: "categorySexual",
  support: "categorySupport",
};

function getLanguage(chatId) {
  return userLanguages.get(chatId) || DEFAULT_LANGUAGE;
}

function t(chatId, key) {
  const lang = getLanguage(chatId);
  return TEXT[lang][key] || TEXT.mm[key] || key;
}

// --------------------------------------------------
// KEYBOARDS
// --------------------------------------------------

function mainMenuKeyboard(chatId) {
  return {
    inline_keyboard: [
      [{ text: t(chatId, "health"), callback_data: "health" }],
      [{ text: t(chatId, "srhr"), callback_data: "srhr" }],
      [{ text: t(chatId, "call7887"), callback_data: "call7887" }],
      [{ text: t(chatId, "overseas"), callback_data: "overseas" }],
      [{ text: t(chatId, "about"), callback_data: "about" }],
      [{ text: t(chatId, "changeLanguage"), callback_data: "language" }],
    ],
  };
}

function backKeyboard(chatId) {
  return {
    inline_keyboard: [
      [{ text: t(chatId, "menu"), callback_data: "menu" }],
      [{ text: t(chatId, "changeLanguage"), callback_data: "language" }],
    ],
  };
}

function languageKeyboard() {
  return {
    inline_keyboard: [
      [{ text: "မြန်မာ", callback_data: "lang_mm" }],
      [{ text: "English", callback_data: "lang_en" }],
      [{ text: "⬅️ Back / နောက်သို့", callback_data: "menu" }],
    ],
  };
}

function srhrKeyboard(chatId) {
  return {
    inline_keyboard: [
      [{ text: t(chatId, "categoryMenstrual"), callback_data: "cat_menstrual" }],
      [{ text: t(chatId, "categoryPregnancy"), callback_data: "cat_pregnancy" }],
      [{ text: t(chatId, "categorySexual"), callback_data: "cat_sexual" }],
      [{ text: t(chatId, "categorySupport"), callback_data: "cat_support" }],
      [{ text: t(chatId, "menu"), callback_data: "menu" }],
      [{ text: t(chatId, "changeLanguage"), callback_data: "language" }],
    ],
  };
}

function topicKeyboard(chatId, category) {
  const lang = getLanguage(chatId);

  const topics = SRHR_TOPICS.filter((topic) => {
    if (category === "support") return false;
    return topic.category === category;
  });

  const rows = topics.map((topic) => [{
    text: lang === "en" ? topic.title_en : topic.title_mm,
    callback_data: `topic_${topic.id}`,
  }]);

  rows.push([{ text: t(chatId, "back"), callback_data: "srhr" }]);
  rows.push([{ text: t(chatId, "menu"), callback_data: "menu" }]);

  return { inline_keyboard: rows };
}

// --------------------------------------------------
// SRHR TOPIC DISPLAY
// --------------------------------------------------

async function showTopic(chatId, topicId) {
  const lang = getLanguage(chatId);
  const topic = SRHR_TOPICS.find((item) => item.id === topicId);

  if (!topic) {
    await bot.sendMessage(chatId, t(chatId, "topicPending"), {
      reply_markup: backKeyboard(chatId),
    });
    return;
  }

  // IMPORTANT:
  // Unapproved topics must never be shown to the public.
  if (topic.approved !== true) {
    await bot.sendMessage(
      chatId,
      `${lang === "en" ? topic.title_en : topic.title_mm}\n\n` +
        t(chatId, lang === "en" ? "topicPendingEn" : "topicPending"),
      { reply_markup: backKeyboard(chatId) }
    );
    return;
  }

  const title = lang === "en" ? topic.title_en : topic.title_mm;
  const content = lang === "en" ? topic.content_en : topic.content_mm;
  const disclaimer = t(chatId, "disclaimer");

  await bot.sendMessage(chatId, `${title}\n\n${content}\n\n${disclaimer}`, {
    reply_markup: {
      inline_keyboard: [
        [{ text: t(chatId, "readTopic"), callback_data: `topic_${topic.id}` }],
        [{ text: t(chatId, "changeLanguage"), callback_data: "language" }],
        [{ text: t(chatId, "menu"), callback_data: "menu" }],
      ],
    },
  });
}

// --------------------------------------------------
// GEMINI HEALTH INFORMATION
// --------------------------------------------------

async function getGeminiAnswer(question, lang) {
  if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);

  try {
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/interactions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": GEMINI_API_KEY,
        },
        body: JSON.stringify({
          model: "gemini-3.8-flash",
          input:
            "You are Htoo Care, a general health education assistant. " +
            "Answer in " + (lang === "en" ? "English" : "Burmese") + ". " +
            "Use cautious, clear, non-judgmental language. " +
            "Do not claim to diagnose, prescribe, or replace a clinician. " +
            "Do not invent medical facts or sources. " +
            "If the user describes emergency symptoms, advise immediate local emergency medical care. " +
            "For pregnancy, medicines, children, severe symptoms, or complex conditions, recommend a qualified healthcare professional. " +
            "Keep the answer concise and educational. " +
            "Question: " + question,
          store: false,
        }),
        signal: controller.signal,
      }
    );

    console.log("Gemini response received:", response.status);

    const data = await response.json();

    if (!response.ok) {
      console.error("Gemini API error:", JSON.stringify(data));
      throw new Error(`Gemini API returned HTTP ${response.status}`);
    }

    const output = Array.isArray(data.steps)
      ? data.steps
          .filter((step) => step.type === "model_output")
          .flatMap((step) => step.content || [])
          .filter((item) => item.type === "text" && item.text)
          .map((item) => item.text)
          .join("\n")
      : "";

    if (!output.trim()) {
      console.error("Gemini returned no text output.");
      throw new Error("Gemini response contained no text.");
    }

    return output;
  } finally {
    clearTimeout(timeout);
  }
}

// --------------------------------------------------
// TELEGRAM COMMANDS
// --------------------------------------------------

bot.onText(/^\/start$/, async (msg) => {
  const chatId = msg.chat.id;
  waitingForHealthQuestion.delete(chatId);

  await bot.sendMessage(chatId, t(chatId, "welcome"), {
    reply_markup: mainMenuKeyboard(chatId),
  });
});

bot.onText(/^\/menu$/, async (msg) => {
  const chatId = msg.chat.id;
  waitingForHealthQuestion.delete(chatId);

  await bot.sendMessage(chatId, t(chatId, "welcome"), {
    reply_markup: mainMenuKeyboard(chatId),
  });
});

bot.onText(/^\/help$/, async (msg) => {
  const chatId = msg.chat.id;
  const lang = getLanguage(chatId);

  const helpText =
    lang === "en"
      ? "Use /start or /menu to open the main menu. Select Health Information to ask a general question, or SRHR Topics to browse health education topics."
      : "/start သို့မဟုတ် /menu ကို အသုံးပြုပြီး ပင်မ Menu ကို ဖွင့်နိုင်ပါတယ်။ Health Information မှတစ်ဆင့် အထွေထွေကျန်းမာရေးမေးခွန်း မေးနိုင်ပြီး SRHR မှတစ်ဆင့် အကြောင်းအရာများကို ရွေးချယ်ဖတ်ရှုနိုင်ပါတယ်။";

  await bot.sendMessage(chatId, helpText, {
    reply_markup: backKeyboard(chatId),
  });
});

bot.onText(/^\/ask(?:\s+([\s\S]+))?$/, async (msg, match) => {
  const chatId = msg.chat.id;
  const question = (match && match[1] ? match[1] : "").trim();

  if (!question) {
    waitingForHealthQuestion.add(chatId);
    await bot.sendMessage(chatId, t(chatId, "healthPrompt"), {
      reply_markup: backKeyboard(chatId),
    });
    return;
  }

  await answerHealthQuestion(chatId, question);
});

// --------------------------------------------------
// CALLBACK BUTTONS
// --------------------------------------------------

bot.on("callback_query", async (query) => {
  const chatId = query.message?.chat?.id;
  const data = query.data;

  if (!chatId || !data) {
    await bot.answerCallbackQuery(query.id).catch(() => {});
    return;
  }

  await bot.answerCallbackQuery(query.id).catch(() => {});

  try {
    if (data === "menu") {
      waitingForHealthQuestion.delete(chatId);
      await bot.sendMessage(chatId, t(chatId, "welcome"), {
        reply_markup: mainMenuKeyboard(chatId),
      });
      return;
    }

    if (data === "language") {
      await bot.sendMessage(chatId, t(chatId, "chooseLanguage"), {
        reply_markup: languageKeyboard(),
      });
      return;
    }

    if (data === "lang_mm" || data === "lang_en") {
      const lang = data === "lang_en" ? "en" : "mm";
      userLanguages.set(chatId, lang);

      await bot.sendMessage(
        chatId,
        lang === "en"
          ? TEXT.en.languageChanged
          : TEXT.mm.languageChanged,
        { reply_markup: mainMenuKeyboard(chatId) }
      );
      return;
    }

    if (data === "health") {
      waitingForHealthQuestion.add(chatId);
      await bot.sendMessage(chatId, t(chatId, "healthPrompt"), {
        reply_markup: backKeyboard(chatId),
      });
      return;
    }

    if (data === "srhr") {
      waitingForHealthQuestion.delete(chatId);
      await bot.sendMessage(chatId, t(chatId, "srhrIntro"), {
        reply_markup: srhrKeyboard(chatId),
      });
      return;
    }

    if (data.startsWith("cat_")) {
      const category = data.replace("cat_", "");

      if (category === "support") {
        const supportText =
          getLanguage(chatId) === "en"
            ? "For personal health concerns, consult a qualified healthcare professional. For emergencies, contact local emergency medical services immediately."
            : "မိမိ၏ ကျန်းမာရေးအခြေအနေအတွက် အရည်အချင်းပြည့်မီသော ကျန်းမာရေးပညာရှင်နှင့် တိုင်ပင်ပါ။ အရေးပေါ်အခြေအနေတွင် သက်ဆိုင်ရာဒေသ၏ အရေးပေါ်ကျန်းမာရေးဝန်ဆောင်မှုကို ချက်ချင်းဆက်သွယ်ပါ။";

        await bot.sendMessage(chatId, supportText, {
          reply_markup: backKeyboard(chatId),
        });
        return;
      }

      const categoryKey = CATEGORY_IDS[category];
      const categoryTitle = categoryKey
        ? t(chatId, categoryKey)
        : t(chatId, "srhr");

      await bot.sendMessage(chatId, categoryTitle, {
        reply_markup: topicKeyboard(chatId, category),
      });
      return;
    }

    if (data.startsWith("topic_")) {
      const topicId = data.substring("topic_".length);
      await showTopic(chatId, topicId);
      return;
    }

    if (data === "call7887") {
      await bot.sendMessage(chatId, t(chatId, "callText"), {
        reply_markup: backKeyboard(chatId),
      });
      return;
    }

    if (data === "overseas") {
      await bot.sendMessage(chatId, t(chatId, "overseasText"), {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "📱 Call",
                url: "tel:+959442111110",
              },
            ],
            [
              {
                text: "💬 Viber",
                url: "viber://chat?number=%2B959442111110",
              },
            ],
            [{ text: t(chatId, "menu"), callback_data: "menu" }],
          ],
        },
      });
      return;
    }

    if (data === "about") {
      const lang = getLanguage(chatId);
      await bot.sendMessage(
        chatId,
        lang === "en" ? TEXT.en.aboutTextEn : TEXT.mm.aboutText,
        { reply_markup: backKeyboard(chatId) }
      );
      return;
    }
  } catch (error) {
    console.error("Callback handling error:", error.message);
    await bot.sendMessage(chatId, t(chatId, "error")).catch(() => {});
  }
});

// --------------------------------------------------
// ANSWER HEALTH QUESTIONS
// --------------------------------------------------

async function answerHealthQuestion(chatId, question) {
  const lang = getLanguage(chatId);

  // Basic emergency warning. This is not a complete triage system.
  const emergencyTerms = [
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
    "တက်",
    "သွေးအလွန်များ",
  ];

  const normalizedQuestion = question.toLowerCase();
  const possibleEmergency = emergencyTerms.some((term) =>
    normalizedQuestion.includes(term.toLowerCase())
  );

  if (possibleEmergency) {
    const emergencyText =
      lang === "en"
        ? "⚠️ Your message may describe an emergency. Please contact local emergency medical services or go to the nearest emergency department immediately. Do not wait for a bot response."
        : "⚠️ သင့်မေးခွန်းတွင် အရေးပေါ်လက္ခဏာ ပါဝင်နိုင်ပါတယ်။ Bot ၏အဖြေကို မစောင့်ဘဲ သက်ဆိုင်ရာဒေသ၏ အရေးပေါ်ကျန်းမာရေးဝန်ဆောင်မှုကို ချက်ချင်းဆက်သွယ်ပါ သို့မဟုတ် အနီးဆုံး အရေးပေါ်ကုသရေးဌာနသို့ သွားပါ။";

    await bot.sendMessage(chatId, emergencyText, {
      reply_markup: backKeyboard(chatId),
    });
    return;
  }

  await bot.sendMessage(chatId, t(chatId, "thinking"));

  try {
    console.log("Gemini request started.");
    const answer = await getGeminiAnswer(question, lang);

    await bot.sendMessage(
      chatId,
      `${answer}\n\n${t(chatId, "disclaimer")}`,
      { reply_markup: backKeyboard(chatId) }
    );
  } catch (error) {
    console.error("Health answer error:", error.message);
    await bot.sendMessage(chatId, t(chatId, "error"), {
      reply_markup: backKeyboard(chatId),
    });
  }
}

// --------------------------------------------------
// HANDLE NORMAL TEXT MESSAGES
// --------------------------------------------------

bot.on("message", async (msg) => {
  if (!msg.text || msg.text.startsWith("/")) return;

  const chatId = msg.chat.id;

  if (!waitingForHealthQuestion.has(chatId)) {
    return;
  }

  waitingForHealthQuestion.delete(chatId);
  await answerHealthQuestion(chatId, msg.text.trim());
});

// --------------------------------------------------
// ERROR HANDLING
// --------------------------------------------------

bot.on("polling_error", (error) => {
  console.error("Telegram polling error:", error.message);
});

process.on("unhandledRejection", (error) => {
  console.error("Unhandled rejection:", error);
});

process.on("uncaughtException", (error) => {
  console.error("Uncaught exception:", error);
});

async function shutdown(signal) {
  console.log(`${signal} received. Shutting down Htoo Care Bot.`);
  try {
    await bot.stopPolling();
  } catch (error) {
    console.error("Error stopping Telegram polling:", error.message);
  }
  process.exit(0);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
