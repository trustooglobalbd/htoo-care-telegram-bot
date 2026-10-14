
const TelegramBot = require('node-telegram-bot-api');
const express = require('express');

const TOKEN = process.env.BOT_TOKEN;
const PORT = process.env.PORT || 3000;
const BASE_URL = process.env.RENDER_EXTERNAL_URL;

if (!TOKEN) throw new Error('BOT_TOKEN is missing');
if (!BASE_URL) throw new Error('RENDER_EXTERNAL_URL is missing');

const app = express();
app.use(express.json());

const bot = new TelegramBot(TOKEN, { polling: false });

// Keep the existing bot and use Telegram webhook.
const webhookPath = `/telegram-webhook/${TOKEN}`;
const languages = {};
const sessions = {};

const menus = {
  my: {
    keyboard: [
      ['🩺 ကျန်းမာရေးအချက်အလက်', '🤒 လက္ခဏာစစ်ဆေးရန်'],
      ['🏥 ဆေးရုံ/ဆေးခန်းညွှန်းရန်', '📞 7887 ဆက်သွယ်ရန်'],
      ['🇬🇧 English']
    ],
    resize_keyboard: true
  },
  en: {
    keyboard: [
      ['🩺 Health Information', '🤒 Check Symptoms'],
      ['🏥 Hospital Referral', '📞 Contact 7887'],
      ['🌐 မြန်မာဘာသာ']
    ],
    resize_keyboard: true
  }
};

const messages = {
  my: {
    welcome:
      'မင်္ဂလာပါ။ Htoo Care မှ ကြိုဆိုပါတယ်။\n\n' +
      'အောက်ပါ Menu မှ ရွေးချယ်နိုင်ပါတယ်။',
    health:
      'ဘယ်ကျန်းမာရေးအကြောင်းအရာကို သိလိုပါသလဲ။\n' +
      'မေးခွန်းကို ရေးပို့ပါ။ အချက်အလက်များသည် အထွေထွေလမ်းညွှန်မှုသာ ဖြစ်ပါတယ်။',
    symptomStart:
      'လက်ရှိ ခံစားနေရတဲ့ လက္ခဏာကို ရေးပို့ပေးပါ။\n' +
      'ဥပမာ - ဝမ်းလျှောခြင်း၊ ဖျားခြင်း၊ ခေါင်းကိုက်ခြင်း။\n\n' +
      'ဤ Bot သည် ရောဂါအတည်မပြုနိုင်ပါ။',
    duration:
      'ဒီလက္ခဏာ ဘယ်လောက်ကြာပြီလဲ။',
    severity:
      'လက်ရှိအခြေအနေ ဘယ်လိုရှိပါသလဲ။',
    emergency:
      'အရေးပေါ်အန္တရာယ် လက္ခဏာတစ်ခုခု ရှိပါသလား။\n\n' +
      'ဥပမာ - အသက်ရှူရခက်ခြင်း၊ သတိလစ်ခြင်း၊ ' +
      'ရင်ဘတ်အလွန်နာခြင်း၊ သွေးအများအပြားထွက်ခြင်း၊ ' +
      'ပြင်းထန်စွာနာကျင်ခြင်း သို့မဟုတ် ရေမသောက်နိုင်ဘဲ ' +
      'မူးဝေ/လဲကျလုနီးပါးဖြစ်ခြင်း။',
    emergencyYes:
      '⚠️ အရေးပေါ်သတိပေးချက်\n\n' +
      'သင်ဖော်ပြထားသော အခြေအနေသည် အရေးပေါ်စစ်ဆေးကုသမှု လိုအပ်နိုင်ပါတယ်။ ' +
      'အနီးဆုံး အရေးပေါ်ဆေးကုသမှုကို ချက်ချင်းရယူပါ။\n\n' +
      '7887 ကို ဆက်သွယ်ခြင်းကြောင့် အရေးပေါ်ကုသမှု မနှောင့်နှေးစေပါနှင့်။',
    emergencyNo:
      'သတင်းအချက်အလက် မျှဝေပေးတဲ့အတွက် ကျေးဇူးတင်ပါတယ်။\n\n' +
      'ဤအဖြေများဖြင့် ရောဂါအတည်မပြုနိုင်ပါ။ ' +
      'လက္ခဏာများ ပိုဆိုးလာခြင်း သို့မဟုတ် စိုးရိမ်ရခြင်းရှိပါက ဆရာဝန်နှင့် ဆွေးနွေးပါ။',
    referral:
      'ဆေးရုံ/ဆေးခန်း ရှာဖွေရန် မြို့နယ်နှင့် လိုအပ်သော ဆေးကုသမှုအမျိုးအစားကို ရေးပို့ပါ။\n' +
      'ဤ Bot သည် လက်ရှိတွင် ဆေးရုံစာရင်းကို အလိုအလျောက် မရှာဖွေနိုင်သေးပါ။',
    call:
      '📞 7887 Healthcare Call Center\n\n' +
      'ဆရာဝန်နှင့် ကျန်းမာရေးအကြောင်း ဆွေးနွေးရန် 7887 သို့ ဆက်သွယ်နိုင်ပါတယ်။\n' +
      'ခေါ်ဆိုခနှင့် ဝန်ဆောင်မှုရရှိနိုင်မှုကို သင့်ဖုန်းလိုင်းတွင် စစ်ဆေးပါ။\n\n' +
      'အရေးပေါ်အခြေအနေရှိပါက အနီးဆုံး အရေးပေါ်ဆေးကုသမှုကို ဦးစားပေးပါ။',
    restart: 'လုပ်ငန်းစဉ်ကို ပြန်စပါမယ်။ အောက်ပါ Menu မှ ရွေးချယ်ပါ။',
    unknown: 'ကျေးဇူးပြု၍ အောက်ပါ Menu မှ ရွေးချယ်ပါ။',
    durations: ['ဒီနေ့မှ', '၁–၂ ရက်', '၃–၇ ရက်', '၇ ရက်ကျော်'],
    severities: ['ပေါ့ပါး', 'အလယ်အလတ်', 'ပြင်းထန်', 'ပိုဆိုးလာနေ'],
    yesNo: ['ရှိပါတယ်', 'မရှိပါ'],
    endMenu: [['📞 7887 ဆက်သွယ်ရန်', '🔄 ပြန်စရန်']]
  },
  en: {
    welcome: 'Welcome to Htoo Care! Please choose an option below.',
    health: 'What health topic would you like to learn about? Type your question. Information is general guidance only.',
    symptomStart: 'Please describe your current symptom. Example: diarrhoea, fever, or headache. This bot cannot diagnose diseases.',
    duration: 'How long have you had this symptom?',
    severity: 'How severe is your condition now?',
    emergency: 'Do you have any emergency warning signs, such as difficulty breathing, loss of consciousness, severe chest pain, heavy bleeding, severe pain, or inability to drink with near-fainting?',
    emergencyYes: '⚠️ Emergency warning\n\nYour symptoms may need urgent assessment. Seek emergency medical care immediately. Do not delay emergency care to contact 7887.',
    emergencyNo: 'Thank you for sharing. These answers cannot confirm a diagnosis. Contact a healthcare professional if symptoms worsen or concern you.',
    referral: 'Please type your township and the type of care you need. This bot cannot yet search a live hospital directory.',
    call: '📞 7887 Healthcare Call Center\n\nYou may contact 7887 to discuss your health with a healthcare professional. Check call charges and availability with your operator. For emergencies, seek emergency care first.',
    restart: 'Let’s start again. Please choose an option below.',
    unknown: 'Please choose an option from the menu.',
    durations: ['Started today', '1–2 days', '3–7 days', 'More than 7 days'],
    severities: ['Mild', 'Moderate', 'Severe', 'Getting worse'],
    yesNo: ['Yes, I do', 'No'],
    endMenu: [['📞 Contact 7887', '🔄 Start again']]
  }
};

