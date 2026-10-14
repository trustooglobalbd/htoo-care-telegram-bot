
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
const webhookPath = `/telegram-webhook/${TOKEN}`;

const languages = {};
const sessions = {};

const data = {
  my: {
    welcome:
      'မင်္ဂလာပါ 👋 Htoo Care မှ ကြိုဆိုပါတယ်။\n\n' +
      'သင့်ကျန်းမာရေးအတွက် ဘယ်လိုကူညီပေးရမလဲ။ ' +
      'အောက်က Menu ကို ရွေးချယ်နိုင်သလို မေးချင်တာကိုလည်း ရေးပို့နိုင်ပါတယ်။',
    menu: [
      ['🤒 လက္ခဏာစစ်ဆေးရန်'],
      ['📚 ကျန်းမာရေးအချက်အလက်', '📞 7887 ဆက်သွယ်ရန်'],
      ['🌐 English']
    ],
    symptomIntro:
      'ကျန်းမာရေးအခြေအနေကို အဆင့်လိုက် မေးမြန်းပေးပါမယ်။ 😊\n\n' +
      'လက်ရှိ ဘယ်လိုလက္ခဏာ ခံစားနေရပါသလဲ။\n' +
      'ဥပမာ - ခေါင်းကိုက်ခြင်း၊ ဗိုက်နာခြင်း၊ ဖျားခြင်း၊ ဝမ်းလျှောခြင်း။',
    emergency:
      '⚠️ အရေးကြီးတဲ့ မေးခွန်းတစ်ခု အရင်မေးပါမယ်။\n\n' +
      'အောက်ပါအချက်တွေထဲက တစ်ခုခု လက်ရှိရှိပါသလား။\n' +
      '• အသက်ရှူရခက်ခြင်း\n' +
      '• သတိလစ်ခြင်း သို့မဟုတ် တက်ခြင်း\n' +
      '• ရင်ဘတ်အလွန်နာခြင်း\n' +
      '• သွေးအများအပြားထွက်ခြင်း\n' +
      '• ရုတ်တရက် အလွန်ပြင်းထန်သော နာကျင်မှု\n' +
      '• မူးဝေပြီး လဲကျလုနီးပါးဖြစ်ခြင်း သို့မဟုတ် ရေမသောက်နိုင်ခြင်း',
    yes: 'ရှိပါတယ်',
    no: 'မရှိပါ',
    duration: 'ဒီလက္ခဏာ ဘယ်လောက်ကြာပြီလဲ။',
    durations: ['ဒီနေ့မှ', '၁–၂ ရက်', '၃–၇ ရက်', '၇ ရက်ကျော်'],
    severity: 'လက်ရှိအခြေအနေ ဘယ်လိုရှိပါသလဲ။',
    severities: ['ပေါ့ပါးပါတယ်', 'အလယ်အလတ်', 'ပြင်းထန်ပါတယ်', 'ပိုဆိုးလာနေပါတယ်'],
    followup:
      'ကျေးဇူးတင်ပါတယ်။ သင့်အဖြေတွေကို အခြေခံပြီး အထွေထွေလမ်းညွှန်ပေးနိုင်ပါတယ်။ ' +
      'ဒီ Bot က ရောဂါအတည်ပြုခြင်း သို့မဟုတ် ဆေးညွှန်းပေးခြင်း မလုပ်နိုင်ပါဘူး။\n\n' +
      'နောက်တစ်ဆင့် ဘာလုပ်ချင်ပါသလဲ။',
    emergencyResult:
      '⚠️ အရေးပေါ်သတိပေးချက်\n\n' +
      'သင်ဖော်ပြထားတဲ့ လက္ခဏာတွေက အရေးပေါ်ဆေးကုသမှု လိုအပ်နိုင်ပါတယ်။ ' +
      'အနီးဆုံး အရေးပေါ်ဆေးကုသမှုကို ချက်ချင်းရယူပါ။\n\n' +
      '7887 ကို ဆက်သွယ်ဖို့အတွက် အရေးပေါ်ကုသမှုကို မနှောင့်နှေးစေပါနဲ့။',
    topics: [
      ['🍽️ အစာအိမ်နှင့် အစာခြေစနစ်'],
      ['🤕 ခေါင်းကိုက်ခြင်းနှင့် မူးဝေခြင်း'],
      ['🌡️ ဖျားခြင်းနှင့် ချောင်းဆိုးခြင်း'],
      ['💧 ရေဓာတ်နှင့် အာဟာရ'],
      ['🔄 ပင်မ Menu သို့ ပြန်ရန်']
    ],
    topicPrompt: 'ဘယ်ကျန်းမာရေးအကြောင်းအရာကို သိချင်ပါသလဲ။ ရွေးချယ်ပေးပါ။',
    topicAnswers: {
      '🍽️ အစာအိမ်နှင့် အစာခြေစနစ်':
        'အစာခြေစနစ်နဲ့ပတ်သက်ပြီး ဘာကို သိချင်ပါသလဲ။\n\n' +
        '• ဗိုက်နာခြင်း\n• ရင်ပူခြင်း / အချဉ်ပြန်ခြင်း\n' +
        '• လေပွခြင်း / အစာမကြေခြင်း\n• ပျို့ခြင်း / အန်ခြင်း\n\n' +
        'လက်ရှိလက္ခဏာရှိပါက “လက္ခဏာစစ်ဆေးရန်” ကို ရွေးပြီး အဆင့်လိုက် ဖြေဆိုနိုင်ပါတယ်။',
      '🤕 ခေါင်းကိုက်ခြင်းနှင့် မူးဝေခြင်း':
        'ခေါင်းကိုက်ခြင်း သို့မဟုတ် မူးဝေခြင်းအကြောင်း သိချင်ပါသလား။\n\n' +
        'ရုတ်တရက် အလွန်ပြင်းထန်သော ခေါင်းကိုက်ခြင်း၊ ' +
        'မျက်နှာရွဲ့ခြင်း၊ လက်/ခြေတစ်ဖက် အားနည်းခြင်း သို့မဟုတ် စကားပြောရခက်ခြင်းရှိပါက ' +
        'အရေးပေါ်ဆေးကုသမှု ချက်ချင်းရယူပါ။',
      '🌡️ ဖျားခြင်းနှင့် ချောင်းဆိုးခြင်း':
        'ဖျားခြင်းနဲ့ ချောင်းဆိုးခြင်းမှာ ဖြစ်ပွားချိန်၊ အဖျားပြင်းထန်မှုနဲ့ ' +
        'အသက်ရှူရခက်ခြင်း ရှိ/မရှိက အရေးကြီးပါတယ်။\n\n' +
        'အသက်ရှူရခက်ပါက အရေးပေါ်ဆေးကုသမှု ရယူပါ။',
      '💧 ရေဓာတ်နှင့် အာဟာရ':
        'ရေဓာတ်နဲ့ အာဟာရအကြောင်း သိရှိဖို့ ရွေးချယ်ပေးတဲ့အတွက် ကျေးဇူးတင်ပါတယ်။\n\n' +
        'ဝမ်းလျှောခြင်း၊ အန်ခြင်းတို့ကြောင့် ရေဓာတ်ခန်းခြောက်နိုင်ပါတယ်။ ' +
        'ရေမသောက်နိုင်ခြင်း၊ သတိလစ်ခြင်း သို့မဟုတ် လဲကျလုနီးပါးဖြစ်ခြင်းရှိပါက အရေးပေါ်အကူအညီ ရယူပါ။'
    },
    call:
      '📞 7887 Healthcare Call Center\n\n' +
      'ကျန်းမာရေးအကြောင်း ဆရာဝန်နှင့် ဆွေးနွေးရန် 7887 သို့ ဆက်သွယ်နိုင်ပါတယ်။\n' +
      'ခေါ်ဆိုခနှင့် ဝန်ဆောင်မှုရရှိနိုင်မှုကို သင့်ဖုန်းလိုင်းတွင် စစ်ဆေးပါ။\n\n' +
      'အရေးပေါ်လက္ခဏာရှိပါက အရေးပေါ်ဆေးကုသမှုကို ဦးစားပေးပါ။',
    disclaimer:
      'ဤ Bot သည် အထွေထွေကျန်းမာရေးလမ်းညွှန်မှုသာ ပေးနိုင်ပြီး ရောဂါအတည်ပြုခြင်း သို့မဟုတ် ဆရာဝန်၏ ကုသမှုကို အစားထိုးခြင်း မပြုနိုင်ပါ။',
    referral:
      'ဆေးရုံ/ဆေးခန်း လိုအပ်ပါက သင့်မြို့နယ်နှင့် လိုအပ်သော အထူးကုအမျိုးအစားကို ရေးပို့နိုင်ပါတယ်။ ' +
      'လက်ရှိ Bot တွင် ဆေးရုံစာရင်းကို တိုက်ရိုက်ရှာဖွေတဲ့စနစ် မပါဝင်သေးပါ။'
  },

  en: {
    welcome:
      'Hello 👋 Welcome to Htoo Care!\n\n' +
      'How can I help with your health today? Choose an option or type your question.',
    menu: [
      ['🤒 Check Symptoms'],
      ['📚 Health Information', '📞 Contact 7887'],
      ['🌐 မြန်မာဘာသာ']
    ],
    symptomIntro:
      'Let’s go step by step. 😊\n\n' +
      'What symptom are you experiencing? For example: headache, stomach pain, fever, or diarrhoea.',
    emergency:
      '⚠️ First, an important safety question.\n\n' +
      'Do you currently have any of these warning signs?\n' +
      '• Difficulty breathing\n• Loss of consciousness or seizure\n' +
      '• Severe chest pain\n• Heavy bleeding\n' +
      '• Sudden, extremely severe pain\n' +
      '• Near-fainting or inability to drink fluids',
    yes: 'Yes',
    no: 'No',
    duration: 'How long have you had this symptom?',
    durations: ['Started today', '1–2 days', '3–7 days', 'More than 7 days'],
    severity: 'How severe is it now?',
    severities: ['Mild', 'Moderate', 'Severe', 'Getting worse'],
    followup:
      'Thank you. I can provide general guidance based on your answers, but this bot cannot diagnose conditions or prescribe treatment.\n\nWhat would you like to do next?',
    emergencyResult:
      '⚠️ Emergency warning\n\nYour symptoms may require urgent medical care. Seek emergency medical help immediately. Do not delay emergency care to contact 7887.',
    topics: [
      ['🍽️ Digestive Health'],
      ['🤕 Headache and Dizziness'],
      ['🌡️ Fever and Cough'],
      ['💧 Hydration and Nutrition'],
      ['🔄 Back to Main Menu']
    ],
    topicPrompt: 'Which health topic would you like to explore?',
    topicAnswers: {
      '🍽️ Digestive Health':
        'What would you like to learn about?\n\n' +
        '• Stomach pain\n• Heartburn / acid reflux\n' +
        '• Bloating / indigestion\n• Nausea / vomiting\n\n' +
        'If you have symptoms, select Check Symptoms for step-by-step questions.',
      '🤕 Headache and Dizziness':
        'Sudden, extremely severe headache, facial drooping, weakness on one side, or difficulty speaking may be an emergency. Seek emergency medical care immediately if these occur.',
      '🌡️ Fever and Cough':
        'Duration, severity, and breathing difficulty are important when assessing fever or cough. Seek emergency care if breathing is difficult.',
      '💧 Hydration and Nutrition':
        'Diarrhoea and vomiting can cause dehydration. Seek urgent care if you cannot drink, faint, or become severely weak.'
    },
    call:
      '📞 7887 Healthcare Call Center\n\n' +
      'You may contact 7887 to discuss your health with a healthcare professional. Check call charges and service availability with your operator.\n\n' +
      'For emergencies, seek emergency care first.',
    disclaimer:
      'This bot provides general health guidance only. It does not diagnose conditions or replace a qualified healthcare professional.',
    referral:
      'Please provide your township and the type of care you need. This bot cannot yet search a live hospital directory.'
  }
};

