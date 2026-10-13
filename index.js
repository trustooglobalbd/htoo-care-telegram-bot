
const { Bot, InlineKeyboard } = require("grammy");

const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
  throw new Error("Missing TELEGRAM_BOT_TOKEN environment variable.");
}

const bot = new Bot(token);
const languages = new Map();
const symptomSessions = new Map();

const text = {
  en: {
    welcome: "Welcome to Htoo Care by Trust Oo.\nChoose your language:",
    menu: "How can we help you today?",
    health: "Health information",
    symptoms: "Guided symptom intake",
    referrals: "Hospital and clinic directory",
    contact: "Contact 7887",
    privacy: "Privacy information",
    emergency: "⚠️ If you may be experiencing a medical emergency, seek urgent local medical help now. Do not wait for a Telegram reply.",
    disclaimer: "Htoo Care provides general health information, not a diagnosis or a prescription. A qualified healthcare professional should assess your individual condition.",
    healthInfo: "Choose a topic:\n• General health and prevention\n• Maternal and child health\n• Sexual and reproductive health\n\nClinically reviewed content will be added to each topic before public launch.",
    symptomStart: "What is your main symptom? Please do not send your name, phone number, address, or other identifying information.",
    duration: "How long have you had this symptom?",
    severity: "How severe is it: mild, moderate, or severe?",
    intakeDone: "Thank you. Your answers have not been saved to a database. This bot cannot diagnose your condition. Please contact a qualified healthcare professional for advice.",
    referralsInfo: "The verified hospital and clinic directory is being prepared. Please contact 7887 or a qualified local healthcare provider for referral guidance.",
    contactInfo: "For the 7887 healthcare service, use the official 7887 calling pathway available to you. Confirm service availability and applicable charges with Trust Oo.",
    privacyInfo: "Please avoid sending names, identity documents, addresses, phone numbers, photographs, or other sensitive personal information. This prototype does not intentionally store symptom answers in a database, but Telegram messages are still processed by Telegram and the bot service.",
    back: "Main menu",
    languageSet: "Language updated."
  },
  my: {
    welcome: "Trust Oo ၏ Htoo Care မှ ကြိုဆိုပါတယ်။\nဘာသာစကား ရွေးချယ်ပါ။",
    menu: "ယနေ့ ဘယ်လိုကူညီပေးရမလဲ။",
    health: "ကျန်းမာရေးအချက်အလက်",
    symptoms: "လက္ခဏာ မေးမြန်းခြင်း",
    referrals: "ဆေးရုံနှင့် ဆေးခန်းလမ်းညွှန်",
    contact: "7887 ကို ဆက်သွယ်ရန်",
    privacy: "ကိုယ်ရေးအချက်အလက် လုံခြုံရေး",
    emergency: "⚠️ အရေးပေါ်ကျန်းမာရေးအခြေအနေ ဖြစ်နိုင်ပါက Telegram အဖြေကို မစောင့်ဘဲ အနီးဆုံး အရေးပေါ်ကျန်းမာရေးဝန်ဆောင်မှုကို ချက်ချင်း ဆက်သွယ်ပါ။",
    disclaimer: "Htoo Care သည် ယေဘုယျ ကျန်းမာရေးအချက်အလက်များကိုသာ ပေးပါသည်။ ရောဂါအတည်ပြုခြင်း သို့မဟုတ် ဆေးညွှန်းပေးခြင်း မပြုပါ။",
    healthInfo: "ကျန်းမာရေးအကြောင်းအရာများ\n• အထွေထွေကျန်းမာရေးနှင့် ကာကွယ်ရေး\n• မိခင်နှင့် ကလေးကျန်းမာရေး\n• လိင်နှင့် မျိုးဆက်ပွားကျန်းမာရေး\n\nအများပြည်သူအသုံးပြုမီ ကျန်းမာရေးပညာရှင်များ စစ်ဆေးထားသော အကြောင်းအရာများကို ထည့်သွင်းပါမည်။",
    symptomStart: "အဓိကခံစားနေရသော လက္ခဏာကို ရေးပေးပါ။ အမည်၊ ဖုန်းနံပါတ်၊ လိပ်စာ သို့မဟုတ် ကိုယ်ရေးအချက်အလက်များ မပေးပါနှင့်။",
    duration: "ဤလက္ခဏာကို ဘယ်လောက်ကြာကြာ ခံစားနေရပါသလဲ။",
    severity: "ပြင်းထန်မှုကို ရွေးပါ — အနည်းငယ်၊ အလယ်အလတ်၊ သို့မဟုတ် ပြင်းထန်။",
    intakeDone: "ကျေးဇူးတင်ပါတယ်။ သင့်အဖြေများကို ဒေတာဘေ့စ်တွင် မသိမ်းဆည်းထားပါ။ ဤ bot သည် ရောဂါအတည်ပြုမပေးနိုင်ပါ။ ကျန်းမာရေးပညာရှင်နှင့် တိုင်ပင်ပါ။",
    referralsInfo: "စစ်ဆေးအတည်ပြုထားသော ဆေးရုံနှင့် ဆေးခန်းစာရင်းကို ပြင်ဆင်နေပါသည်။ လမ်းညွှန်မှုအတွက် 7887 သို့မဟုတ် ဒေသခံကျန်းမာရေးဝန်ဆောင်မှုပေးသူကို ဆက်သွယ်ပါ။",
    contactInfo: "7887 ကျန်းမာရေးဝန်ဆောင်မှုအတွက် Trust Oo မှ အတည်ပြုထားသော 7887 ခေါ်ဆိုမှုလမ်းကြောင်းကို အသုံးပြုပါ။ ဝန်ဆောင်မှုရရှိနိုင်မှုနှင့် ကုန်ကျစရိတ်ကို အတည်ပြုပါ။",
    privacyInfo: "အမည်၊ မှတ်ပုံတင်၊ လိပ်စာ၊ ဖုန်းနံပါတ်၊ ဓာတ်ပုံ သို့မဟုတ် အခြားအရေးကြီးသော ကိုယ်ရေးအချက်အလက်များ မပေးပါနှင့်။ ဤမူကြမ်းသည် လက္ခဏာအဖြေများကို ဒေတာဘေ့စ်တွင် ရည်ရွယ်ချက်ရှိရှိ မသိမ်းဆည်းပါ။ သို့သော် Telegram နှင့် bot ဝန်ဆောင်မှုက မက်ဆေ့ချ်များကို ကိုင်တွယ်ဆောင်ရွက်ပါသည်။",
    back: "ပင်မမီနူး",
    languageSet: "ဘာသာစကား ပြောင်းလဲပြီးပါပြီ။"
  }
};

