
const TelegramBot = require('node-telegram-bot-api');
const express = require('express');

const TOKEN = process.env.BOT_TOKEN;
const PORT = process.env.PORT || 3000;
const BASE_URL = process.env.RENDER_EXTERNAL_URL;

if (!TOKEN) {
  throw new Error('BOT_TOKEN is missing');
}

if (!BASE_URL) {
  throw new Error('RENDER_EXTERNAL_URL is missing');
}

const app = express();
app.use(express.json());

const bot = new TelegramBot(TOKEN, {
  polling: false
});

const webhookPath = `/telegram-webhook/${TOKEN}`;

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
    symptoms: 'လက်ရှိခံစားနေရသော လက္ခဏာများကို ရေးပို့ပါ။ ဤ Bot သည် ရောဂါအတည်ပြု မပေးနိုင်ပါ။ အရေးပေါ်လက္ခဏာများရှိပါက ချက်ချင်း ဆေးကုသမှုခံယူပါ။',
    referral: 'ဆေးရုံ သို့မဟုတ် ဆေးခန်း လမ်းညွှန်မှုအတွက် မိမိ၏ မြို့နယ်နှင့် လိုအပ်သော အထူးကုကို ရေးပို့ပါ။',
    call: '7887 ကျန်းမာရေး Hotline ကို ဆက်သွယ်ပါ။ ဖုန်းခေါ်ဆိုမှု အခကြေးငွေနှင့် ရရှိနိုင်မှုကို သင့်ဖုန်းလိုင်းတွင် စစ်ဆေးပါ။'
  },
  en: {
    welcome: 'Welcome to Htoo Care! Please choose a healthcare option below.',
    health: 'Please type the health topic you want to learn about.',
    symptoms: 'Please describe your symptoms. This bot cannot diagnose a disease. Seek urgent medical care if you have emergency symptoms.',
    referral: 'Please provide your township and the type of clinic or specialist you need.',
    call: 'Contact the 7887 healthcare hotline. Check call charges and availability with your operator.'
  }
};

const language = {};

bot.onText(/\/start/, (msg) => {
  language[msg.chat.id] = 'my';
  bot.sendMessage(msg.chat.id, replies.my.welcome, menu);
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

  return bot.sendMessage(
    id,
    lang === 'my'
      ? 'ကျေးဇူးပြု၍ အောက်ပါ Menu မှ ရွေးချယ်ပါ။'
      : 'Please choose an option from the menu.',
    menu
  );
});

app.get('/', (req, res) => {
  res.status(200).send('Htoo Care Bot is running.');
});

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.post('*', (req, res) => {
  if (req.path !== webhookPath) {
    return res.sendStatus(404);
  }

  res.sendStatus(200);
  bot.processUpdate(req.body);
});

app.listen(PORT, async () => {
  console.log(`Htoo Care Bot server listening on port ${PORT}`);

  try {
    await bot.setWebHook(`${BASE_URL}${webhookPath}`);
    console.log('Telegram webhook configured successfully.');
  } catch (error) {
    console.error('Failed to configure Telegram webhook:', error.message);
  }
});
