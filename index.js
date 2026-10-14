
const { Bot, InlineKeyboard } = require("grammy");

const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
  throw new Error("Missing TELEGRAM_BOT_TOKEN environment variable.");
}

const bot = new Bot(token);

// Temporary in-memory sessions only.
// Sessions are cleared if the bot restarts.
const sessions = new Map();

const keyboards = {
  language: new InlineKeyboard()
    .text("မြန်မာ", "lang:my")
    .text("English", "lang:en"),

  consent: new InlineKeyboard()
    .text("ဆက်လုပ်မယ်", "consent:yes")
    .text("မလုပ်တော့ပါ", "consent:no"),

  skip: new InlineKeyboard()
    .text("မဖြေလိုပါ / Skip", "skip"),

  gender: new InlineKeyboard()
    .text("ကျား", "gender:male")
    .text("မ", "gender:female").row()
    .text("အခြား / မဖြေလိုပါ", "gender:skip"),

  school: new InlineKeyboard()
    .text("တက်နေပါတယ်", "school:yes")
    .text("မတက်ပါ", "school:no"),

  yesNo: new InlineKeyboard()
    .text("ရှိပါတယ်", "answer:yes")
    .text("မရှိပါ", "answer:no"),

  problemArea: new InlineKeyboard()
    .text("အိမ်", "area:home")
    .text("ကျောင်း", "area:school").row()
    .text("အလုပ်", "area:work")
    .text("သူငယ်ချင်း", "area:friends").row()
    .text("အွန်လိုင်း", "area:online")
    .text("အခြားနေရာ", "area:other"),

  mainMenu: new InlineKeyboard()
    .text("ကျန်းမာရေးအချက်အလက်", "menu:health").row()
    .text("SRH ကျန်းမာရေး", "menu:srh").row()
    .text("လက္ခဏာ လမ်းညွှန်", "menu:symptoms").row()
    .text("7887 အချက်အလက်", "menu:7887").row()
    .text("Privacy", "menu:privacy"),

  symptom: new InlineKeyboard()
    .text("ခေါင်းကိုက်", "symptom:headache").row()
    .text("ဖျားခြင်း", "symptom:fever").row()
    .text("ချောင်းဆိုး", "symptom:cough").row()
    .text("ဗိုက်နာ", "symptom:stomachache").row()
    .text("ဝမ်းလျှော", "symptom:diarrhea").row()
    .text("အခြားလက္ခဏာ", "symptom:other"),

  emergency: new InlineKeyboard()
    .text("ရှိပါတယ်", "emergency:yes")
    .text("မရှိပါ", "emergency:no")
};

const t = (ctx, my, en) =>
  (sessions.get(ctx.from.id)?.lang || "my") === "en" ? en : my;

const areas = {
  home: "အိမ် / Home",
  school: "ကျောင်း / School",
  work: "အလုပ် / Work",
  friends: "သူငယ်ချင်း / Friends",
  online: "အွန်လိုင်း / Online",
  other: "အခြား / Other"
};

const symptoms = {
  headache: "ခေါင်းကိုက် / Headache",
  fever: "ဖျားခြင်း / Fever",
  cough: "ချောင်းဆိုး / Cough",
  stomachache: "ဗိုက်နာ / Stomach pain",
  diarrhea: "ဝမ်းလျှော / Diarrhea"
};

async function askName(ctx) {
  const s = sessions.get(ctx.from.id);
  s.step = "name";

  await ctx.reply(
    t(ctx,
      "သင့်အမည်ကို ရေးပေးနိုင်ပါတယ်။ အမည်ရင်းပေးရန် မလိုပါ။",
      "You may enter a name or nickname. Your real name is not required."
    ),
    { reply_markup: keyboards.skip }
  );
}