function menu(lang) {
  return {
    reply_markup: {
      keyboard: data[lang].menu,
      resize_keyboard: true
    }
  };
}

function choices(items) {
  return {
    reply_markup: {
      keyboard: items.map(item => [item]),
      resize_keyboard: true,
      one_time_keyboard: true
    }
  };
}

function clearSession(id) {
  delete sessions[id];
}

function send(id, text, extra = {}) {
  return bot.sendMessage(id, text, extra).catch(error => {
    console.error('sendMessage failed:', error.message);
  });
}

function startSymptoms(id, lang, symptom = '') {
  sessions[id] = { step: 'emergency', symptom };
  return send(id, data[lang].emergency, choices([
    data[lang].yes,
    data[lang].no
  ]));
}

function normalize(text) {
  return text.toLowerCase().trim();
}

function detectSymptom(text, lang) {
  const t = normalize(text);

  const groups = lang === 'my'
    ? [
        { name: 'ခေါင်းကိုက်ခြင်း', keys: ['ခေါင်းကိုက်', 'ခေါင်းနာ', 'မူးဝေ'] },
        { name: 'အစာအိမ်နှင့် ဗိုက်နာခြင်း', keys: ['အစာအိမ်', 'ဗိုက်နာ', 'ရင်ပူ', 'အစာမကြေ', 'လေပွ', 'အချဉ်ပြန်'] },
        { name: 'ဝမ်းလျှောခြင်း', keys: ['ဝမ်းလျှော', 'ဝမ်းသွား'] },
        { name: 'ဖျားခြင်း', keys: ['ဖျား', 'အဖျား'] },
        { name: 'ချောင်းဆိုးခြင်း', keys: ['ချောင်းဆိုး', 'ချောင်းခြောက်'] },
        { name: 'ပျို့ခြင်းနှင့် အန်ခြင်း', keys: ['ပျို့', 'အန်'] }
      ]
    : [
        { name: 'Headache or dizziness', keys: ['headache', 'head pain', 'dizzy', 'dizziness'] },
        { name: 'Digestive or stomach symptoms', keys: ['stomach', 'stomach pain', 'heartburn', 'indigestion', 'bloating', 'acid reflux'] },
        { name: 'Diarrhoea', keys: ['diarrhea', 'diarrhoea', 'loose stool'] },
        { name: 'Fever', keys: ['fever', 'temperature'] },
        { name: 'Cough', keys: ['cough'] },
        { name: 'Nausea or vomiting', keys: ['nausea', 'vomiting', 'vomit'] }
      ];

  return groups.find(group => group.keys.some(key => t.includes(key)))?.name || '';
}

