
const { Bot, InlineKeyboard } = require("grammy");

const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN);
const sessions = new Map();

const ageKeyboard = new InlineKeyboard()
  .text("၀–၁၂ နှစ်", "age:0-12").row()
  .text("၁၃–၁၇ နှစ်", "age:13-17").row()
  .text("၁၈–၃၅ နှစ်", "age:18-35").row()
  .text("၃၆–၅၉ နှစ်", "age:36-59").row()
  .text("၆၀ နှစ်နှင့်အထက်", "age:60+");

const genderKeyboard = new InlineKeyboard()
  .text("ကျား", "gender:male")
  .text("မ", "gender:female").row()
  .text("မဖြေလိုပါ", "gender:skip");

const symptomKeyboard = new InlineKeyboard()
  .text("ခေါင်းကိုက်", "symptom:ခေါင်းကိုက်").row()
  .text("ဝမ်းလျှော", "symptom:ဝမ်းလျှော").row()
  .text("ဖျားခြင်း", "symptom:ဖျားခြင်း").row()
  .text("ချောင်းဆိုး", "symptom:ချောင်းဆိုး").row()
  .text("ဗိုက်နာ", "symptom:ဗိုက်နာ").row()
  .text("အခြားလက္ခဏာ", "symptom:other");

bot.command("start", async (ctx) => {
  sessions.set(ctx.from.id, { step: "age" });

  await ctx.reply(
    "မင်္ဂလာပါ 👋\n\n" +
    "Htoo Care | Trust Oo မှ ကြိုဆိုပါတယ်။\n" +
    "သင့်ကျန်းမာရေးအတွက် ကူညီပေးပါမယ်။\n\n" +
    "ပထမဆုံး သင့်အသက်အရွယ်ကို ရွေးချယ်ပေးပါ။",
    { reply_markup: ageKeyboard }
  );
});

bot.command("help", async (ctx) => {
  await ctx.reply(
    "/start - ကျန်းမာရေးမေးမြန်းမှု စတင်ရန်\n" +
    "/7887 - 7887 အချက်အလက်\n" +
    "/cancel - မေးမြန်းမှု ရပ်ရန်"
  );
});

bot.command("7887", async (ctx) => {
  await ctx.reply(
    "ကျန်းမာရေးအကြံဉာဏ်အတွက် 7887 Healthcare Call Center ကို ဆက်သွယ်နိုင်ပါတယ်။ " +
    "ခေါ်ဆိုခနှင့် ဝန်ဆောင်မှုရရှိနိုင်မှုကို သင့်ဖုန်းကွန်ရက်နှင့်အညီ အတည်ပြုပါ။"
  );
});

bot.command("cancel", async (ctx) => {
  sessions.delete(ctx.from.id);
  await ctx.reply("မေးမြန်းမှုကို ရပ်လိုက်ပါပြီ။ ပြန်စရန် /start ကို နှိပ်ပါ။");
});

// အသက်ရွေးချယ်ခြင်း
bot.callbackQuery(/^age:(.+)$/, async (ctx) => {
  const s = sessions.get(ctx.from.id);
  if (!s) {
    await ctx.answerCallbackQuery({ text: "ပြန်စရန် /start ကို နှိပ်ပါ။" });
    return;
  }

  s.age = ctx.match[1];
  s.step = "gender";

  await ctx.answerCallbackQuery();
  await ctx.reply("သင့်လိင်ကို ရွေးချယ်ပေးပါ။", {
    reply_markup: genderKeyboard
  });
});

// ကျား / မ
bot.callbackQuery(/^gender:(.+)$/, async (ctx) => {
  const s = sessions.get(ctx.from.id);
  if (!s) {
    await ctx.answerCallbackQuery();
    return;
  }

  s.gender = ctx.match[1];
  s.step = "symptom";

  await ctx.answerCallbackQuery();
  await ctx.reply(
    "ကျေးဇူးတင်ပါတယ်။\n\n" +
    "အခု ဘယ်လိုခံစားနေရပါသလဲ။\n" +
    "အောက်ပါအချက်ကို ရွေးနိုင်သလို ကိုယ်တိုင်လည်း ရိုက်ရေးနိုင်ပါတယ်။",
    { reply_markup: symptomKeyboard }
  );
});