async function askAge(ctx) {
  const s = sessions.get(ctx.from.id);
  s.step = "age";

  const kb = new InlineKeyboard()
    .text("၀–၁၂", "age:0-12").row()
    .text("၁၃–၁၇", "age:13-17").row()
    .text("၁၈–၃၅", "age:18-35").row()
    .text("၃၆–၅၉", "age:36-59").row()
    .text("၆၀+", "age:60+").row()
    .text("မဖြေလိုပါ / Skip", "skip");

  await ctx.reply(
    t(ctx, "သင့်အသက်အရွယ်ကို ရွေးပါ။", "Please select your age range."),
    { reply_markup: kb }
  );
}

async function askGender(ctx) {
  sessions.get(ctx.from.id).step = "gender";

  await ctx.reply(
    t(ctx, "သင့်လိင်ကို ရွေးပါ။ မဖြေလိုပါက ကျော်နိုင်ပါတယ်။",
      "Select your gender, or skip if you prefer not to answer."),
    { reply_markup: keyboards.gender }
  );
}

async function askSchool(ctx) {
  sessions.get(ctx.from.id).step = "school";

  await ctx.reply(
    t(ctx, "လက်ရှိ ကျောင်းတက်နေပါသလား?",
      "Are you currently attending school?"),
    { reply_markup: keyboards.school }
  );
}

async function askFeeling(ctx) {
  sessions.get(ctx.from.id).step = "feeling";

  await ctx.reply(
    t(ctx,
      "အခု လက်ရှိ ဘယ်လိုခံစားနေရပါသလဲ။ ကျန်းမာရေး၊ စိတ်ခံစားချက် သို့မဟုတ် အခြားအကြောင်းအရာကို ရေးနိုင်ပါတယ်။ မဖြေလိုပါက Skip ကို နှိပ်ပါ။",
      "How are you feeling right now? You can share a health concern, an emotion, or something else. You may skip this question."
    ),
    { reply_markup: keyboards.skip }
  );
}

async function showMenu(ctx) {
  const s = sessions.get(ctx.from.id);
  if (s) s.step = "menu";

  await ctx.reply(
    t(ctx,
      "ဘယ်အကြောင်းအရာကို ကူညီပေးရမလဲ။",
      "What would you like help with?"
    ),
    { reply_markup: keyboards.mainMenu }
  );
}

// Start
bot.command("start", async (ctx) => {
  sessions.set(ctx.from.id, {
    step: "consent",
    lang: "my"
  });

  await ctx.reply(
    "မင်္ဂလာပါ 👋 Htoo Care | Trust Oo မှ ကြိုဆိုပါတယ်။\n\n" +
    "Welcome to Htoo Care | Trust Oo.\n\n" +
    "ဘာသာစကားကို ရွေးချယ်ပါ / Choose your language:",
    { reply_markup: keyboards.language }
  );
});

// Help
bot.command("help", async (ctx) => {
  await ctx.reply(
    "/start - စတင်ရန် / Start\n" +
    "/7887 - 7887 အချက်အလက် / 7887 information\n" +
    "/cancel - ရပ်ရန် / Cancel\n\n" +
    "Htoo Care သည် အထွေထွေကျန်းမာရေးအချက်အလက် ပေးရန်ဖြစ်ပြီး ရောဂါအတည်ပြုခြင်း သို့မဟုတ် ဆေးညွှန်းပေးခြင်း မပြုပါ။"
  );
});

// 7887 information
bot.command("7887", async (ctx) => {
  await ctx.reply(
    "7887 Healthcare Call Center သည် ကျန်းမာရေးအကြံဉာဏ်ရယူရန် ဆက်သွယ်နိုင်သော ဝန်ဆောင်မှုဖြစ်ပါတယ်။\n\n" +
    "ခေါ်ဆိုခ၊ ကွန်ရက်အလိုက် ဝန်ဆောင်မှုရရှိနိုင်မှုနှင့် အခြားသတ်မှတ်ချက်များကို မခေါ်မီ အတည်ပြုပါ။\n\n" +
    "အရေးပေါ်အခြေအနေတွင် 7887 ကို စောင့်မနေဘဲ အရေးပေါ်ဆေးကုသမှုကို ရယူပါ။"
  );
});

