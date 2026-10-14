
const TelegramBot = require('node-telegram-bot-api');

const TOKEN = process.env.BOT_TOKEN;

if (!TOKEN) {
  throw new Error('BOT_TOKEN is missing');
}

const bot = new TelegramBot(TOKEN, {
  polling: true
});

const menu = {
  reply_markup: {
    keyboard: [
      ['🩺 Health Information', '🤒 Symptoms'],
      ['🏥 Hospital Referral', '📞 Call 7887'],
      ['🌐 မြန်မာဘာသာ', '🇬🇧 English']
    ],
    resize_keyboard: true
  }
};

const replies = {
  my: {
    welcome: 'မင်္ဂလာပါ။ Htoo Care မှ ကြိုဆိုပါတယ်။ ကျန်းမာရေးအတွက် အောက်ပါ Menu ကို ရွေးချယ်ပါ။',
    health: 'ကျန်းမာရေးအချက်အလက်အတွက် မိမိသိလိုသော အကြောင်းအရာကို ရေးပို့ပါ။',
    symptoms: 'လက်ရှိခံစားနေရသော လက္ခဏာများကို ရေးပို့ပါ။ ဤ Bot သည် ရောဂါအတည်ပြု မပေးနိုင်ပါ။',
    referral: 'ဆေးရုံ သို့မဟုတ် ဆေးခန်း လမ်းညွှန်မှုအတွက် မြို့နယ်နှင့် လိုအပ်သော အထူးကုကို ရေးပို့ပါ။',
    call: '7887 ကျန်းမာရေး Hotline ကို ဆက်သွယ်ပါ။ ဖုန်းခေါ်ဆိုမှု အခကြေးငွေနှင့် ရရှိနိုင်မှုကို သင့်ဖုန်းလိုင်းတွင် စစ်ဆေးပါ။'
  },
  en: {
    welcome: 'Welcome to Htoo Care! Please choose a healthcare option below.',
    health: 'Please type the health topic you want to learn about.',
    symptoms: 'Please describe your symptoms. This bot cannot diagnose a disease.',
    referral: 'Please provide your township and the type of clinic or specialist you need.',
    call: 'Contact the 7887 healthcare hotline. Check call charges and availability with your operator.'
  }
};

const language = {};

bot.onText(/\/start/, (msg) => {
  language[msg.chat.id] = 'my';
  bot.sendMessage(
    msg.chat.id,
    replies.my.welcome,
    menu
  );
});

bot.on('message', (msg) => {
  if (!msg.text || msg.text.startsWith('/')) return;

  const id = msg.chat.id;
  const text = msg.text.trim();

  if (text === '🌐 မြန်မာဘာသာ') {
    language[id] = 'my';
    return bot.sendMessage(id, replies.my.welcome, menu);
  }

  if (text === '🇬🇧 English') {
    language[id] = 'en';
    return bot.sendMessage(id, replies.en.welcome, menu);
  }

  const lang = language[id] || 'my';
  const r = replies[lang];

  if (text.includes('Health Information')) {
    return bot.sendMessage(id, r.health);
  }

  if (text.includes('Symptoms')) {
    return bot.sendMessage(id, r.symptoms);
  }

  if (text.includes('Hospital Referral')) {
    return bot.sendMessage(id, r.referral);
  }

  if (text.includes('Call 7887')) {
    return bot.sendMessage(id, r.call);
  }

  if (text.includes('ကျန်းမာရေးအချက်အလက်')) {
    return bot.sendMessage(id, replies.my.health);
  }

  if (text.includes('လက္ခဏာ')) {
    return bot.sendMessage(id, replies.my.symptoms);
  }

  if (text.includes('ဆေးရုံ')) {
    return bot.sendMessage(id, replies.my.referral);
  }

  if (text.includes('7887')) {
    return bot.sendMessage(id, replies.my.call);
  }

  bot.sendMessage(
    id,
    lang === 'my'
      ? 'ကျေးဇူးပြု၍ အောက်ပါ Menu မှ ရွေးချယ်ပါ။'
      : 'Please choose an option from the menu.',
    menu
  );
});

console.log('Htoo Care Bot is running!');