// လက္ခဏာရွေးချယ်ခြင်း
bot.callbackQuery(/^symptom:(.+)$/, async (ctx) => {
  const s = sessions.get(ctx.from.id);
  if (!s) {
    await ctx.answerCallbackQuery();
    return;
  }

  const symptom = ctx.match[1];
  await ctx.answerCallbackQuery();

  if (symptom === "other") {
    s.step = "symptom_text";
    await ctx.reply("သင်ခံစားနေရတဲ့ လက္ခဏာကို စာရိုက်ပြီး ပြောပြပါ။");
    return;
  }

  s.symptom = symptom;
  s.step = "emergency";

  await ctx.reply(
    "သတိပြုရန် မေးခွန်းတစ်ခုပါ။\n\n" +
    "အသက်ရှူအလွန်ခက်ခြင်း၊ သတိလစ်ခြင်း၊ ရင်ဘတ်အလွန်နာခြင်း၊ " +
    "သွေးအများအပြားထွက်ခြင်းတို့ ရှိပါသလား။",
    {
      reply_markup: new InlineKeyboard()
        .text("ရှိပါတယ်", "emergency:yes")
        .text("မရှိပါ", "emergency:no")
    }
  );
});

// အရေးပေါ်စစ်ဆေးခြင်း
bot.callbackQuery(/^emergency:(yes|no)$/, async (ctx) => {
  const s = sessions.get(ctx.from.id);
  if (!s) {
    await ctx.answerCallbackQuery();
    return;
  }

  await ctx.answerCallbackQuery();

  if (ctx.match[1] === "yes") {
    sessions.delete(ctx.from.id);
    await ctx.reply(
      "⚠️ အရေးပေါ်အခြေအနေ ဖြစ်နိုင်ပါတယ်။\n\n" +
      "အနီးဆုံး အရေးပေါ်ဆေးကုသမှုကို ချက်ချင်းရယူပါ။ " +
      "အခြေအနေပြင်းထန်ပါက 7887 အဖြေကို စောင့်မနေပါနှင့်။"
    );
    return;
  }

  s.step = "duration";
  await ctx.reply(
    "ဒီလက္ခဏာ စတင်ဖြစ်တာ ဘယ်လောက်ကြာပြီလဲ။\n\n" +
    "ဥပမာ - ဒီနေ့မှ၊ ၂ ရက်၊ ၁ ပတ်"
  );
});

// စာဖြင့်ဖြေဆိုခြင်း
bot.on("message:text", async (ctx) => {
  const id = ctx.from.id;
  const s = sessions.get(id);
  if (!s) return;

  const answer = ctx.message.text.trim();

  if (s.step === "symptom_text") {
    s.symptom = answer;
    s.step = "emergency";

    await ctx.reply(
      "သတိပြုရန် မေးခွန်းပါ။ အသက်ရှူအလွန်ခက်ခြင်း၊ သတိလစ်ခြင်း၊ " +
      "ရင်ဘတ်အလွန်နာခြင်း သို့မဟုတ် သွေးအများအပြားထွက်ခြင်း ရှိပါသလား။",
      {
        reply_markup: new InlineKeyboard()
          .text("ရှိပါတယ်", "emergency:yes")
          .text("မရှိပါ", "emergency:no")
      }
    );
    return;
  }

  if (s.step === "duration") {
    s.duration = answer;
    s.step = "location";

    await ctx.reply(
      "ကျေးဇူးတင်ပါတယ်။\n\n" +
      "သင့်အနီးရှိ ဆေးခန်း၊ ဆေးရုံ သို့မဟုတ် ဆေးဆိုင်ကို ရှာဖွေရန် " +
      "သင်နေထိုင်ရာ မြို့နယ် သို့မဟုတ် မြို့အမည်ကို ပြောပြပေးပါ။\n\n" +
      "တိကျတဲ့ လိပ်စာကို မပေးလည်း ရပါတယ်။"
    );
    return;
  }

  if (s.step === "location") {
    s.location = answer;

    await ctx.reply(
      "သင့်အချက်အလက်များကို လက်ခံရရှိပါပြီ။\n\n" +
      "လက္ခဏာ: " + s.symptom + "\n" +
      "ဖြစ်ပွားချိန်: " + s.duration + "\n" +
      "မြို့နယ်/မြို့: " + s.location + "\n\n" +
      "ကျန်းမာရေးအကြံဉာဏ်အတွက် 7887 ကို ဆက်သွယ်နိုင်ပါတယ်။\n" +
      "ဆေးခန်းနှင့် ဆေးဆိုင် လမ်းညွှန်ရန် အတည်ပြုထားသော " +
      "ဒေသခံဝန်ဆောင်မှုစာရင်းကို ချိတ်ဆက်ရန် လိုအပ်ပါသေးတယ်။\n\n" +
      "ဤ Bot သည် ရောဂါအတည်ပြုခြင်း သို့မဟုတ် ဆေးညွှန်းပေးခြင်း မပြုပါ။"
    );

    sessions.delete(id);
  }
});

bot.catch((err) => {
  console.error("Bot error:", err.message);
});

bot.start();
console.log("Htoo Care is running.");