// Cancel
bot.command("cancel", async (ctx) => {
  sessions.delete(ctx.from.id);
  await ctx.reply("မေးမြန်းမှုကို ရပ်လိုက်ပါပြီ။ ပြန်စရန် /start ကို နှိပ်ပါ။");
});

// Language selection
bot.callbackQuery(/^lang:(my|en)$/, async (ctx) => {
  sessions.set(ctx.from.id, {
    step: "consent",
    lang: ctx.match[1]
  });

  await ctx.answerCallbackQuery();

  await ctx.reply(
    t(ctx,
      "ကိုယ်ရေးအချက်အလက် အသိပေးချက် 🔒\n\n" +
      "ဤ Bot တွင် သင်ဖြေဆိုသောအချက်အလက်များကို လက်ရှိ bot လည်ပတ်နေစဉ်အတွင်း ယာယီမှတ်သားနိုင်ပါတယ်။ ဤ code သည် database ထဲသို့ အချက်အလက်များကို မသိမ်းဆည်းပါ။ Bot ပြန်စတင်ပါက session ပျောက်သွားနိုင်ပါတယ်။\n\n" +
      "သင့်အမည်ရင်း၊ ဖုန်းနံပါတ် သို့မဟုတ် တိကျသောလိပ်စာကို မပေးပါနှင့်။ မေးခွန်းများကို ကျော်နိုင်ပါတယ်။ ဆက်လုပ်လိုပါသလား?",
      "Privacy notice 🔒\n\n" +
      "Your answers are held temporarily while the bot is running. This code does not save responses to a database. Sessions may be lost if the bot restarts.\n\n" +
      "Do not share your real name, phone number, or exact address. You can skip questions. Would you like to continue?"
    ),
    { reply_markup: keyboards.consent }
  );
});

// Consent
bot.callbackQuery(/^consent:(yes|no)$/, async (ctx) => {
  await ctx.answerCallbackQuery();

  if (ctx.match[1] === "no") {
    sessions.delete(ctx.from.id);
    await ctx.reply(t(ctx, "ရပါတယ်။ ပြန်စလိုပါက /start ကို နှိပ်ပါ။",
      "No problem. Send /start whenever you want to begin."));
    return;
  }

  await askName(ctx);
});

// Skip optional questions
bot.callbackQuery("skip", async (ctx) => {
  const s = sessions.get(ctx.from.id);
  await ctx.answerCallbackQuery();

  if (!s) {
    await ctx.reply("ပြန်စရန် /start ကို နှိပ်ပါ။");
    return;
  }

  if (s.step === "name") {
    s.name = "";
    await askAge(ctx);
  } else if (s.step === "age") {
    s.age = "မဖြေလိုပါ";
    await askGender(ctx);
  } else if (s.step === "gender") {
    s.gender = "မဖြေလိုပါ";
    await askSchool(ctx);
  } else if (s.step === "grade") {
    s.grade = "";
    await askFeeling(ctx);
  } else if (s.step === "work") {
    s.work = "";
    await askFeeling(ctx);
  } else if (s.step === "feeling") {
    s.feeling = "";
    s.step = "area";
    await ctx.reply(
      t(ctx, "ပြဿနာ သို့မဟုတ် စိတ်ပူပန်မှု ဖြစ်ပွားလေ့ရှိသည့်နေရာကို ရွေးပါ။",
        "Where does the issue or concern usually happen?"),
      { reply_markup: keyboards.problemArea }
    );
  } else if (s.step === "worry") {
    s.worry = "";
    await showMenu(ctx);
  } else {
    await showMenu(ctx);
  }
});

// Age
bot.callbackQuery(/^age:(.+)$/, async (ctx) => {
  const s = sessions.get(ctx.from.id);
  await ctx.answerCallbackQuery();

  if (!s) {
    await ctx.reply("ပြန်စရန် /start ကို နှိပ်ပါ။");
    return;
  }

  s.age = ctx.match[1];
  await askGender(ctx);
});

// Gender
bot.callbackQuery(/^gender:(.+)$/, async (ctx) => {
  const s = sessions.get(ctx.from.id);
  await ctx.answerCallbackQuery();
  if (!s) return;

  s.gender = ctx.match[1];
  await askSchool(ctx);
});