function keyboard(options, lang) {
  return {
    reply_markup: {
      keyboard: options.map(item => [item]),
      resize_keyboard: true,
      one_time_keyboard: true
    }
  };
}

function showMenu(lang) {
  return { reply_markup: menus[lang] };
}

function send(chatId, text, extra = {}) {
  return bot.sendMessage(chatId, text, extra).catch(err => {
    console.error('Telegram sendMessage error:', err.message);
  });
}

function resetSession(chatId) {
  delete sessions[chatId];
}

function isEmergencyAnswer(text, lang) {
  return lang === 'my'
    ? text === 'ရှိပါတယ်'
    : text === 'Yes, I do';
}

bot.on('message', async (msg) => {
  if (!msg.text) return;

  const id = msg.chat.id;
  const text = msg.text.trim();

  if (text === '/start') {
    languages[id] = 'my';
    resetSession(id);
    return send(id, messages.my.welcome, showMenu('my'));
  }

  if (text === '/cancel' || text === '/restart') {
    resetSession(id);
    const lang = languages[id] || 'my';
    return send(id, messages[lang].restart, showMenu(lang));
  }

  let lang = languages[id] || 'my';

  // Language selection
  if (text === '🇬🇧 English') {
    languages[id] = 'en';
    resetSession(id);
    return send(id, messages.en.welcome, showMenu('en'));
  }

  if (text === '🌐 မြန်မာဘာသာ') {
    languages[id] = 'my';
    resetSession(id);
    return send(id, messages.my.welcome, showMenu('my'));
  }

  lang = languages[id] || 'my';
  const m = messages[lang];

  // Main menu actions
  if (text === '🩺 ကျန်းမာရေးအချက်အလက်' || text === '🩺 Health Information') {
    sessions[id] = { step: 'health_topic' };
    return send(id, m.health);
  }

  if (text === '🤒 လက္ခဏာစစ်ဆေးရန်' || text === '🤒 Check Symptoms' ||
      text === '🤒 Symptoms') {
    sessions[id] = { step: 'symptom' };
    return send(id, m.symptomStart);
  }

  if (text === '🏥 ဆေးရုံ/ဆေးခန်းညွှန်းရန်' || text === '🏥 Hospital Referral') {
    sessions[id] = { step: 'referral' };
    return send(id, m.referral);
  }

  if (text === '📞 7887 ဆက်သွယ်ရန်' || text === '📞 Contact 7887' ||
      text === '📞 Call 7887') {
    resetSession(id);
    return send(id, m.call, showMenu(lang));
  }

  if (text === '🔄 ပြန်စရန်' || text === '🔄 Start again') {
    resetSession(id);
    return send(id, m.welcome, showMenu(lang));
  }

  const session = sessions[id];

  // No active conversation: do not treat random text as a symptom automatically.
  if (!session) {
    return send(id, m.unknown, showMenu(lang));
  }

  // Symptom intake, one question at a time.
  if (session.step === 'symptom') {
    if (text.length > 500) {
      return send(id, lang === 'my'
        ? 'စာသားကို အတိုချုံးပြီး လက္ခဏာကို ပြန်ရေးပေးပါ။'
        : 'Please shorten your message and describe your symptom.');
    }

    session.symptom = text;
    session.step = 'duration';

    return send(id, m.duration, keyboard(m.durations, lang));
  }

  if (session.step === 'duration') {
    if (!m.durations.includes(text)) {
      return send(id, lang === 'my'
        ? 'အောက်ပါ ရွေးချယ်စရာများထဲမှ တစ်ခုကို ရွေးပေးပါ။'
        : 'Please choose one of the options below.',
        keyboard(m.durations, lang));
    }

    session.duration = text;
    session.step = 'severity';

    return send(id, m.severity, keyboard(m.severities, lang));
  }

  if (session.step === 'severity') {
    if (!m.severities.includes(text)) {
      return send(id, lang === 'my'
        ? 'အောက်ပါ ရွေးချယ်စရာများထဲမှ တစ်ခုကို ရွေးပေးပါ။'
        : 'Please choose one of the options below.',
        keyboard(m.severities, lang));
    }

    session.severity = text;
    session.step = 'emergency';

    return send(id, m.emergency, keyboard(m.yesNo, lang));
  }

  if (session.step === 'emergency') {
    if (!m.yesNo.includes(text)) {
      return send(id, lang === 'my'
        ? 'ကျေးဇူးပြု၍ “ရှိပါတယ်” သို့မဟုတ် “မရှိပါ” ကို ရွေးပေးပါ။'
        : 'Please choose Yes or No.',
        keyboard(m.yesNo, lang));
    }

    const hasEmergency = isEmergencyAnswer(text, lang);

    // Do not keep the symptom details after displaying the result.
    const result = hasEmergency ? m.emergencyYes : m.emergencyNo;
    resetSession(id);

    return send(id, result, {
      reply_markup: {
        keyboard: m.endMenu,
        resize_keyboard: true
      }
    });
  }

  if (session.step === 'health_topic') {
    resetSession(id);
    return send(id, lang === 'my'
      ? 'သင့်မေးခွန်းကို လက်ခံရရှိပါတယ်။ ဤ Bot တွင် ကျန်းမာရေးအကြောင်းအရာအားလုံးအတွက် အတည်ပြုထားသော အဖြေများ မပါဝင်သေးပါ။ လိုအပ်ပါက ဆရာဝန်နှင့် ဆွေးနွေးရန် 7887 ကို ဆက်သွယ်ပါ။'
      : 'Your question has been received. This bot does not yet have verified answers for every health topic. Contact 7887 to discuss your concern with a healthcare professional.',
      showMenu(lang));
  }

  if (session.step === 'referral') {
    resetSession(id);
    return send(id, lang === 'my'
      ? 'အချက်အလက်ပေးတဲ့အတွက် ကျေးဇူးတင်ပါတယ်။ ဤ Bot တွင် အတည်ပြုထားသော ဆေးရုံ/ဆေးခန်းစာရင်းကို အလိုအလျောက် ရှာဖွေနိုင်သေးခြင်း မရှိပါ။ 7887 သို့ ဆက်သွယ်ပြီး အကူအညီတောင်းနိုင်ပါတယ်။'
      : 'Thank you. This bot cannot yet search a verified hospital or clinic directory. You may contact 7887 for assistance.',
      showMenu(lang));
  }
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
  console.log(`Htoo Care server listening on port ${PORT}`);

  try {
    await bot.setWebHook(`${BASE_URL}${webhookPath}`);
    console.log('Telegram webhook configured.');
  } catch (err) {
    console.error('Webhook setup failed:', err.message);
  }
});
