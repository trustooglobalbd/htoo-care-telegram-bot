
const { Bot, InlineKeyboard } = require("grammy");

const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
  throw new Error("Missing TELEGRAM_BOT_TOKEN environment variable.");
}

const bot = new Bot(token);

const menus = {
  my: {
    welcome: "မင်္ဂလာပါ။ Htoo Care မှ ကြိုဆိုပါတယ်။ 👋\nကျန်းမာရေးအချက်အလက်အတွက် အောက်ပါအကြောင်းအရာကို ရွေးချယ်ပါ။",
    general: "ကျန်းမာရေးကို ထိန်းသိမ်းရန် အာဟာရမျှတစွာစားပါ၊ ရေသောက်ပါ၊ အနားယူပါ၊ လိုအပ်ပါက ကျန်းမာရေးဝန်ထမ်းနှင့် တိုင်ပင်ပါ။",
    women: "အမျိုးသမီးကျန်းမာရေး၊ ရာသီလာခြင်း၊ သားဆက်ခြားခြင်းနှင့် မျိုးဆက်ပွားကျန်းမာရေးအတွက် ကျန်းမာရေးဝန်ထမ်းထံမှ ယုံကြည်ရသော အကြံဉာဏ်ရယူပါ။",
    symptoms: "လက္ခဏာတစ်ခုတည်းဖြင့် ရောဂါကို မသတ်မှတ်နိုင်ပါ။ အသက်ရှူခက်ခြင်း၊ သတိလစ်ခြင်း၊ ရင်ဘတ်ပြင်းထန်စွာနာခြင်း သို့မဟုတ် သွေးထွက်မရပ်ခြင်းဖြစ်ပါက အရေးပေါ်ဆေးကုသမှု ချက်ချင်းရယူပါ။",
    referral: "သင့်ဒေသရှိ ဆေးရုံ၊ ဆေးခန်း သို့မဟုတ် အထူးကုနှင့် တိုင်ပင်ပါ။ သွားရောက်မီ ဝန်ဆောင်မှုရရှိနိုင်မှုကို အတည်ပြုပါ။",
    contact: "7887 သည် ကျန်းမာရေးအကြံဉာဏ်ရယူရန် အသုံးပြုနိုင်သော Healthcare Call Center ဖြစ်သည်။ ဖုန်းခေါ်ဆိုခနှင့် ရရှိနိုင်မှုသည် သင့်တယ်လီကွန်းကွန်ရက်နှင့် အခြေအနေအလိုက် ကွာခြားနိုင်ပါသည်။",
    privacy: "ကိုယ်ရေးအချက်အလက်၊ စကားဝှက်၊ မှတ်ပုံတင်နံပါတ် သို့မဟုတ် မလိုအပ်သော ဆေးဘက်ဆိုင်ရာအသေးစိတ်များကို မပို့ပါနှင့်။ ဤ Bot သည် အရေးပေါ်ဝန်ဆောင်မှုမဟုတ်ပါ။"
  },
  en: {
    welcome: "Welcome to Htoo Care by Trust Oo! 👋\nChoose a healthcare topic below.",
    general: "For general wellbeing, eat a balanced diet, drink water, rest, and consult a qualified healthcare professional when needed.",
    women: "For women's health, menstruation, contraception, and sexual and reproductive health, seek confidential advice from a qualified healthcare professional.",
    symptoms: "Symptoms alone cannot confirm a diagnosis. If you have difficulty breathing, loss of consciousness, severe chest pain, or uncontrolled bleeding, seek emergency medical care immediately.",
    referral: "Please contact a local hospital, clinic, or specialist. Confirm service availability before travelling.",
    contact: "7887 is a healthcare call center pathway. Call charges and availability may depend on your telecom provider and location.",
    privacy: "Do not send passwords, ID numbers, or unnecessary sensitive medical details. This bot is not an emergency service."
  }
};

const topics = {
  general: { my: "ကျန်းမာရေး", en: "General health" },
  women: { my: "အမျိုးသမီးကျန်းမာရေး", en: "Women's health / SRH" },
  symptoms: { my: "လက္ခဏာများ", en: "Symptoms & warnings" },
  referral: { my: "ဆေးရုံ/ဆေးခန်း", en: "Referral guidance" },
  contact: { my: "7887 Call Center", en: "7887 Call Center" },
  privacy: { my: "ကိုယ်ရေးအချက်အလက်", en: "Privacy" }
};

const userLanguage = new Map();

function mainKeyboard(lang) {
  const kb = new InlineKeyboard();
  for (const [key, label] of Object.entries(topics)) {
    kb.text(label[lang], `topic:${key}`).row();
  }
  kb.text("မြန်မာ", "lang:my").text("English", "lang:en");
  return kb;
}

async function showMenu(ctx, lang) {
  userLanguage.set(ctx.from.id, lang);
  await ctx.reply(menus[lang].welcome, {
    reply_markup: mainKeyboard(lang)
  });
}

bot.command("start", async (ctx) => {
  await showMenu(ctx, "my");
});

bot.command("help", async (ctx) => {
  const lang = userLanguage.get(ctx.from.id) || "my";
  await showMenu(ctx, lang);
});

bot.command("language", async (ctx) => {
  await ctx.reply("Choose your language / ဘာသာစကားရွေးချယ်ပါ။", {
    reply_markup: new InlineKeyboard()
      .text("မြန်မာ", "lang:my")
      .text("English", "lang:en")
  });
});

bot.command("faq", async (ctx) => {
  const lang = userLanguage.get(ctx.from.id) || "my";
  await showMenu(ctx, lang);
});

bot.command("health", async (ctx) => {
  const lang = userLanguage.get(ctx.from.id) || "my";
  await ctx.reply(menus[lang].general);
});

bot.command("womenhealth", async (ctx) => {
  const lang = userLanguage.get(ctx.from.id) || "my";
  await ctx.reply(menus[lang].women);
});

bot.command("symptoms", async (ctx) => {
  const lang = userLanguage.get(ctx.from.id) || "my";
  await ctx.reply(menus[lang].symptoms);
});

bot.command("referral", async (ctx) => {
  const lang = userLanguage.get(ctx.from.id) || "my";
  await ctx.reply(menus[lang].referral);
});

bot.command("7887", async (ctx) => {
  const lang = userLanguage.get(ctx.from.id) || "my";
  await ctx.reply(menus[lang].contact);
});

bot.command("privacy", async (ctx) => {
  const lang = userLanguage.get(ctx.from.id) || "my";
  await ctx.reply(menus[lang].privacy);
});

bot.callbackQuery(/^lang:(my|en)$/, async (ctx) => {
  const lang = ctx.match[1];
  await ctx.answerCallbackQuery();
  await showMenu(ctx, lang);
});

bot.callbackQuery(/^topic:(general|women|symptoms|referral|contact|privacy)$/, async (ctx) => {
  const lang = userLanguage.get(ctx.from.id) || "my";
  const topic = ctx.match[1];
  await ctx.answerCallbackQuery();
  await ctx.reply(menus[lang][topic], {
    reply_markup: mainKeyboard(lang)
  });
});

bot.catch((err) => {
  console.error("Bot error:", err.message);
});

bot.start();
console.log("Htoo Care bot started.");