// School attendance
bot.callbackQuery(/^school:(yes|no)$/, async (ctx) => {
  const s = sessions.get(ctx.from.id);
  await ctx.answerCallbackQuery();
  if (!s) return;

  if (ctx.match[1] === "yes") {
    s.step = "grade";
    await ctx.reply(
      t(ctx, "ဘယ်အတန်း တက်နေပါသလဲ။ မဖြေလိုပါက Skip ကို နှိပ်ပါ။",
        "Which grade are you in? You may skip."),
      { reply_markup: keyboards.skip }
    );
  } else {
    s.step = "work";
    await ctx.reply(
      t(ctx, "လက်ရှိ အလုပ်လုပ်နေပါသလား။ လုပ်နေပါက ဘယ်လိုအလုပ်မျိုးလဲ။ မဖြေလိုပါက Skip ကို နှိပ်ပါ။",
        "Are you currently working? If yes, what kind of work do you do? You may skip."),
      { reply_markup: keyboards.skip }
    );
  }
});

// Feelings and concern area
bot.callbackQuery(/^area:(.+)$/, async (ctx) => {
  const s = sessions.get(ctx.from.id);
  await ctx.answerCallbackQuery();
  if (!s) return;

  s.area = areas[ctx.match[1]] || "အခြား";
  s.step = "worry";

  await ctx.reply(
    t(ctx,
      "သင့်ကို စိတ်ပူပန်စေတဲ့အရာ သို့မဟုတ် အခက်အခဲတစ်ခုခု ရှိပါသလား။ အသေးစိတ်မပြောလိုပါက ကျော်နိုင်ပါတယ်။",
      "Is anything worrying or troubling you? You do not need to share details, and you can skip this question."
    ),
    { reply_markup: keyboards.skip }
  );
});

// Yes/no responses for worry
bot.callbackQuery(/^answer:(yes|no)$/, async (ctx) => {
  const s = sessions.get(ctx.from.id);
  await ctx.answerCallbackQuery();
  if (!s) return;

  s.worry = ctx.match[1] === "yes" ? "ရှိပါတယ်" : "မရှိပါ";
  await showMenu(ctx);
});