async function handleMessage(msg) {
  if (!msg.text || msg.chat.type !== 'private') return;

  const id = msg.chat.id;
  const text = msg.text.trim();

  if (text === '/start' || text === '/restart') {
    languages[id] = 'my';
    clearSession(id);
    return send(id, data.my.welcome, menu('my'));
  }

  if (text === '/cancel') {
    clearSession(id);
    const lang = languages[id] || 'my';
    return send(id, data[lang].welcome, menu(lang));
  }

  if (text === '🌐 English') {
    languages[id] = 'en';
    clearSession(id);
    return send(id, data.en.welcome, menu('en'));
  }

  if (text === '🌐 မြန်မာဘာသာ') {
    languages[id] = 'my';
    clearSession(id);
    return send(id, data.my.welcome, menu('my'));
  }

  const lang = languages[id] || 'my';
  const d = data[lang];

  if (text === '🔄 ပင်မ Menu သို့ ပြန်ရန်' ||
      text === '🔄 Back to Main Menu') {
    clearSession(id);
    return send(id, d.welcome, menu(lang));
  }

  if (text === '🤒 လက္ခဏာစစ်ဆေးရန်' ||
      text === '🤒 Check Symptoms') {
    clearSession(id);
    sessions[id] = { step: 'symptom' };
    return send(id, d.symptomIntro, menu(lang));
  }

  if (text === '📚 ကျန်းမာရေးအချက်အလက်' ||
      text === '📚 Health Information') {
    clearSession(id);
    sessions[id] = { step: 'topic' };
    return send(id, d.topicPrompt, choices(
      d.topics.flat().filter(item =>
        item !== '🔄 ပင်မ Menu သို့ ပြန်ရန်' &&
        item !== '🔄 Back to Main Menu'
      )
    ));
  }

  if (text === '📞 7887 ဆက်သွယ်ရန်' ||
      text === '📞 Contact 7887') {
    clearSession(id);
    return send(id, d.call, menu(lang));
  }

  if (text === '🏥 ဆေးရုံ/ဆေးခန်းညွှန်းရန်' ||
      text === '🏥 Hospital Referral') {
    sessions[id] = { step: 'referral' };
    return send(id, d.referral);
  }

  const session = sessions[id];

  // If no conversation is active, detect common health topics.
  if (!session) {
    const symptom = detectSymptom(text, lang);
    if (symptom) {
      sessions[id] = { step: 'emergency', symptom };
      return send(
        id,
        `${lang === 'my' ? 'သင်ဖော်ပြထားတဲ့ လက္ခဏာ' : 'You mentioned'}: ${symptom}\n\n${d.emergency}`,
        choices([d.yes, d.no])
      );
    }

    sessions[id] = { step: 'topic' };
    return send(id, d.topicPrompt, choices(
      d.topics.flat().filter(item =>
        item !== '🔄 ပင်မ Menu သို့ ပြန်ရန်' &&
        item !== '🔄 Back to Main Menu'
      )
    ));
  }

  if (session.step === 'symptom') {
    if (text.length > 400) {
      return send(id, lang === 'my'
        ? 'လက္ခဏာကို အတိုချုံးပြီး ရေးပေးပါ။'
        : 'Please briefly describe your symptom.');
    }

    session.symptom = text;
    session.step = 'emergency';

    return send(id, d.emergency, choices([d.yes, d.no]));
  }

  if (session.step === 'emergency') {
    if (text === d.yes) {
      clearSession(id);
      return send(id, d.emergencyResult, {
        reply_markup: {
          keyboard: [
            ['📞 ' + (lang === 'my' ? '7887 ဆက်သွယ်ရန်' : 'Contact 7887')],
            ['🔄 ' + (lang === 'my' ? 'ပင်မ Menu သို့ ပြန်ရန်' : 'Back to Main Menu')]
          ],
          resize_keyboard: true
        }
      });
    }

    if (text !== d.no) {
      return send(
        id,
        lang === 'my'
          ? 'ကျေးဇူးပြု၍ “ရှိပါတယ်” သို့မဟုတ် “မရှိပါ” ကို ရွေးပါ။'
          : 'Please choose Yes or No.',
        choices([d.yes, d.no])
      );
    }

    session.step = 'duration';
    return send(id, d.duration, choices(d.durations));
  }

  if (session.step === 'duration') {
    if (!d.durations.includes(text)) {
      return send(
        id,
        lang === 'my'
          ? 'အောက်ပါထဲမှ ကြာချိန်ကို ရွေးပေးပါ။'
          : 'Please select a duration.',
        choices(d.durations)
      );
    }

    session.duration = text;
    session.step = 'severity';
    return send(id, d.severity, choices(d.severities));
  }

  if (session.step === 'severity') {
    if (!d.severities.includes(text)) {
      return send(
        id,
        lang === 'my'
          ? 'အောက်ပါထဲမှ အခြေအနေကို ရွေးပေးပါ။'
          : 'Please select the severity.',
        choices(d.severities)
      );
    }

    session.severity = text;
    clearSession(id);

    return send(
      id,
      `${d.followup}\n\n${d.disclaimer}`,
      {
        reply_markup: {
          keyboard: [
            ['📞 ' + (lang === 'my' ? '7887 ဆက်သွယ်ရန်' : 'Contact 7887')],
            ['🤒 ' + (lang === 'my' ? 'လက္ခဏာစစ်ဆေးရန်' : 'Check Symptoms')],
            ['🔄 ' + (lang === 'my' ? 'ပင်မ Menu သို့ ပြန်ရန်' : 'Back to Main Menu')]
          ],
          resize_keyboard: true
        }
      }
    );
  }

  if (session.step === 'topic') {
    if (d.topicAnswers[text]) {
      return send(
        id,
        `${d.topicAnswers[text]}\n\n${d.disclaimer}`,
        {
          reply_markup: {
            keyboard: [
              ['🤒 ' + (lang === 'my' ? 'လက္ခဏာစစ်ဆေးရန်' : 'Check Symptoms')],
              ['📞 ' + (lang === 'my' ? '7887 ဆက်သွယ်ရန်' : 'Contact 7887')],
              ['🔄 ' + (lang === 'my' ? 'ပင်မ Menu သို့ ပြန်ရန်' : 'Back to Main Menu')]
            ],
            resize_keyboard: true
          }
        }
      );
    }

    const symptom = detectSymptom(text, lang);
    if (symptom) {
      sessions[id] = { step: 'emergency', symptom };
      return send(id, d.emergency, choices([d.yes, d.no]));
    }

    return send(
      id,
      lang === 'my'
        ? 'ဒီခေါင်းစဉ်အတွက် အတည်ပြုထားတဲ့ အချက်အလက် မရှိသေးပါ။ လက္ခဏာစစ်ဆေးနိုင်သလို 7887 ကိုလည်း ဆက်သွယ်နိုင်ပါတယ်။'
        : 'Verified information for this topic is not available yet. You can check symptoms or contact 7887.',
      menu(lang)
    );
  }

  if (session.step === 'referral') {
    clearSession(id);
    return send(id, d.referral, menu(lang));
  }

  clearSession(id);
  return send(id, d.welcome, menu(lang));
}

bot.on('message', msg => {
  handleMessage(msg).catch(error => {
    console.error('Message handler error:', error.message);
    if (msg.chat?.id) {
      send(
        msg.chat.id,
        'တောင်းပန်ပါတယ်။ ခဏတာ အမှားတစ်ခု ဖြစ်သွားပါတယ်။ /start ကို ပြန်နှိပ်ပြီး စမ်းကြည့်ပါ။'
      );
    }
  });
});

app.get('/', (req, res) => {
  res.status(200).send('Htoo Care Bot is running.');
});

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.post('*', (req, res) => {
  if (req.path !== webhookPath) return res.sendStatus(404);

  res.sendStatus(200);
  bot.processUpdate(req.body);
});

app.listen(PORT, async () => {
  console.log(`Htoo Care server listening on port ${PORT}`);

  try {
    await bot.setWebHook(`${BASE_URL}${webhookPath}`);
    console.log('Telegram webhook configured.');
  } catch (error) {
    console.error('Webhook setup failed:', error.message);
  }
});
