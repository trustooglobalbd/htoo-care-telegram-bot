const express = require("express");
const TelegramBot = require("node-telegram-bot-api");

const app = express();
app.use(express.json());

// FadeHost environment variables: TELEGRAM_BOT_TOKEN, PORT, DATABASE_URL,
// DATA_HASH_SECRET, DATABASE_SSL (optional), and ADMIN_TELEGRAM_ID (optional).
const TOKEN = process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN;
if (!TOKEN) {
  throw new Error("Missing TELEGRAM_BOT_TOKEN environment variable.");
}

const bot = new TelegramBot(TOKEN, { polling: false });

// PostgreSQL analytics are optional at runtime, but required for persistent reports.
let pool = null;
let analyticsReady = false;
const crypto = require("crypto");
if (process.env.DATABASE_URL) {
  if (!process.env.DATA_HASH_SECRET || process.env.DATA_HASH_SECRET.length < 32) {
    throw new Error("Set DATA_HASH_SECRET to a random secret of at least 32 characters.");
  }
  const { Pool } = require("pg");
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined,
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000
  });
}

const languages = new Map();
const sessions = new Map();
// Profile data stays in memory only; it is not saved to a database.
const profiles = new Map();

const categories = [
  {
    icon: "🧠",
    my: "ခေါင်းကိုက်ခြင်းနှင့် အာရုံကြောဆိုင်ရာ",
    en: "Headache & Neurological Health",
    basicMy: "ခေါင်းကိုက်ခြင်းနှင့် မူးဝေခြင်းသည် အကြောင်းရင်းများစွာကြောင့် ဖြစ်နိုင်ပါတယ်။ အိပ်ရေးဝဝအိပ်ပါ၊ ရေဓာတ်လုံလောက်အောင် ဖြည့်တင်းပါ။ လက္ခဏာဖြစ်ပွားချိန်နှင့် တွဲဖက်လက္ခဏာများကို မှတ်သားထားပါ။",
    basicEn: "Headaches and dizziness can have many causes. Get enough sleep, stay hydrated, and note when symptoms occur and what other symptoms accompany them.",
    preventMy: "ပုံမှန်အိပ်ချိန်ထားပါ၊ ရေသောက်ပါ၊ အစာပုံမှန်စားပါ။ ခေါင်းကိုက်စေသော အကြောင်းရင်းများကို သတိထားမှတ်သားပါ။",
    preventEn: "Maintain a regular sleep schedule, drink enough water, eat regularly, and note possible headache triggers.",
    warningMy: "ရုတ်တရက် အလွန်ပြင်းထန်သော ခေါင်းကိုက်ခြင်း၊ ကိုယ်တစ်ဖက်အားနည်းခြင်း၊ စကားပြောခက်ခြင်း သို့မဟုတ် သတိလစ်ခြင်းသည် အရေးပေါ်လက္ခဏာ ဖြစ်နိုင်ပါတယ်။",
    warningEn: "A sudden, extremely severe headache, one-sided weakness, difficulty speaking, or loss of consciousness may be an emergency.",
    doctorMy: "ခေါင်းကိုက်တာ မကြာခဏဖြစ်ခြင်း၊ ပိုဆိုးလာခြင်း၊ နေ့စဉ်ဘဝကို ထိခိုက်ခြင်း သို့မဟုတ် အခြားလက္ခဏာများ တွဲဖြစ်ခြင်းရှိပါက ဆရာဝန်နှင့် တိုင်ပင်ပါ။",
    doctorEn: "Consult a clinician if headaches recur, worsen, affect daily activities, or occur with other symptoms."
  },
  {
    icon: "🤧",
    my: "အဖျား၊ အအေးမိနှင့် အသက်ရှူလမ်းကြောင်း",
    en: "Fever, Cold & Respiratory Health",
    basicMy: "အဖျား၊ ချောင်းဆိုး၊ လည်ချောင်းနာနှင့် နှာစေးခြင်းတို့သည် ကူးစက်ရောဂါများကြောင့် ဖြစ်နိုင်ပါတယ်။ အနားယူပါ၊ ရေလုံလောက်စွာသောက်ပါ။",
    basicEn: "Fever, cough, sore throat, and a runny nose can occur with infections. Rest and drink enough fluids.",
    preventMy: "လက်ကို ဆပ်ပြာဖြင့်ဆေးပါ၊ ချောင်းဆိုးနှာချေရာတွင် ပါးစပ်နှင့် နှာခေါင်းကို ဖုံးပါ၊ နေမကောင်းလျှင် အခြားသူများနှင့် နီးကပ်စွာနေခြင်းကို လျှော့ပါ။",
    preventEn: "Wash your hands, cover coughs and sneezes, and reduce close contact with others when unwell.",
    warningMy: "အသက်ရှူခက်ခြင်း၊ နှုတ်ခမ်းပြာခြင်း၊ သတိမကောင်းခြင်း သို့မဟုတ် ရင်ဘတ်ပြင်းထန်စွာနာခြင်းရှိပါက အရေးပေါ်ကုသမှု ချက်ချင်းရယူပါ။",
    warningEn: "Seek emergency care for difficulty breathing, bluish lips, altered consciousness, or severe chest pain.",
    doctorMy: "အဖျားမကျခြင်း၊ လက္ခဏာပိုဆိုးလာခြင်း၊ ရေမသောက်နိုင်ခြင်း သို့မဟုတ် စိုးရိမ်စရာလက္ခဏာများရှိပါက ဆေးဘက်ဆိုင်ရာအကြံဉာဏ် ရယူပါ။",
    doctorEn: "Seek medical advice if fever persists, symptoms worsen, you cannot drink fluids, or you are concerned."
  },
  {
    icon: "🍽️",
    my: "အစာအိမ်နှင့် အူလမ်းကြောင်း",
    en: "Digestive Health",
    basicMy: "ဝမ်းလျှောခြင်း၊ ဝမ်းချုပ်ခြင်း၊ ဗိုက်နာခြင်းနှင့် အစာမကြေခြင်းတို့တွင် အကြောင်းရင်းအမျိုးမျိုး ရှိနိုင်ပါတယ်။ အစားအစာသန့်ရှင်းမှုကို ဂရုပြုပါ။",
    basicEn: "Diarrhoea, constipation, abdominal pain, and indigestion can have different causes. Pay attention to food and water hygiene.",
    preventMy: "သန့်ရှင်းသောရေသောက်ပါ၊ အစားအစာကို သေချာချက်ပြုတ်ပါ၊ လက်ကို ဆပ်ပြာဖြင့်ဆေးပါ။ ဝမ်းလျှောပါက ORS ကို အထုပ်ပေါ်ရှိ ညွှန်ကြားချက်အတိုင်း ဖျော်သောက်နိုင်ပါတယ်။",
    preventEn: "Drink safe water, cook food thoroughly, and wash your hands. For diarrhoea, use ORS mixed exactly according to the packet instructions.",
    warningMy: "ဝမ်းထဲသွေးပါခြင်း၊ ဗိုက်အလွန်ပြင်းထန်စွာနာခြင်း၊ မူးဝေပြီး လဲချင်ခြင်း သို့မဟုတ် ရေဓာတ်ခန်းခြောက်ခြင်းရှိပါက ဆေးကုသမှု ရယူပါ။",
    warningEn: "Seek medical care for bloody stools, severe abdominal pain, faintness, or signs of dehydration.",
    doctorMy: "ဝမ်းလျှောခြင်း သို့မဟုတ် အန်ခြင်း မသက်သာခြင်း၊ အစာရေ မဝင်နိုင်ခြင်း သို့မဟုတ် လက္ခဏာများ ပိုဆိုးလာခြင်းရှိပါက ဆရာဝန်နှင့် တိုင်ပင်ပါ။",
    doctorEn: "Consult a clinician if diarrhoea or vomiting persists, you cannot keep fluids down, or symptoms worsen."
  },
  {
    icon: "❤️",
    my: "နာတာရှည်ရောဂါများ",
    en: "Chronic Conditions",
    basicMy: "သွေးတိုးနှင့် ဆီးချိုကဲ့သို့သော ရောဂါများသည် အစောပိုင်းတွင် လက္ခဏာမပြနိုင်ပါ။ သင့်တော်သည့်အချိန်တွင် ကျန်းမာရေးစစ်ဆေးမှုခံယူပါ။",
    basicEn: "Conditions such as high blood pressure and diabetes may have no obvious early symptoms. Get appropriate health checks.",
    preventMy: "မျှတစွာစားပါ၊ ကိုယ်လက်လှုပ်ရှားမှုပြုလုပ်ပါ၊ ဆေးလိပ်ရှောင်ပါ၊ သွေးပေါင်ချိန်နှင့် သွေးချိုကို လိုအပ်သလို စစ်ဆေးပါ။",
    preventEn: "Eat a balanced diet, stay physically active, avoid smoking, and check blood pressure and blood glucose when appropriate.",
    warningMy: "ရင်ဘတ်ပြင်းထန်စွာနာခြင်း၊ အသက်ရှူခက်ခြင်း၊ ရုတ်တရက် ကိုယ်တစ်ဖက်အားနည်းခြင်း သို့မဟုတ် စကားပြောခက်ခြင်းဖြစ်ပါက အရေးပေါ်ကုသမှု ခံယူပါ။",
    warningEn: "Severe chest pain, difficulty breathing, sudden one-sided weakness, or difficulty speaking requires emergency care.",
    doctorMy: "ဆရာဝန်ညွှန်ကြားချက်အတိုင်း ပုံမှန်စစ်ဆေးပါ။ သောက်နေသောဆေးကို မိမိသဘောဖြင့် မရပ်ပါနှင့်။",
    doctorEn: "Attend recommended check-ups and do not stop prescribed medication without professional advice."
  },
  {
    icon: "🤰",
    my: "မိခင်နှင့် မျိုးဆက်ပွားကျန်းမာရေး",
    en: "Maternal & Reproductive Health",
    basicMy: "ကိုယ်ဝန်ဆောင်စောင့်ရှောက်မှု၊ ရာသီစက်ဝန်း၊ သားဆက်ခြားနည်းများနှင့် လိင်ပိုင်းဆိုင်ရာကျန်းမာရေးတို့သည် အရေးကြီးပါတယ်။",
    basicEn: "Prenatal care, menstrual health, contraception, and sexual health are important parts of overall health.",
    preventMy: "ကိုယ်ဝန်ဆောင်စဉ် ပုံမှန်စစ်ဆေးမှုခံယူပါ။ သားဆက်ခြားနည်းနှင့် လိင်မှတစ်ဆင့် ကူးစက်နိုင်သောရောဂါများ ကာကွယ်ရေးအကြောင်း ကျန်းမာရေးဝန်ထမ်းနှင့် တိုင်ပင်ပါ။",
    preventEn: "Attend prenatal visits and ask a healthcare professional about contraception and prevention of sexually transmitted infections.",
    warningMy: "ကိုယ်ဝန်ဆောင်စဉ် သွေးဆင်းခြင်း၊ ပြင်းထန်သောဗိုက်နာခြင်း၊ သတိလစ်ခြင်း သို့မဟုတ် ပြင်းထန်သောခေါင်းကိုက်ခြင်းဖြစ်ပါက အရေးပေါ်စစ်ဆေးမှု ခံယူပါ။",
    warningEn: "Bleeding during pregnancy, severe abdominal pain, fainting, or a severe headache during pregnancy requires urgent medical assessment.",
    doctorMy: "ရာသီသွေးအလွန်များခြင်း၊ ပြင်းထန်သောနာကျင်မှု၊ ပုံမှန်မဟုတ်သော အရည်ဆင်းခြင်း သို့မဟုတ် ကိုယ်ဝန်နှင့်ပတ်သက်သော စိုးရိမ်မှုရှိပါက ကျန်းမာရေးဝန်ထမ်းနှင့် တိုင်ပင်ပါ။",
    doctorEn: "Consult a healthcare professional for very heavy bleeding, severe pain, unusual discharge, or pregnancy concerns."
  },
  {
    icon: "🩹",
    my: "အရေပြားနှင့် ဓာတ်မတည့်ခြင်း",
    en: "Skin & Allergies",
    basicMy: "အရေပြားယားယံခြင်းနှင့် အဖုထွက်ခြင်းသည် အကြောင်းရင်းများစွာကြောင့် ဖြစ်နိုင်ပါတယ်။ အဖုကို မကုတ်ပါနှင့်၊ အရေပြားကို သန့်ရှင်းစွာထားပါ။",
    basicEn: "Itching and rashes can have many causes. Avoid scratching and keep the skin clean.",
    preventMy: "ကိုယ်နှင့်မတည့်သောပစ္စည်းများကို ရှောင်ပါ။ ဆေးဝါးအသစ်သုံးပြီး တုံ့ပြန်မှုဖြစ်ပါက ကျန်းမာရေးဝန်ထမ်းကို အသိပေးပါ။",
    preventEn: "Avoid known triggers. Tell a healthcare professional if you develop a reaction after starting a new medicine.",
    warningMy: "နှုတ်ခမ်း၊ လျှာ သို့မဟုတ် လည်ချောင်းဖောင်းခြင်း၊ အသက်ရှူခက်ခြင်း သို့မဟုတ် မူးလဲခြင်းဖြစ်ပါက အရေးပေါ်အကူအညီ ရယူပါ။",
    warningEn: "Swelling of the lips, tongue, or throat, difficulty breathing, or fainting may indicate a severe allergic reaction. Seek emergency help.",
    doctorMy: "အဖုများ ပျံ့နှံ့လာခြင်း၊ နာကျင်ခြင်း၊ အဖျားတွဲဖြစ်ခြင်း သို့မဟုတ် မသက်သာခြင်းရှိပါက ဆရာဝန်နှင့် တိုင်ပင်ပါ။",
    doctorEn: "Consult a clinician if the rash spreads, becomes painful, occurs with fever, or does not improve."
  },
  {
    icon: "💚",
    my: "စိတ်ကျန်းမာရေး",
    en: "Mental Health",
    basicMy: "စိတ်ဖိစီးမှုနှင့် စိုးရိမ်ပူပန်မှုများသည် လူအများတွင် ဖြစ်နိုင်ပါတယ်။ ခံစားချက်များအကြောင်း ယုံကြည်ရသူနှင့် ဆွေးနွေးခြင်းက အထောက်အကူဖြစ်နိုင်ပါတယ်။",
    basicEn: "Stress and anxiety are common. Talking with someone you trust about your feelings may help.",
    preventMy: "အိပ်ချိန်ပုံမှန်ထားပါ၊ လှုပ်ရှားမှုပြုလုပ်ပါ၊ အနားယူချိန်ထားပါ။ အရက်နှင့် မူးယစ်စေသောပစ္စည်းများကို ရှောင်ပါ။",
    preventEn: "Maintain a regular sleep routine, be physically active, make time to rest, and avoid alcohol or intoxicating substances as coping tools.",
    warningMy: "မိမိကိုယ်ကို ထိခိုက်စေမည့် အန္တရာယ်ရှိပါက တစ်ယောက်တည်းမနေဘဲ ယုံကြည်ရသူနှင့် အရေးပေါ်ကျန်းမာရေးအကူအညီကို ချက်ချင်းဆက်သွယ်ပါ။",
    warningEn: "If you may harm yourself, do not stay alone. Contact someone you trust and seek urgent professional help.",
    doctorMy: "စိတ်ဖိစီးမှု၊ ဝမ်းနည်းမှု သို့မဟုတ် စိုးရိမ်ပူပန်မှုက နေ့စဉ်ဘဝကို ထိခိုက်လာပါက ကျန်းမာရေးပညာရှင်နှင့် တိုင်ပင်ပါ။",
    doctorEn: "Seek professional support if stress, low mood, or anxiety starts affecting daily life."
  },
  {
    icon: "🦴",
    my: "အရိုး၊ အဆစ်နှင့် ကြွက်သား",
    en: "Bones, Joints & Muscles",
    basicMy: "အဆစ်နှင့် ကြွက်သားနာခြင်းသည် လှုပ်ရှားမှု၊ ထိခိုက်မှု သို့မဟုတ် အခြားအကြောင်းရင်းများကြောင့် ဖြစ်နိုင်ပါတယ်။ ကိုယ်နေဟန်ထားမှန်ကန်အောင် ဂရုပြုပါ။",
    basicEn: "Joint and muscle pain may relate to activity, injury, or other causes. Pay attention to posture and safe movement.",
    preventMy: "လှုပ်ရှားမှုကို ပုံမှန်ပြုလုပ်ပါ၊ အလေးအပင်ကို မှန်ကန်စွာမပါ၊ အချိန်ကြာကြာထိုင်ပါက ခဏခဏထ၍ လှုပ်ရှားပါ။",
    preventEn: "Stay active, lift heavy objects safely, and take movement breaks when sitting for long periods.",
    warningMy: "ခါးနာခြင်းနှင့်အတူ ဆီး/ဝမ်းထိန်းချုပ်မရခြင်း၊ ခြေထောက်အားနည်းခြင်း သို့မဟုတ် ပြင်းထန်သောထိခိုက်ဒဏ်ရာရှိပါက အရေးပေါ်စစ်ဆေးမှု ခံယူပါ။",
    warningEn: "Back pain with loss of bladder or bowel control, leg weakness, or a serious injury requires urgent assessment.",
    doctorMy: "နာကျင်မှုမသက်သာခြင်း၊ အဆစ်ဖောင်းခြင်း၊ လှုပ်ရှားမရခြင်း သို့မဟုတ် နာကျင်မှု ပိုဆိုးလာခြင်းရှိပါက ဆရာဝန်နှင့် တိုင်ပင်ပါ။",
    doctorEn: "Consult a clinician if pain persists or worsens, a joint swells, or movement becomes difficult."
  },
  {
    icon: "👁️",
    my: "မျက်စိ၊ နား၊ နှာခေါင်းနှင့် သွား",
    en: "Eye, Ear, Nose & Dental Health",
    basicMy: "မျက်စိ၊ နား၊ နှာခေါင်းနှင့် သွားတို့ကို သန့်ရှင်းစွာ စောင့်ရှောက်ပါ။ သွားကို တစ်နေ့နှစ်ကြိမ် ဖလိုရိုက်ပါသော သွားတိုက်ဆေးဖြင့် တိုက်ပါ။",
    basicEn: "Maintain eye, ear, nose, and dental hygiene. Brush twice daily with fluoride toothpaste.",
    preventMy: "နားထဲသို့ ချွန်ထက်သောပစ္စည်းမထည့်ပါနှင့်။ မျက်စိကို လက်မသန့်ဘဲ မပွတ်ပါနှင့်။ သွားကို ပုံမှန်စစ်ဆေးပါ။",
    preventEn: "Do not insert sharp objects into the ears. Avoid rubbing eyes with unclean hands and arrange routine dental checks.",
    warningMy: "ရုတ်တရက် အမြင်အာရုံပျောက်ခြင်း၊ မျက်စိပြင်းထန်စွာနာခြင်း သို့မဟုတ် မျက်နှာဖောင်းပြီး အသက်ရှူခက်ခြင်းဖြစ်ပါက အရေးပေါ်ကုသမှု ရယူပါ။",
    warningEn: "Sudden vision loss, severe eye pain, or facial swelling with difficulty breathing requires urgent care.",
    doctorMy: "သွားကိုက်ခြင်း၊ နားနာခြင်း၊ အမြင်အာရုံပြောင်းလဲခြင်း သို့မဟုတ် နာကျင်မှုမသက်သာခြင်းရှိပါက သက်ဆိုင်ရာကျန်းမာရေးပညာရှင်နှင့် တိုင်ပင်ပါ။",
    doctorEn: "Consult the appropriate healthcare professional for toothache, ear pain, vision changes, or persistent pain."
  },
  {
    icon: "👶",
    my: "ကလေးကျန်းမာရေးနှင့် ကာကွယ်ဆေး",
    en: "Child Health & Vaccination",
    basicMy: "ကလေး၏ အသက်အရွယ်အလိုက် အာဟာရ၊ ကြီးထွားမှုနှင့် ကာကွယ်ဆေးထိုးအစီအစဉ်ကို စောင့်ကြည့်ပါ။",
    basicEn: "Monitor age-appropriate nutrition, growth, and vaccination schedules.",
    preventMy: "ကာကွယ်ဆေးမှတ်တမ်းကို ထိန်းသိမ်းပါ၊ လက်ဆေးခြင်းကို သင်ကြားပေးပါ၊ ကလေးအတွက် သန့်ရှင်းပြီး လုံခြုံသောပတ်ဝန်းကျင် ပံ့ပိုးပါ။",
    preventEn: "Keep vaccination records, teach handwashing, and provide a clean, safe environment.",
    warningMy: "အသက် ၃ လအောက်ကလေးတွင် အပူချိန် ၃၈°C နှင့်အထက်ရှိခြင်း၊ အသက်ရှူခက်ခြင်း၊ တက်ခြင်း သို့မဟုတ် နို့မစို့နိုင်ခြင်းရှိပါက အမြန်ဆုံး ဆေးဘက်ဆိုင်ရာအကူအညီ ရယူပါ။",
    warningEn: "A baby under 3 months with a temperature of 38°C or higher, difficulty breathing, seizures, or inability to feed needs urgent medical assessment.",
    doctorMy: "ကလေး အစာမစားနိုင်ခြင်း၊ ဆီးနည်းခြင်း၊ အလွန်ငိုက်မျဉ်းခြင်း သို့မဟုတ် ကြီးထွားမှုအပေါ် စိုးရိမ်မှုရှိပါက ကျန်းမာရေးဝန်ထမ်းနှင့် တိုင်ပင်ပါ။",
    doctorEn: "Consult a healthcare professional if a child cannot feed, urinates less, is unusually drowsy, or has growth concerns."
  },
  {
    icon: "🥗",
    my: "အာဟာရ၊ ရေဓာတ်နှင့် ကိုယ်အလေးချိန်",
    en: "Nutrition, Hydration & Weight",
    basicMy: "အာဟာရမျှတစေရန် ဟင်းသီးဟင်းရွက်၊ သစ်သီး၊ ပရိုတင်းနှင့် အခြားအာဟာရအုပ်စုများကို မျှတစွာစားပါ။",
    basicEn: "Aim for a balanced diet with vegetables, fruit, protein sources, and a variety of foods.",
    preventMy: "ရေကို ပုံမှန်သောက်ပါ၊ သကြားများသောအချိုရည်များကို လျှော့ပါ၊ အစားအစာအုပ်စုစုံကို မျှတစွာစားပါ။",
    preventEn: "Drink water regularly, limit sugary drinks, and eat a variety of foods in balanced portions.",
    warningMy: "ရေဓာတ်ခန်းခြောက်ပြီး မူးလဲခြင်း၊ သတိမကောင်းခြင်း သို့မဟုတ် အစာရေမဝင်နိုင်ခြင်းဖြစ်ပါက ဆေးကုသမှု ရယူပါ။",
    warningEn: "Seek medical care for dehydration with fainting, altered consciousness, or inability to keep fluids down.",
    doctorMy: "ကိုယ်အလေးချိန် အကြောင်းမဲ့လျင်မြန်စွာ ပြောင်းလဲခြင်း သို့မဟုတ် အစားအသောက်ကြောင့် ကျန်းမာရေးပြဿနာရှိခြင်းကို စိုးရိမ်ပါက ဆရာဝန်နှင့် တိုင်ပင်ပါ။",
    doctorEn: "Consult a clinician about rapid unexplained weight changes or health problems related to eating."
  },
  {
    icon: "🚻",
    my: "ဆီးလမ်းကြောင်းဆိုင်ရာ",
    en: "Urinary Health",
    basicMy: "ဆီးကျင်ခြင်း၊ ဆီးခဏခဏသွားခြင်းနှင့် ဆီးအရောင်ပြောင်းခြင်းတို့တွင် အကြောင်းရင်းအမျိုးမျိုး ရှိနိုင်ပါတယ်။",
    basicEn: "Painful or frequent urination and changes in urine can have several causes.",
    preventMy: "ရေသောက်ရန် သင့်တော်သောအလေ့အကျင့်ထားပါ။ ဆီးသွားချင်စိတ်ကို အချိန်ကြာကြာ မအောင့်ထားပါနှင့်။",
    preventEn: "Maintain appropriate hydration and avoid routinely holding urine for long periods.",
    warningMy: "အဖျားနှင့် ချမ်းတုန်ခြင်း၊ ခါးဘေးနာခြင်း၊ အန်ခြင်း၊ ဆီးထဲသွေးပါခြင်း သို့မဟုတ် ဆီးလုံးဝမသွားနိုင်ခြင်းရှိပါက အမြန်စစ်ဆေးမှုခံယူပါ။",
    warningEn: "Seek prompt care for fever with chills, flank pain, vomiting, blood in urine, or inability to urinate.",
    doctorMy: "ဆီးကျင်ခြင်း၊ ဆီးခဏခဏသွားခြင်း သို့မဟုတ် လက္ခဏာပြန်ဖြစ်ခြင်းရှိပါက ဆေးဘက်ဆိုင်ရာအကြံဉာဏ် ရယူပါ။",
    doctorEn: "Seek medical advice for painful or frequent urination or recurring symptoms."
  },
  {
    icon: "🚑",
    my: "ထိခိုက်ဒဏ်ရာနှင့် အရေးပေါ်အခြေအနေ",
    en: "Injuries & Emergencies",
    basicMy: "အရေးပေါ်အခြေအနေတွင် မိမိနှင့် အခြားသူများ၏ လုံခြုံရေးကို ဦးစားပေးပါ။ ဒေသဆိုင်ရာ အရေးပေါ်အကူအညီကို မည်သို့ခေါ်ရမည်ကို ကြိုသိထားပါ။",
    basicEn: "In an emergency, prioritise everyone's safety and know how to contact local emergency services.",
    preventMy: "ဆေးဝါးနှင့် ဓာတုပစ္စည်းများကို ကလေးလက်မလှမ်းမီနေရာတွင်ထားပါ။ လုံခြုံရေးပစ္စည်းများကို အသုံးပြုပါ။",
    preventEn: "Keep medicines and chemicals away from children and use appropriate safety equipment.",
    warningMy: "အသက်ရှူမဝခြင်း၊ သတိလစ်ခြင်း၊ သွေးထွက်မတိတ်ခြင်း၊ ပြင်းထန်သောမီးလောင်ဒဏ်ရာ သို့မဟုတ် ရင်ဘတ်ပြင်းထန်စွာနာခြင်းရှိပါက အရေးပေါ်အကူအညီ ချက်ချင်းခေါ်ပါ။",
    warningEn: "Call emergency services for difficulty breathing, unconsciousness, uncontrolled bleeding, serious burns, or severe chest pain.",
    doctorMy: "ပြင်းထန်သောထိခိုက်ဒဏ်ရာ၊ ဦးခေါင်းထိခိုက်မှု၊ အရိုးကျိုးနိုင်သည့်လက္ခဏာ သို့မဟုတ် အဆိပ်မိနိုင်မှုရှိပါက ဆေးကုသမှု ရယူပါ။",
    doctorEn: "Seek medical care for serious injuries, head injuries, suspected fractures, or possible poisoning."
  },
  {
    icon: "🌦️",
    my: "El Niño၊ အပူချိန်နှင့် ရာသီဥတုဆိုင်ရာ ကျန်းမာရေး",
    en: "El Niño, Heat & Climate-Related Health",
    basicMy: "El Niño နှင့် အပူလှိုင်းများကြောင့် အပူဒဏ်၊ ရေရှားပါးမှုနှင့် သန့်ရှင်းသောရေ ရရှိရေးအခက်အခဲများ ဖြစ်နိုင်ပါတယ်။ ကလေးငယ်များ၊ သက်ကြီးရွယ်အိုများနှင့် နာတာရှည်ရောဂါရှိသူများ ပိုမိုထိခိုက်နိုင်ပါတယ်။",
    basicEn: "El Niño and heatwaves can increase heat illness, water shortages, and challenges accessing safe water. Children, older adults, and people with chronic conditions may be more vulnerable.",
    preventMy: "ရေသန့်လုံလောက်စွာသောက်ပါ၊ အပူပြင်းချိန်တွင် အပြင်ထွက်မှုလျှော့ပါ၊ အရိပ်ရသောနေရာတွင် နားပါ၊ ရေသန့်နှင့် အစားအစာကို လုံခြုံစွာသိမ်းဆည်းပါ။",
    preventEn: "Drink safe water, reduce outdoor activity during the hottest hours, rest in shade, and store drinking water and food safely.",
    warningMy: "အပူဒဏ်ကြောင့် စိတ်ရှုပ်ထွေးခြင်း၊ သတိလစ်ခြင်း၊ တက်ခြင်း သို့မဟုတ် အလွန်ပူနေပြီး နေမကောင်းဖြစ်ခြင်းရှိပါက အရေးပေါ်ဆေးကုသမှု ချက်ချင်းရယူပါ။",
    warningEn: "Confusion, fainting, seizures, or becoming very hot and severely unwell may indicate heatstroke. Seek emergency medical care immediately.",
    doctorMy: "မူးဝေခြင်း၊ အားနည်းခြင်း၊ ဆီးနည်းခြင်း သို့မဟုတ် အပူဒဏ်လက္ခဏာများ အနားယူပြီး ရေသောက်သော်လည်း မသက်သာပါက ကျန်းမာရေးဝန်ထမ်းနှင့် တိုင်ပင်ပါ။",
    doctorEn: "Seek medical advice if dizziness, weakness, reduced urination, or heat-related symptoms do not improve with rest and fluids."
  }
];  return lang === "my"
    ? ["မရှိပါ", "မရှိ", "မရှိဘူး", "မရှိပါဘူး"].includes(v)
    : ["no", "n"].includes(v);
}