// Main menu
bot.callbackQuery(/^menu:(health|srh|symptoms|7887|privacy)$/, async (ctx) => {
  const s = sessions.get(ctx.from.id);
  await ctx.answerCallbackQuery();
  if (!s) {
    await ctx.reply("ပြန်စရန် /start ကို နှိပ်ပါ။");
    return;
  }

  const choice = ctx.match[1];

  if (choice === "health") {
    await ctx.reply(
      "ကျန်းမာရေးအချက်အလက် 🩺\n\n" +
      "• လက္ခဏာနှင့် ကျန်းမာရေးဆိုင်ရာ အထွေထွေဗဟုသုတ\n" +
      "• အာဟာရနှင့် ကျန်းမာသောနေထိုင်မှုပုံစံ\n" +
      "• မိခင်နှင့်ကလေး ကျန်းမာရေး\n" +
      "• ကျန်းမာရေးပညာရှင်ထံမှ အကြံဉာဏ်ရယူခြင်း\n\n" +
      "ကိုယ်တိုင်ရောဂါအတည်ပြုရန် သို့မဟုတ် ဆေးသောက်ရန် ဆုံးဖြတ်ချက်ချရန် ဤအချက်အလက်ကိုသာ မမှီခိုပါနှင့်။",
      { reply_markup: keyboards.mainMenu }
    );
  } else if (choice === "srh") {
    await ctx.reply(
      "SRH | လိင်နှင့် မျိုးဆက်ပွားကျန်းမာရေး 💜\n\n" +
      "• အပျိုဖော်/လူပျိုဖော်ဝင်ခြင်းနှင့် ခန္ဓာကိုယ်ပြောင်းလဲမှုများ\n" +
      "• ရာသီလာခြင်းနှင့် ရာသီလာစဉ် စောင့်ရှောက်မှု\n" +
      "• သဘောတူညီမှု (consent) နှင့် ကိုယ်ပိုင်နယ်နိမိတ်များ\n" +
      "• လိင်မှတစ်ဆင့် ကူးစက်နိုင်သော ရောဂါများအကြောင်း\n" +
      "• မိသားစုစီမံကိန်းနှင့် သန္ဓေတားနည်းများအကြောင်း\n" +
      "• လုံခြုံသော ဆေးဘက်ဆိုင်ရာ အကြံဉာဏ်ရယူခြင်း\n\n" +
      "အရေးကြီးသော ဆုံးဖြတ်ချက်များအတွက် အရည်အချင်းပြည့်မီသော ကျန်းမာရေးဝန်ထမ်းထံ ဆွေးနွေးပါ။",
      { reply_markup: keyboards.mainMenu }
    );
  } else if (choice === "symptoms") {
    s.step = "symptom";
    await ctx.reply(
      "ဘယ်လိုလက္ခဏာ ခံစားနေရပါသလဲ။ ဤရွေးချယ်မှုသည် အချက်အလက်စုဆောင်းရန်သာ ဖြစ်ပြီး ရောဂါအတည်ပြုခြင်း မဟုတ်ပါ။",
      { reply_markup: keyboards.symptom }
    );
  } else if (choice === "7887") {
    await ctx.reply(
      "7887 Healthcare Call Center\n\n" +
      "ကျန်းမာရေးအကြံဉာဏ်အတွက် 7887 ကို ဆက်သွယ်နိုင်ပါတယ်။ ခေါ်ဆိုခနှင့် ဝန်ဆောင်မှုရရှိနိုင်မှုကို သင့်ဖုန်းကွန်ရက်နှင့်အညီ အတည်ပြုပါ။\n\n" +
      "အရေးပေါ်အခြေအနေတွင် အနီးဆုံး အရေးပေါ်ဆေးကုသမှုကို ချက်ချင်းရယူပါ။",
      { reply_markup: keyboards.mainMenu }
    );
  } else if (choice === "privacy") {
    await ctx.reply(
      "Privacy 🔒\n\n" +
      "ဤ code သည် သင့်အဖြေများကို database ထဲသို့ မသိမ်းဆည်းပါ။ Bot လည်ပတ်နေစဉ် အဖြေများကို ယာယီမှတ်သားထားနိုင်ပြီး restart လုပ်ပါက ပျောက်သွားနိုင်ပါတယ်။\n\n" +
      "အမည်ရင်း၊ ဖုန်းနံပါတ်၊ တိကျသောလိပ်စာနှင့် အခြားသူကို ခွဲခြားသိရှိနိုင်စေမည့် အချက်အလက်များ မပေးပါနှင့်။",
      { reply_markup: keyboards.mainMenu }
    );
  }
});

// Symptom selection
bot.callbackQuery(/^symptom:(.+)$/, async (ctx) => {
  const s = sessions.get(ctx.from.id);
  await ctx.answerCallbackQuery();
  if (!s) return;

  s.symptom = symptoms[ctx.match[1]] || "";

  if (ctx.match[1] === "other") {
    s.step = "symptom_text";
    await ctx.reply("ခံစားနေရသော လက္ခဏာကို ရေးပါ။ ကိုယ်ရေးကိုယ်တာအချက်အလက်များ မထည့်ပါနှင့်။");
  } else {
    s.step = "emergency";
    await ctx.reply(
      "အသက်ရှူအလွန်ခက်ခြင်း၊ သတိလစ်ခြင်း၊ ရင်ဘတ်အလွန်နာခြင်း သို့မဟုတ် သွေးအများအပြားထွက်ခြင်း ရှိပါသလား။",
      { reply_markup: keyboards.emergency }
    );
  }
});