function menuKeyboard(lang) {
  const t = text[lang];
  return new InlineKeyboard()
    .text(t.health, "health").row()
    .text(t.symptoms, "symptoms").row()
    .text(t.referrals, "referrals").row()
    .text(t.contact, "contact").row()
    .text(t.privacy, "privacy").row()
    .text("English", "lang_en")
    .text("မြန်မာ", "lang_my");
}

function currentLanguage(ctx) {
  return languages.get(ctx.from.id) || "my";
}

async function showMenu(ctx) {
  const lang = currentLanguage(ctx);
  await ctx.reply(text[lang].menu, {
    reply_markup: menuKeyboard(lang)
  });
}

bot.command("start", async (ctx) => {
  const keyboard = new InlineKeyboard()
    .text("မြန်မာ", "lang_my")
    .text("English", "lang_en");
  await ctx.reply(text.my.welcome + "\n\n" + text.en.welcome, {
    reply_markup: keyboard
  });
});

bot.command("menu", showMenu);

bot.command("cancel", async (ctx) => {
  symptomSessions.delete(ctx.from.id);
  await ctx.reply(text[currentLanguage(ctx)].menu, {
    reply_markup: menuKeyboard(currentLanguage(ctx))
  });
});

bot.callbackQuery(/^lang_(en|my)$/, async (ctx) => {
  const lang = ctx.match[1];
  languages.set(ctx.from.id, lang);
  symptomSessions.delete(ctx.from.id);
  await ctx.answerCallbackQuery();
  await ctx.reply(text[lang].languageSet);
  await showMenu(ctx);
});

bot.callbackQuery(
  /^(health|symptoms|referrals|contact|privacy|back)$/,
  async (ctx) => {
    const lang = currentLanguage(ctx);
    const action = ctx.match[1];
    await ctx.answerCallbackQuery();

    if (action === "back") {
      symptomSessions.delete(ctx.from.id);
      return showMenu(ctx);
    }

    if (action === "symptoms") {
      symptomSessions.set(ctx.from.id, { step: "symptom" });
      return ctx.reply(
        text[lang].emergency + "\n\n" +
        text[lang].disclaimer + "\n\n" +
        text[lang].symptomStart
      );
    }

    const replies = {
      health: text[lang].healthInfo,
      referrals: text[lang].referralsInfo,
      contact: text[lang].contactInfo,
      privacy: text[lang].privacyInfo
    };

    const keyboard = new InlineKeyboard()
      .text(text[lang].back, "back");

    await ctx.reply(replies[action], { reply_markup: keyboard });
  }
);

bot.on("message:text", async (ctx) => {
  const lang = currentLanguage(ctx);
  const session = symptomSessions.get(ctx.from.id);

  if (!session) {
    return ctx.reply(text[lang].menu, {
      reply_markup: menuKeyboard(lang)
    });
  }

  const answer = ctx.message.text.trim();

  if (answer.startsWith("/")) {
    symptomSessions.delete(ctx.from.id);
    return ctx.reply(text[lang].menu, {
      reply_markup: menuKeyboard(lang)
    });
  }

  if (session.step === "symptom") {
    session.symptom = answer.slice(0, 500);
    session.step = "duration";
    return ctx.reply(text[lang].duration);
  }

  if (session.step === "duration") {
    session.duration = answer.slice(0, 200);
    session.step = "severity";
    return ctx.reply(text[lang].severity);
  }

  if (session.step === "severity") {
    symptomSessions.delete(ctx.from.id);
    return ctx.reply(
      text[lang].intakeDone + "\n\n" +
      text[lang].emergency,
      { reply_markup: menuKeyboard(lang) }
    );
  }
});

bot.catch((err) => {
  console.error("Bot error:", err.error?.message || "Request failed");
});

bot.start({
  onStart: (info) => {
    console.log(`Htoo Care bot started: @${info.username}`);
  }
});