function hasEmergencyWords(value) {
  const v = value.toLowerCase();
  const patterns = [
    /အသက်ရှူမဝ|အသက်ရှူမရ|အသက်ရှူခက်|အသက်ရှူကြပ်/,
    /ရင်ဘတ်အလွန်နာ|ရင်ဘတ်ပြင်းထန်စွာနာ/,
    /သတိလစ်|သတိမရ|မေ့လဲ/,
    /သွေးမတိတ်|သွေးအများကြီးထွက်/,
    /တက်နေ|တက်ခြင်း/,
    /စကားပြောခက်|စကားမပြောနိုင်|ကိုယ်တစ်ဖက်အားနည်း|မျက်နှာရွဲ့/,
    /နှုတ်ခမ်းဖောင်း|လျှာဖောင်း|လည်ချောင်းဖောင်း/,
    /can't breathe|cannot breathe|difficulty breathing|shortness of breath/,
    /severe chest pain|unconscious|passed out|uncontrolled bleeding/,
    /face drooping|one-sided weakness|throat swelling|tongue swelling/
  ];

  return patterns.some(pattern => pattern.test(v));
}

function findCategory(input, lang) {
  const normalized = input.trim();
  return categories.findIndex(c =>
    normalized === `${c.icon} ${c[lang]}` ||
    normalized === c[lang] ||
    normalized === `${c.icon} ${c.my}` ||
    normalized === c.my ||
    normalized === `${c.icon} ${c.en}` ||
    normalized === c.en
  );
}