// Emergency warning check
bot.callbackQuery(/^emergency:(yes|no)$/, async (ctx) => {
  const s = sessions.get(ctx.from.id);
  await ctx.answerCallbackQuery();
  if (!s) return;

  if (ctx.match[1] === "yes") {
    sessions.delete(ctx.from.id);
    await ctx.reply(
      "⚠️ အရေးပေါ်အခြေအနေ ဖြစ်နိုင်ပါတယ်။ အနီးဆုံး အရေးပေါ်ဆေးကုသမှုကို ချက်ချင်းရယူပါ။ Bot သို့မဟုတ် 7887 အဖြေကို စောင့်မနေပါနှင့်။"
    );
    return;
  }

  s.step = "duration";
  await ctx.reply("ဒီလက္ခဏာ စတင်ဖြစ်တာ ဘယ်လောက်ကြာပြီလဲ။ ဥပမာ - ဒီနေ့မှ၊ ၂ ရက်၊ ၁ ပတ်။");
});

// Text input
bot.on("message:text", async (ctx) => {
  const id = ctx.from.id;
  const s = sessions.get(id);
  if (!s) return;

  const answer = ctx.message.text.trim();

  // Commands are handled by command handlers
  if (answer.startsWith("/")) return;

  if (s.step === "name") {
    s.name = answer;
    await askAge(ctx);
    return;
  }

  if (s.step === "grade") {
    s.grade = answer;
    await askFeeling(ctx);
    return;
  }

  if (s.step === "work") {
    s.work = answer;
    await askFeeling(ctx);
    return;
  }

  if (s.step === "feeling") {
    s.feeling = answer;
    s.step = "area";

    await ctx.reply(
      "ပြဿနာ သို့မဟုတ် စိတ်ပူပန်မှု ဖြစ်ပွားလေ့ရှိသည့်နေရာကို ရွေးပါ။",
      { reply_markup: keyboards.problemArea }
    );
    return;
  }

  if (s.step === "worry") {
    s.worry = answer;
    await showMenu(ctx);
    return;
  }

  if (s.step === "symptom_text") {
    s.symptom = answer;
    s.step = "emergency";

    await ctx.reply(
      "အသက်ရှူအလွန်ခက်ခြင်း၊ သတိလစ်ခြင်း၊ ရင်ဘတ်အလွန်နာခြင်း သို့မဟုတ် သွေးအများအပြားထွက်ခြင်း ရှိပါသလား။",
      { reply_markup: keyboards.emergency }
    );
    return;
  }

  if (s.step === "duration") {
    s.duration = answer;
    s.step = "location";

    await ctx.reply(
      "သင်နေထိုင်ရာ မြို့နယ် သို့မဟုတ် မြို့အမည်ကို ပြောပြနိုင်ပါတယ်။ မဖြေလိုပါက /cancel ကို နှိပ်ပါ။\n\n" +
      "သတိပြုရန် - ဤ bot တွင် လက်ရှိ ဆေးခန်း/ဆေးရုံရှာဖွေရေး database မချိတ်ဆက်ထားသေးပါ။"
    );
    return;
  }

  if (s.step === "location") {
    // Do not claim that a real clinic lookup was performed.
    s.location = answer;

    await ctx.reply(
      "သင့်အဖြေကို လက်ခံရရှိပါပြီ။\n\n" +
      "လက္ခဏာ: " + (s.symptom || "မဖော်ပြထားပါ") + "\n" +
      "ကြာချိန်: " + (s.duration || "မဖော်ပြထားပါ") + "\n\n" +
      "ဤ bot သည် ရောဂါအတည်ပြုခြင်း၊ ဆေးညွှန်းပေးခြင်း သို့မဟုတ် ဆေးခန်းစာရင်းကို အလိုအလျောက်ရှာဖွေခြင်း မပြုပါ။ ကျန်းမာရေးအကြံဉာဏ်အတွက် 7887 ကို ဆက်သွယ်နိုင်ပါတယ်။\n\n" +
      "အရေးပေါ်လက္ခဏာရှိလာပါက အရေးပေါ်ဆေးကုသမှုကို ချက်ချင်းရယူပါ။",
      { reply_markup: keyboards.mainMenu }
    );

    s.step = "menu";
  }
});

bot.catch((err) => {
  console.error("Bot error:", err.message);
});

bot.start();
console.log("Htoo Care is running.");