function categoryDetail(category, lang, key) {
  const suffix = lang === "my" ? "My" : "En";
  const content = category[key + suffix];
  const disclaimer = lang === "my"
    ? "\n\n⚠️ အထွေထွေကျန်းမာရေးအချက်အလက်သာ ဖြစ်ပါတယ်။ ရောဂါအတည်ပြုခြင်း သို့မဟုတ် ဆေးညွှန်းခြင်း မဟုတ်ပါ။"
    : "\n\n⚠️ General health information only. This is not a diagnosis or prescription.";
  return `${category.icon} ${category[lang]}\n\n${content}${disclaimer}`;
}

async function handleMessage(msg) {
  if (!msg.text || !msg.chat) return;

  const id = String(msg.chat.id);
  const input = msg.text.trim();

  if (input === "/start") {
    if (pool && analyticsReady) {
      await ensureAnalyticsUser(id, langOf(id));
      return sendConsentPrompt(id);
    }
    sessions.set(id, { flow: "profile", step: "age" });
    return send(
      id,
      langOf(id) === "en"
        ? "Hello! 👋 Welcome to Htoo Care. 💚\n\nTo help us tailor health information, how old are you? Please enter your age in years. Example: 25"
        : "မင်္ဂလာပါ။ Htoo Care မှ ကြိုဆိုပါတယ်။ 💚\n\nသင့်ကျန်းမာရေးအတွက် ကူညီပေးနိုင်ရန် သင့်အသက် ဘယ်လောက်ရှိပါသလဲ။\nအသက်ကို နှစ်ဖြင့် ရိုက်ထည့်ပေးပါ။ ဥပမာ - 25",
      { remove_keyboard: true }
    );
  }

  if (input === "/privacy") {
    if (!pool || !analyticsReady) {
      return send(id, langOf(id) === "en" ? ui.en.privacy : ui.my.privacy);
    }
    const x = t(id);
    sessions.set(id, { flow: "privacy_consent", step: "choice" });
    return send(id, langOf(id) === "en"
      ? "Privacy options: choose to keep analytics enabled or stop it and delete your recorded events."
      : "ကိုယ်ရေးအချက်အလက်ရွေးချယ်စရာများ - analytics ဆက်ထားရန် သို့မဟုတ် ရပ်ဆိုင်းပြီး မှတ်တမ်းများဖျက်ရန် ရွေးချယ်ပါ။", {
      keyboard: [[x.consentYes], [x.consentNo]], resize_keyboard: true, one_time_keyboard: true
    });
  }

  if (input === "/report") {
    if (!pool || !analyticsReady || !process.env.ADMIN_TELEGRAM_ID || String(msg.from?.id) !== String(process.env.ADMIN_TELEGRAM_ID)) {
      return send(id, langOf(id) === "en" ? "This command is unavailable." : "ဤ command ကို အသုံးပြုခွင့်မရှိပါ။");
    }
    const report = await pool.query(`
      SELECT event_type, COALESCE(category, '-') AS category, COUNT(*)::int AS events,
             COUNT(DISTINCT user_key)::int AS users
      FROM hc_events
      WHERE created_at >= date_trunc('month', NOW())
      GROUP BY event_type, COALESCE(category, '-')
      ORDER BY event_type, category
    `);
    const total = await pool.query(`SELECT COUNT(DISTINCT user_key)::int AS consented_users FROM hc_users WHERE analytics_consent = TRUE`);
    const lines = report.rows.slice(0, 35).map(r => `${r.event_type} | ${r.category} | events: ${r.events} | users: ${r.users}`);
    const header = langOf(id) === "en"
      ? `Monthly aggregate report\nConsented users: ${total.rows[0].consented_users}\nNo individual symptom text or Telegram IDs are included.\n\n`
      : `လစဉ် စုစည်းအစီရင်ခံစာ\nAnalytics သဘောတူထားသူ: ${total.rows[0].consented_users}\nတစ်ဦးချင်းလက္ခဏာစာသားနှင့် Telegram ID မပါဝင်ပါ။\n\n`;
    return send(id, header + (lines.join("\n") || (langOf(id) === "en" ? "No events recorded this month." : "ဤလအတွက် မှတ်တမ်းမရှိသေးပါ။")), { remove_keyboard: true });
  }

  if (input === "/menu") {
    sessions.delete(id);
    return send(id, t(id).welcome);
  }

  if (input === "/language") {
    return send(id, "Choose language / ဘာသာစကားရွေးချယ်ပါ။", {
      keyboard: [["မြန်မာဘာသာ", "English"]],
      resize_keyboard: true
    });
  }

  if (input === "English" || input === "🌐 English") {
    languages.set(id, "en");
    if (pool && analyticsReady) {
      await ensureAnalyticsUser(id, "en");
      await trackEvent(id, "language_selected", "en");
    }
    sessions.delete(id);
    return send(id, ui.en.welcome);
  }

  if (input === "မြန်မာဘာသာ" || input === "🌐 မြန်မာဘာသာ") {
    languages.set(id, "my");
    if (pool && analyticsReady) {
      await ensureAnalyticsUser(id, "my");
      await trackEvent(id, "language_selected", "my");
    }
    sessions.delete(id);
    return send(id, ui.my.welcome);
  }

  const lang = langOf(id);
  const x = t(id);

  if (input === x.back || input === "🏠 ပင်မ Menu" || input === "🏠 Main Menu") {
    sessions.delete(id);
    return send(id, x.welcome);
  }

  const session = sessions.get(id);

  // Check urgent symptoms before normal symptom questions.
  if (hasEmergencyWords(input)) {
    sessions.delete(id);
    return send(id, x.emergency);
  }

  // Registration flow: age -> gender -> existing main menu.
  const consentSession = sessions.get(id);
  if (consentSession?.flow === "analytics_consent") {
    if (input === x.consentYes) {
      await setAnalyticsConsent(id, true, lang);
      await trackEvent(id, "bot_start");
      sessions.set(id, { flow: "profile", step: "age" });
      return send(id, lang === "en"
        ? "Thank you for consenting. You can withdraw at any time with /privacy.\n\nHow old are you? Enter age in years, e.g. 25."
        : "သဘောတူပေးသည့်အတွက် ကျေးဇူးတင်ပါတယ်။ /privacy ဖြင့် အချိန်မရွေး ရပ်ဆိုင်းနိုင်ပါတယ်။\n\nသင့်အသက်ကို နှစ်ဖြင့် ရိုက်ထည့်ပေးပါ။ ဥပမာ - 25", { remove_keyboard: true });
    }
    if (input === x.consentNo) {
      await setAnalyticsConsent(id, false, lang);
      sessions.set(id, { flow: "profile", step: "age" });
      return send(id, lang === "en"
        ? "No usage analytics will be recorded. You can still use Htoo Care. How old are you? Enter age in years, e.g. 25."
        : "အသုံးပြုမှုစာရင်းအင်း မမှတ်တမ်းတင်ပါ။ Htoo Care ကို ဆက်သုံးနိုင်ပါတယ်။ သင့်အသက်ကို နှစ်ဖြင့် ရိုက်ထည့်ပေးပါ။ ဥပမာ - 25", { remove_keyboard: true });
    }
    return send(id, x.consent, {
      keyboard: [[x.consentYes], [x.consentNo]],
      resize_keyboard: true,
      one_time_keyboard: true
    });
  }

  const privacySession = sessions.get(id);
  if (privacySession?.flow === "privacy_consent") {
    if (input === x.consentNo) {
      await setAnalyticsConsent(id, false, lang);
      sessions.delete(id);
      return send(id, lang === "en"
        ? "Analytics disabled and previously recorded events deleted. Use /start to return to Htoo Care."
        : "Analytics ကို ရပ်ဆိုင်းပြီး ယခင်မှတ်တမ်းများကို ဖျက်ပြီးပါပြီ။ Htoo Care သို့ ပြန်သွားရန် /start ကို သုံးပါ။");
    }
    if (input === x.consentYes) {
      await setAnalyticsConsent(id, true, lang);
      sessions.delete(id);
      return send(id, lang === "en"
        ? "Analytics remains enabled. Use /privacy at any time to withdraw."
        : "Analytics ကို ဆက်လက်ဖွင့်ထားပါမည်။ ရပ်ဆိုင်းလိုပါက /privacy ကို အချိန်မရွေး သုံးနိုင်ပါတယ်။");
    }
    return send(id, lang === "en"
      ? "Please choose one of the privacy options."
      : "ကိုယ်ရေးအချက်အလက်ရွေးချယ်စရာတစ်ခုကို ရွေးပါ။", {
      keyboard: [[x.consentYes], [x.consentNo]],
      resize_keyboard: true
    });
  }

  const profileSession = sessions.get(id);
  if (profileSession?.flow === "profile") {
    if (profileSession.step === "age") {
      const ageText = input.trim();
      const age = Number(ageText);

      if (!/^\d{1,3}$/.test(ageText) || !Number.isInteger(age) || age < 1 || age > 120) {
        return send(
          id,
          lang === "en"
            ? "Please enter a valid age from 1 to 120. Example: 25"
            : "အသက်ကို 1 မှ 120 အတွင်း ဂဏန်းဖြင့် ရိုက်ထည့်ပေးပါ။ ဥပမာ - 25",
          { keyboard: [[x.back]], resize_keyboard: true }
        );
      }

      profileSession.age = age;
      profileSession.step = "gender";
      sessions.set(id, profileSession);
      return send(
        id,
        lang === "en"
          ? "Thank you! 🙏\n\nPlease select your gender, or choose not to say."
          : "ကျေးဇူးတင်ပါတယ်။ 🙏\n\nသင့်လိင်ကို ရွေးချယ်ပေးပါ။ မဖြေလိုပါကလည်း ရွေးချယ်နိုင်ပါတယ်။",
        {
          keyboard: [
            ["အမျိုးသား (Male)", "အမျိုးသမီး (Female)"],
            ["မဖြေလိုပါ (Prefer not to say)"]
          ],
          resize_keyboard: true,
          one_time_keyboard: true
        }
      );
    }

    if (profileSession.step === "gender") {
      let gender;
      if (["အမျိုးသား (Male)", "အမျိုးသား", "Male"].includes(input)) {
        gender = "Male";
      } else if (["အမျိုးသမီး (Female)", "အမျိုးသမီး", "Female"].includes(input)) {
        gender = "Female";
      } else if (["မဖြေလိုပါ (Prefer not to say)", "မဖြေလိုပါ", "Prefer not to say"].includes(input)) {
        gender = "Prefer not to say";
      }

      if (!gender) {
        return send(
          id,
          lang === "en"
            ? "Please choose Male, Female, or Prefer not to say."
            : "အမျိုးသား၊ အမျိုးသမီး သို့မဟုတ် မဖြေလိုပါ ကို ရွေးချယ်ပေးပါ။",
          {
            keyboard: [
              ["အမျိုးသား (Male)", "အမျိုးသမီး (Female)"],
              ["မဖြေလိုပါ (Prefer not to say)"]
            ],
            resize_keyboard: true
          }
        );
      }

      profiles.set(id, { age: profileSession.age, gender });
      sessions.delete(id);
      return send(
        id,
        lang === "en"
          ? "Thank you! 💚\n\nWelcome to Htoo Care. Please choose a menu below."
          : "ကျေးဇူးတင်ပါတယ်။ 💚\n\nHtoo Care မှ ကြိုဆိုပါတယ်။ အောက်ပါ Menu ကို ရွေးချယ်ပါ။"
      );
    }
  }
  const ui = {
  my: {
    welcome: "မင်္ဂလာပါ။ Htoo Care မှ ကြိုဆိုပါတယ်။ 💚\n\nအောက်ပါ Menu ကို ရွေးချယ်ပါ။",
    health: "📚 ကျန်းမာရေးအချက်အလက်",
    symptoms: "🤒 လက္ခဏာစစ်ဆေးရန်",
    contact: "📞 7887 ဆက်သွယ်ရန်",
    language: "🌐 English",
    back: "🏠 ပင်မ Menu",
    choose: "ကျန်းမာရေးအမျိုးအစားကို ရွေးချယ်ပါ။",
    basic: "📖 အခြေခံသိထားသင့်သည်",
    prevent: "🛡️ ကြိုတင်ကာကွယ်နည်း",
    warning: "⚠️ သတိထားရမည့် လက္ခဏာများ",
    doctor: "👩‍⚕️ ဘယ်အချိန်မှာ ဆရာဝန်နှင့် တိုင်ပင်သင့်လဲ",
    symptomAsk: "ဘယ်လိုလက္ခဏာ ခံစားနေရပါသလဲ။ ဥပမာ - ခေါင်းကိုက်၊ အဖျားတက်၊ ဝမ်းလျှော။",
    redFlag: "အခု အသက်ရှူမဝခြင်း၊ ရင်ဘတ်ပြင်းထန်စွာနာခြင်း၊ သတိလစ်ခြင်း၊ ရုတ်တရက် စကားပြောခက်ခြင်း သို့မဟုတ် ကိုယ်တစ်ဖက်အားနည်းခြင်း ရှိပါသလား။",
    yes: "ရှိပါတယ်",
    no: "မရှိပါ",
    duration: "ဒီလက္ခဏာ ဘယ်လောက်ကြာပြီလဲ။ ဥပမာ - ဒီနေ့မှ၊ ၂ ရက်၊ ၁ ပတ်။",
    severity: "လက္ခဏာပြင်းထန်မှုကို ရွေးချယ်ပါ။",
    mild: "အနည်းငယ်",
    moderate: "အလယ်အလတ်",
    severe: "ပြင်းထန်",
    emergency: "🚨 အရေးပေါ်သတိပေးချက်\n\nသင်ဖော်ပြထားသော လက္ခဏာသည် အရေးပေါ်အခြေအနေ ဖြစ်နိုင်ပါတယ်။ Bot နဲ့ ဆက်လက်မေးခွန်းဖြေဆိုခြင်းကို ရပ်ပြီး အနီးဆုံး အရေးပေါ်ဆေးကုသမှုကို ချက်ချင်းရယူပါ။ လုံခြုံစွာ သွားလာနိုင်ခြင်းမရှိပါက ဒေသဆိုင်ရာ အရေးပေါ်အကူအညီကို ခေါ်ပါ။",
    result: "📝 သင်ဖြေထားသော အချက်အလက်များ\n\nလက္ခဏာ: {symptom}\nကြာချိန်: {duration}\nပြင်းထန်မှု: {severity}\n\nဤအချက်အလက်သည် ရောဂါအတည်ပြုချက် မဟုတ်ပါ။ လက္ခဏာမသက်သာခြင်း သို့မဟုတ် ပိုဆိုးလာခြင်းရှိပါက ဆရာဝန်နှင့် တိုင်ပင်ပါ။",
    contactInfo: "📞 7887 Healthcare Call Center\n\n7887 ကို ဖုန်းခေါ်ဆိုပြီး ကျန်းမာရေးအကြံဉာဏ် ရယူနိုင်မှုကို စမ်းသပ်နိုင်ပါတယ်။ ဖုန်းခေါ်ဆိုခနှင့် ဝန်ဆောင်မှုရရှိနိုင်မှုသည် သင့်ဖုန်းလိုင်းနှင့် လက်ရှိဝန်ဆောင်မှုအခြေအနေပေါ် မူတည်နိုင်ပါတယ်။ အရေးပေါ်အခြေအနေတွင် 7887 အဖြေကို စောင့်မနေဘဲ အရေးပေါ်ဆေးကုသမှု ရယူပါ။",
    disclaimer: "\n\n⚠️ အထွေထွေကျန်းမာရေးအချက်အလက်သာ ဖြစ်ပါတယ်။ ရောဂါအတည်ပြုခြင်း သို့မဟုတ် ဆေးညွှန်းခြင်း မဟုတ်ပါ။",
    fallback: "အောက်ပါ Menu မှ ရွေးချယ်ပေးပါ။",
    consent: "အသုံးပြုမှုစာရင်းအင်းအတွက် အမည်မသိပုံစံဖြင့်သာ အချက်အလက်အနည်းငယ် သိမ်းဆည်းရန် သဘောတူပါသလား။ သင်ရေးသော လက္ခဏာစာသား၊ Telegram ID၊ အသက်နှင့် လိင်ကို စာရင်းအင်းဒေတာဘေ့စ်တွင် မသိမ်းပါ။ မတူလည်း Htoo Care ကို ဆက်သုံးနိုင်ပါတယ်။",
    consentYes: "စာရင်းအင်းအတွက် သဘောတူပါတယ်",
    consentNo: "မသဘောတူပါ (စာရင်းအင်းမသိမ်းပါ)",
    privacy: "🔐 ကိုယ်ရေးအချက်အလက်\n\nHtoo Care သည် analytics သဘောတူပါက အသုံးပြုမှုအမျိုးအစားနှင့် အရေအတွက်ကိုသာ စုစည်းမှတ်တမ်းတင်သည်။ လက္ခဏာစာသားအပြည့်အစုံကို analytics database တွင် မသိမ်းပါ။ /privacy ဖြင့် analytics ကို ရပ်ဆိုင်းနိုင်သည်။",
    privacyEn: "Privacy: if you consent, Htoo Care stores only pseudonymous usage events and aggregate counts. Free-text symptoms are not stored in the analytics database. Use /privacy to withdraw consent."
  },
  en: {
    welcome: "Welcome to Htoo Care. 💚\n\nPlease choose an option below.",
    health: "📚 Health Information",
    symptoms: "🤒 Check Symptoms",
    contact: "📞 Contact 7887",
    language: "🌐 မြန်မာဘာသာ",
    back: "🏠 Main Menu",
    choose: "Choose a health category.",
    basic: "📖 Essential Facts",
    prevent: "🛡️ Prevention",
    warning: "⚠️ Warning Signs",
    doctor: "👩‍⚕️ When to See a Clinician",
    symptomAsk: "What symptom are you experiencing? For example: headache, fever, or diarrhoea.",
    redFlag: "Are you experiencing difficulty breathing, severe chest pain, loss of consciousness, sudden difficulty speaking, or sudden weakness on one side?",
    yes: "Yes",
    no: "No",
    duration: "How long have you had this symptom? For example: today, 2 days, or 1 week.",
    severity: "Choose the severity of your symptom.",
    mild: "Mild",
    moderate: "Moderate",
    severe: "Severe",
    emergency: "🚨 EMERGENCY WARNING\n\nYour symptoms may indicate an emergency. Stop this chat assessment and seek urgent medical care now. If you cannot travel safely, contact local emergency services.",
    result: "📝 Your responses\n\nSymptom: {symptom}\nDuration: {duration}\nSeverity: {severity}\n\nThis is not a diagnosis. Consult a clinician if symptoms persist or worsen.",
    contactInfo: "📞 7887 Healthcare Call Center\n\nYou may try calling 7887 for health guidance. Charges and availability may depend on your network and current service arrangements. In an emergency, do not wait for a 7887 response; seek urgent medical care.",
    disclaimer: "\n\n⚠️ General health information only. This is not a diagnosis or prescription.",
    fallback: "Please choose an option from the menu.",
    consent: "May Htoo Care store a small amount of pseudonymous usage data for aggregate statistics? Your free-text symptoms, Telegram ID, age, and gender will not be stored in the analytics database. You can still use Htoo Care if you decline.",
    consentYes: "I agree to usage analytics",
    consentNo: "No analytics, please",
    privacy: "🔐 Privacy\n\nIf you consent, Htoo Care records pseudonymous usage-event types and aggregate counts only. Free-text symptoms are not stored in the analytics database. Use /privacy to withdraw consent."
  }
};

function userKey(telegramId) {
  if (!process.env.DATA_HASH_SECRET) return null;
  return crypto.createHmac("sha256", process.env.DATA_HASH_SECRET).update(String(telegramId)).digest("hex");
}

async function initAnalytics() {
  if (!pool) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS hc_users (
      user_key CHAR(64) PRIMARY KEY,
      language VARCHAR(5) NOT NULL DEFAULT 'my',
      analytics_consent BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      consent_updated_at TIMESTAMPTZ
    );
    CREATE TABLE IF NOT EXISTS hc_events (
      event_id BIGSERIAL PRIMARY KEY,
      user_key CHAR(64) NOT NULL REFERENCES hc_users(user_key) ON DELETE CASCADE,
      event_type TEXT NOT NULL,
      category TEXT,
      severity TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT hc_events_severity_check CHECK (severity IS NULL OR severity IN ('mild','moderate','severe'))
    );
    CREATE INDEX IF NOT EXISTS hc_events_created_at_idx ON hc_events(created_at);
    CREATE INDEX IF NOT EXISTS hc_events_type_idx ON hc_events(event_type);
  `);
  analyticsReady = true;
  console.log("PostgreSQL analytics tables ready.");
}

async function ensureAnalyticsUser(telegramId, lang) {
  if (!pool || !analyticsReady) return null;
  const key = userKey(telegramId);
  await pool.query(
    `INSERT INTO hc_users (user_key, language) VALUES ($1, $2)
     ON CONFLICT (user_key) DO UPDATE SET language = EXCLUDED.language`,
    [key, lang || "my"]
  );
  return key;
}

async function setAnalyticsConsent(telegramId, consent, lang) {
  if (!pool || !analyticsReady) return;
  const key = await ensureAnalyticsUser(telegramId, lang);
  await pool.query(
    `UPDATE hc_users SET analytics_consent = $2, consent_updated_at = NOW() WHERE user_key = $1`,
    [key, Boolean(consent)]
  );
  if (!consent) await pool.query(`DELETE FROM hc_events WHERE user_key = $1`, [key]);
}

async function trackEvent(telegramId, eventType, category = null, severity = null) {
  if (!pool || !analyticsReady) return;
  const key = userKey(telegramId);
  await pool.query(
    `INSERT INTO hc_events (user_key, event_type, category, severity)
     SELECT $1, $2, $3, $4 FROM hc_users WHERE user_key = $1 AND analytics_consent = TRUE`,
    [key, eventType, category, severity]
  );
}

function symptomCategory(input) {
  const v = String(input || "").toLowerCase();
  if (/ခေါင်းကိုက်|မူးဝေ|headache|dizz/.test(v)) return "headache";
  if (/အဖျား|ချောင်းဆိုး|နှာစေး|fever|cough|cold/.test(v)) return "respiratory";
  if (/ဝမ်းလျှော|ဝမ်းချုပ်|ဗိုက်နာ|diarrh|stomach|abdominal/.test(v)) return "digestive";
  if (/ရာသီ|ကိုယ်ဝန်|သားဆက်ခြား|pregnan|period|contracept|sexual|srhr/.test(v)) return "reproductive";
  if (/စိတ်ဖိစီး|စိုးရိမ်|ဝမ်းနည်း|anxiety|stress|depress|mental/.test(v)) return "mental";
  return "other";
}

async function sendConsentPrompt(chatId) {
  const x = t(chatId);
  sessions.set(String(chatId), { flow: "analytics_consent", step: "choice" });
  return send(chatId, x.consent, {
    keyboard: [[x.consentYes], [x.consentNo]],
    resize_keyboard: true,
    one_time_keyboard: true
  });
}

function langOf(id) {
  return languages.get(id) || "my";
}

function t(id) {
  return ui[langOf(id)];
}

function mainKeyboard(id) {
  const x = t(id);
  return {
    keyboard: [
      [x.health],
      [x.symptoms],
      [x.contact, x.language]
    ],
    resize_keyboard: true
  };
}

function healthKeyboard(id) {
  const lang = langOf(id);
  const rows = [];

  for (let i = 0; i < categories.length; i += 2) {
    rows.push(
      categories.slice(i, i + 2).map(c => `${c.icon} ${c[lang]}`)
    );
  }

  rows.push([t(id).back]);
  return { keyboard: rows, resize_keyboard: true };
}

function detailKeyboard(id) {
  const x = t(id);
  return {
    keyboard: [
      [x.basic],
      [x.prevent],
      [x.warning],
      [x.doctor],
      [x.back]
    ],
    resize_keyboard: true
  };
}

function choices(id, options) {
  return {
    keyboard: options.map(v => [v]),
    resize_keyboard: true,
    one_time_keyboard: true
  };
}

function send(id, message, keyboard = mainKeyboard(id)) {
  return bot.sendMessage(id, message, { reply_markup: keyboard });
}

function isYes(value, lang) {
  const v = value.trim().toLowerCase();
  return lang === "my"
    ? ["ရှိပါတယ်", "ရှိ", "ဟုတ်", "ဟုတ်ကဲ့", "ရှိတယ်"].includes(v)
    : ["yes", "y"].includes(v);
}

function isNo(value, lang) {
  const v = value.trim().toLowerCase();
  return lang === "my"
    ? ["မရှိပါ", "မရှိ", "မရှိဘူး", "မရှိပါဘူး"].includes(v)
    : ["no", "n"].includes(v);
}
  function hasEmergencyWords(value) {
  const v = value.toLowerCase();
  const patterns = [
    /အသက်ရှူမဝ|အသက်ရှူမရ|အသက်ရှူခက်|အသက်ရှူကြပ်/,
    /ရင်ဘတ်အလွန်နာ|ရင်ဘတ်ပြင်းထန်စွာနာ/,
    /သတိလစ်|သတိမရ|မေ့လဲ/,
    /သွေးမတိတ်|သွေးအများကြီးထွက်/,
    /တက်နေ|တက်ခြင်း/,
    /စကားပြောခက်|စကားမပြောနိုင်|ကိုယ်တစ်ဖက်အားနည်း|မျက်နှာရွဲ့/,
    /နှုတ်ခမ်းဖောင်း|လျှာဖောင်း|လည်ချောင်းဖောင်း/,
    /can't breathe|cannot breathe|difficulty breathing|shortness of breath/,
    /severe chest pain|unconscious|passed out|uncontrolled bleeding/,
    /face drooping|one-sided weakness|throat swelling|tongue swelling/
  ];

  return patterns.some(pattern => pattern.test(v));
}

function findCategory(input, lang) {
  const normalized = input.trim();
  return categories.findIndex(c =>
    normalized === `${c.icon} ${c[lang]}` ||
    normalized === c[lang] ||
    normalized === `${c.icon} ${c.my}` ||
    normalized === c.my ||
    normalized === `${c.icon} ${c.en}` ||
    normalized === c.en
  );
}

function categoryDetail(category, lang, key) {
  const suffix = lang === "my" ? "My" : "En";
  const content = category[key + suffix];
  const disclaimer = lang === "my"
    ? "\n\n⚠️ အထွေထွေကျန်းမာရေးအချက်အလက်သာ ဖြစ်ပါတယ်။ ရောဂါအတည်ပြုခြင်း သို့မဟုတ် ဆေးညွှန်းခြင်း မဟုတ်ပါ။"
    : "\n\n⚠️ General health information only. This is not a diagnosis or prescription.";
  return `${category.icon} ${category[lang]}\n\n${content}${disclaimer}`;
}

async function handleMessage(msg) {
  if (!msg.text || !msg.chat) return;

  const id = String(msg.chat.id);
  const input = msg.text.trim();

  if (input === "/start") {
    if (pool && analyticsReady) {
      await ensureAnalyticsUser(id, langOf(id));
      return sendConsentPrompt(id);
    }
    sessions.set(id, { flow: "profile", step: "age" });
    return send(
      id,
      langOf(id) === "en"
        ? "Hello! 👋 Welcome to Htoo Care. 💚\n\nTo help us tailor health information, how old are you? Please enter your age in years. Example: 25"
        : "မင်္ဂလာပါ။ Htoo Care မှ ကြိုဆိုပါတယ်။ 💚\n\nသင့်ကျန်းမာရေးအတွက် ကူညီပေးနိုင်ရန် သင့်အသက် ဘယ်လောက်ရှိပါသလဲ။\nအသက်ကို နှစ်ဖြင့် ရိုက်ထည့်ပေးပါ။ ဥပမာ - 25",
      { remove_keyboard: true }
    );
  }

  if (input === "/privacy") {
    if (!pool || !analyticsReady) {
      return send(id, langOf(id) === "en" ? ui.en.privacy : ui.my.privacy);
    }
    const x = t(id);
    sessions.set(id, { flow: "privacy_consent", step: "choice" });
    return send(id, langOf(id) === "en"
      ? "Privacy options: choose to keep analytics enabled or stop it and delete your recorded events."
      : "ကိုယ်ရေးအချက်အလက်ရွေးချယ်စရာများ - analytics ဆက်ထားရန် သို့မဟုတ် ရပ်ဆိုင်းပြီး မှတ်တမ်းများဖျက်ရန် ရွေးချယ်ပါ။", {
      keyboard: [[x.consentYes], [x.consentNo]],
      resize_keyboard: true,
      one_time_keyboard: true
    });
  }

  if (input === "/report") {
    if (!pool || !analyticsReady || !process.env.ADMIN_TELEGRAM_ID || String(msg.from?.id) !== String(process.env.ADMIN_TELEGRAM_ID)) {
      return send(id, langOf(id) === "en" ? "This command is unavailable." : "ဤ command ကို အသုံးပြုခွင့်မရှိပါ။");
    }

    const report = await pool.query(`
      SELECT event_type, COALESCE(category, '-') AS category, COUNT(*)::int AS events,
             COUNT(DISTINCT user_key)::int AS users
      FROM hc_events
      WHERE created_at >= date_trunc('month', NOW())
      GROUP BY event_type, COALESCE(category, '-')
      ORDER BY event_type, category
    `);

    const total = await pool.query(`
      SELECT COUNT(DISTINCT user_key)::int AS consented_users
      FROM hc_users
      WHERE analytics_consent = TRUE
    `);

    const lines = report.rows.slice(0, 35).map(r =>
      `${r.event_type} | ${r.category} | events: ${r.events} | users: ${r.users}`
    );

    const header = langOf(id) === "en"
      ? `Monthly aggregate report\nConsented users: ${total.rows[0].consented_users}\nNo individual symptom text or Telegram IDs are included.\n\n`
      : `လစဉ် စုစည်းအစီရင်ခံစာ\nAnalytics သဘောတူထားသူ: ${total.rows[0].consented_users}\nတစ်ဦးချင်းလက္ခဏာစာသားနှင့် Telegram ID မပါဝင်ပါ။\n\n`;

    return send(
      id,
      header + (lines.join("\n") || (
        langOf(id) === "en" ? "No events recorded this month." : "ဤလအတွက် မှတ်တမ်းမရှိသေးပါ။"
      )),
      { remove_keyboard: true }
    );
  }

  if (input === "/menu") {
    sessions.delete(id);
    return send(id, t(id).welcome);
  }

  if (input === "/language") {
    return send(id, "Choose language / ဘာသာစကားရွေးချယ်ပါ။", {
      keyboard: [["မြန်မာဘာသာ", "English"]],
      resize_keyboard: true
    });
  }

  if (input === "English" || input === "🌐 English") {
    languages.set(id, "en");
    if (pool && analyticsReady) {
      await ensureAnalyticsUser(id, "en");
      await trackEvent(id, "language_selected", "en");
    }
    sessions.delete(id);
    return send(id, ui.en.welcome);
  }

  if (input === "မြန်မာဘာသာ" || input === "🌐 မြန်မာဘာသာ") {
    languages.set(id, "my");
    if (pool && analyticsReady) {
      await ensureAnalyticsUser(id, "my");
      await trackEvent(id, "language_selected", "my");
    }
    sessions.delete(id);
    return send(id, ui.my.welcome);
  }

  const lang = langOf(id);
  const x = t(id);

  if (input === x.back || input === "🏠 ပင်မ Menu" || input === "🏠 Main Menu") {
    sessions.delete(id);
    return send(id, x.welcome);
  }

  const session = sessions.get(id);

  // Check urgent symptoms before normal symptom questions.
  if (hasEmergencyWords(input)) {
    sessions.delete(id);
    return send(id, x.emergency);
  }

  const consentSession = sessions.get(id);
  if (consentSession?.flow === "analytics_consent") {
    if (input === x.consentYes) {
      await setAnalyticsConsent(id, true, lang);
      await trackEvent(id, "bot_start");
      sessions.set(id, { flow: "profile", step: "age" });
      return send(id, lang === "en"
        ? "Thank you for consenting. You can withdraw at any time with /privacy.\n\nHow old are you? Enter age in years, e.g. 25."
        : "သဘောတူပေးသည့်အတွက် ကျေးဇူးတင်ပါတယ်။ /privacy ဖြင့် အချိန်မရွေး ရပ်ဆိုင်းနိုင်ပါတယ်။\n\nသင့်အသက်ကို နှစ်ဖြင့် ရိုက်ထည့်ပေးပါ။ ဥပမာ - 25", {
        remove_keyboard: true
      });
    }

    if (input === x.consentNo) {
      await setAnalyticsConsent(id, false, lang);
      sessions.set(id, { flow: "profile", step: "age" });
      return send(id, lang === "en"
        ? "No usage analytics will be recorded. You can still use Htoo Care. How old are you? Enter age in years, e.g. 25."
        : "အသုံးပြုမှုစာရင်းအင်း မမှတ်တမ်းတင်ပါ။ Htoo Care ကို ဆက်သုံးနိုင်ပါတယ်။ သင့်အသက်ကို နှစ်ဖြင့် ရိုက်ထည့်ပေးပါ။ ဥပမာ - 25", {
        remove_keyboard: true
      });
    }

    return send(id, x.consent, {
      keyboard: [[x.consentYes], [x.consentNo]],
      resize_keyboard: true,
      one_time_keyboard: true
    });
  }

  const privacySession = sessions.get(id);
  if (privacySession?.flow === "privacy_consent") {
    if (input === x.consentNo) {
      await setAnalyticsConsent(id, false, lang);
      sessions.delete(id);
      return send(id, lang === "en"
        ? "Analytics disabled and previously recorded events deleted. Use /start to return to Htoo Care."
        : "Analytics ကို ရပ်ဆိုင်းပြီး ယခင်မှတ်တမ်းများကို ဖျက်ပြီးပါပြီ။ Htoo Care သို့ ပြန်သွားရန် /start ကို သုံးပါ။");
    }

    if (input === x.consentYes) {
      await setAnalyticsConsent(id, true, lang);
      sessions.delete(id);
      return send(id, lang === "en"
        ? "Analytics remains enabled. Use /privacy at any time to withdraw."
        : "Analytics ကို ဆက်လက်ဖွင့်ထားပါမည်။ ရပ်ဆိုင်းလိုပါက /privacy ကို အချိန်မရွေး သုံးနိုင်ပါတယ်။");
    }

    return send(id, lang === "en"
      ? "Please choose one of the privacy options."
      : "ကိုယ်ရေးအချက်အလက်ရွေးချယ်စရာတစ်ခုကို ရွေးပါ။", {
      keyboard: [[x.consentYes], [x.consentNo]],
      resize_keyboard: true
    });
  }
    const profileSession = sessions.get(id);
  if (profileSession?.flow === "profile") {
    if (profileSession.step === "age") {
      const ageText = input.trim();
      const age = Number(ageText);

      if (!/^\d{1,3}$/.test(ageText) || !Number.isInteger(age) || age < 1 || age > 120) {
        return send(
          id,
          lang === "en"
            ? "Please enter a valid age from 1 to 120. Example: 25"
            : "အသက်ကို 1 မှ 120 အတွင်း ဂဏန်းဖြင့် ရိုက်ထည့်ပေးပါ။ ဥပမာ - 25",
          { keyboard: [[x.back]], resize_keyboard: true }
        );
      }

      profileSession.age = age;
      profileSession.step = "gender";
      sessions.set(id, profileSession);
      return send(
        id,
        lang === "en"
          ? "Thank you! 🙏\n\nPlease select your gender, or choose not to say."
          : "ကျေးဇူးတင်ပါတယ်။ 🙏\n\nသင့်လိင်ကို ရွေးချယ်ပေးပါ။ မဖြေလိုပါကလည်း ရွေးချယ်နိုင်ပါတယ်။",
        {
          keyboard: [
            ["အမျိုးသား (Male)", "အမျိုးသမီး (Female)"],
            ["မဖြေလိုပါ (Prefer not to say)"]
          ],
          resize_keyboard: true,
          one_time_keyboard: true
        }
      );
    }

    if (profileSession.step === "gender") {
      let gender;
      if (["အမျိုးသား (Male)", "အမျိုးသား", "Male"].includes(input)) {
        gender = "Male";
      } else if (["အမျိုးသမီး (Female)", "အမျိုးသမီး", "Female"].includes(input)) {
        gender = "Female";
      } else if (["မဖြေလိုပါ (Prefer not to say)", "မဖြေလိုပါ", "Prefer not to say"].includes(input)) {
        gender = "Prefer not to say";
      }

      if (!gender) {
        return send(
          id,
          lang === "en"
            ? "Please choose Male, Female, or Prefer not to say."
            : "အမျိုးသား၊ အမျိုးသမီး သို့မဟုတ် မဖြေလိုပါ ကို ရွေးချယ်ပေးပါ။",
          {
            keyboard: [
              ["အမျိုးသား (Male)", "အမျိုးသမီး (Female)"],
              ["မဖြေလိုပါ (Prefer not to say)"]
            ],
            resize_keyboard: true
          }
        );
      }

      profiles.set(id, { age: profileSession.age, gender });
      sessions.delete(id);
      return send(
        id,
        lang === "en"
          ? "Thank you! 💚\n\nWelcome to Htoo Care. Please choose a menu below."
          : "ကျေးဇူးတင်ပါတယ်။ 💚\n\nHtoo Care မှ ကြိုဆိုပါတယ်။ အောက်ပါ Menu ကို ရွေးချယ်ပါ။"
      );
    }
  }

  if (input === x.health) {
    await trackEvent(id, "education_open");
    sessions.set(id, { flow: "health", step: "category" });
    return send(id, x.choose, healthKeyboard(id));
  }

  if (input === x.symptoms) {
    await trackEvent(id, "symptom_flow_opened");
    sessions.set(id, { flow: "symptoms", step: "symptom" });
    return send(id, x.symptomAsk, {
      keyboard: [[x.back]],
      resize_keyboard: true
    });
  }

  if (input === x.contact) {
    await trackEvent(id, "contact_7887_opened");
    sessions.delete(id);
    return send(id, x.contactInfo);
  }

  const categoryIndex = findCategory(input, lang);
  if (categoryIndex !== -1) {
    await trackEvent(id, "education_chapter", `chapter_${categoryIndex + 1}`);
    sessions.set(id, {
      flow: "health",
      step: "detail",
      categoryIndex
    });
    return send(
      id,
      `📚 ${categories[categoryIndex][lang]}\n\n${x.choose}`,
      detailKeyboard(id)
    );
  }

  if (session && session.flow === "health" && session.step === "detail") {
    const category = categories[session.categoryIndex];

    const options = [
      [x.basic, "basic"],
      [x.prevent, "prevent"],
      [x.warning, "warning"],
      [x.doctor, "doctor"]
    ];

    const selected = options.find(([label]) => label === input);

    if (selected) {
      const suffix = lang === "my" ? "My" : "En";
      const content = category[selected[1] + suffix];
      const disclaimer = lang === "my"
        ? "\n\n⚠️ အထွေထွေကျန်းမာရေးအချက်အလက်သာ ဖြစ်ပါတယ်။ ရောဂါအတည်ပြုခြင်း သို့မဟုတ် ဆေးညွှန်းခြင်း မဟုတ်ပါ။"
        : "\n\n⚠️ General health information only. This is not a diagnosis or prescription.";

      return send(
        id,
        `${category.icon} ${category[lang]}\n\n${content}${disclaimer}`,
        detailKeyboard(id)
      );
    }

    return send(id, x.choose, detailKeyboard(id));
  }

  if (session && session.flow === "symptoms") {
    if (session.step === "symptom") {
      // Only a broad category is recorded in analytics, never the free-text symptom.
      session.symptom = input;
      await trackEvent(id, "symptom_category_selected", symptomCategory(input));
      session.step = "redFlag";
      sessions.set(id, session);
      return send(id, x.redFlag, choices(id, [x.yes, x.no]));
    }

    if (session.step === "redFlag") {
      if (isYes(input, lang)) {
        sessions.delete(id);
        return send(id, x.emergency);
      }

      if (isNo(input, lang)) {
        session.step = "duration";
        sessions.set(id, session);
        return send(id, x.duration, {
          keyboard: [[x.back]],
          resize_keyboard: true
        });
      }

      return send(id, x.redFlag, choices(id, [x.yes, x.no]));
    }

    if (session.step === "duration") {
      session.duration = input;
      session.step = "severity";
      sessions.set(id, session);
      return send(id, x.severity, choices(id, [x.mild, x.moderate, x.severe]));
    }

    if (session.step === "severity") {
      const severityValue =
        input === x.mild ? "mild" :
        input === x.moderate ? "moderate" :
        input === x.severe ? "severe" : null;

      if (!severityValue) {
        return send(id, x.severity, choices(id, [x.mild, x.moderate, x.severe]));
      }

      await trackEvent(
        id,
        "severity_selected",
        symptomCategory(session.symptom),
        severityValue
      );

      const result = x.result
        .replace("{symptom}", session.symptom)
        .replace("{duration}", session.duration)
        .replace("{severity}", input);

      sessions.delete(id);
      return send(id, result);
    }
  }

  return send(id, x.fallback);
}

bot.on("message", msg => {
  handleMessage(msg).catch(err => {
    console.error("Telegram message error:", err.message);
  });
});

bot.on("polling_error", err => {
  console.error("Telegram polling error:", err.message);
});

app.get("/", (req, res) => {
  res.status(200).send("Htoo Care Telegram Bot is running.");
});

app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    analytics: analyticsReady ? "ready" : "disabled"
  });
});

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, async () => {
  console.log(`Htoo Care listening on port ${PORT}`);

  try {
    await initAnalytics();
    console.log(
      pool
        ? "Analytics enabled."
        : "Analytics disabled: DATABASE_URL is not configured."
    );
  } catch (err) {
    console.error("PostgreSQL initialization failed:", err.message);
    analyticsReady = false;
  }

  try {
    await bot.startPolling();
    console.log("Telegram polling started.");
  } catch (err) {
    console.error("Telegram polling failed to start:", err.message);
  }
});

async function shutdown() {
  try {
    await bot.stopPolling();
  } catch (_) {}

  if (pool) {
    try {
      await pool.end();
    } catch (_) {}
  }

  server.close(() => process.exit(0));
}

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
