
const {
  makeUserKey,
  ensureUser,
  setConsent,
  trackEvent,
  getMonthlyReport
} = require('./db');

const TelegramBot = require('node-telegram-bot-api');
const express = require('express');

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const PORT = process.env.PORT || 3000;

if (!TOKEN) {
  console.error('Missing TELEGRAM_BOT_TOKEN environment variable');
  process.exit(1);
}

const bot = new TelegramBot(TOKEN, { polling: true });
const app = express();

// Basic health check for the hosting platform
app.get('/', (_req, res) => {
  res.status(200).send('Htoo Care Telegram Bot is running.');
});

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Htoo Care health server listening on ${PORT}`);
});

// Temporary session data: kept in memory only.
// Data is lost when the process restarts.
const sessions = new Map();

function getSession(id) {
  if (!sessions.has(id)) {
    sessions.set(id, {
      language: 'my',
      step: null,
      profile: {},
    });
  }
  return sessions.get(id);
}

const words = {
  my: {
    welcome: 'မင်္ဂလာပါ။ Htoo Care မှ ကြိုဆိုပါတယ်။',
    choose: 'ဘာသာစကား ရွေးချယ်ပါ။',
    menu: 'အောက်ပါ Menu မှ ရွေးချယ်ပါ။',
    profile: 'ကိုယ်ရေးအချက်အလက် ဖြည့်သွင်းရန်',
    health: 'ကျန်းမာရေးဗဟုသုတ',
    symptoms: 'ခံစားနေရသော လက္ခဏာများ',
    severity: 'အခြေအနေပြင်းထန်မှု',
    call: '7887 ကို ဖုန်းဆက်ရန်',
    back: 'ပင်မ Menu',
    skip: 'ကျော်မည်',
    cancel: 'ပယ်ဖျက်မည်',
    age: 'သင့်အသက်ကို ရိုက်ထည့်ပါ။ ဥပမာ ၂၅။ မဖြေလိုပါက ကျော်နိုင်ပါတယ်။',
    gender: 'ကျား / မ ရွေးချယ်ပါ။',
    marital: 'အိမ်ထောင်ရေး အခြေအနေကို ရွေးချယ်ပါ။',
    saved: 'အချက်အလက်ကို ယာယီ မှတ်သားထားပါပြီ။',
    healthText:
      'ကျန်းမာရေး အသိပညာ\n\n' +
      '• အာဟာရမျှတစွာ စားသုံးပြီး ရေသောက်ပါ။\n' +
      '• လက်ကို ဆပ်ပြာဖြင့် ပုံမှန်ဆေးကြောပါ။\n' +
      '• လိင်နှင့် မျိုးဆက်ပွားကျန်းမာရေးအတွက် ယုံကြည်စိတ်ချရသော ကျန်းမာရေးဝန်ဆောင်မှုကို ရယူပါ။\n' +
      '• ဆေးဝါးကို ကျွမ်းကျင်သူ၏ ညွှန်ကြားချက်အတိုင်း သုံးစွဲပါ။\n\n' +
      'ဤအချက်အလက်သည် အထွေထွေ ပညာပေးချက်ဖြစ်ပြီး ဆရာဝန်၏ အကြံပြုချက်ကို အစားမထိုးပါ။',
    symptomAsk:
      'လက်ရှိ ဘာလက္ခဏာတွေ ခံစားနေရပါသလဲ။ စာဖြင့် ရေးပေးပါ။\n' +
      'ဥပမာ - ဖျားခြင်း၊ ခေါင်းကိုက်ခြင်း၊ ချောင်းဆိုးခြင်း။\n' +
      'ကိုယ်ရေးကိုယ်တာ အချက်အလက်များ မရေးပါနှင့်။',
    severityAsk: 'သင့်အခြေအနေ ဘယ်လောက်ပြင်းထန်ပါသလဲ။',
    mild: 'မပြင်းထန်',
    moderate: 'အလယ်အလတ်',
    severe: 'ပြင်းထန်',
    symptomSaved:
      'သင့်ဖော်ပြချက်ကို ဒီ Bot က ရောဂါအတည်ပြုရန် မသုံးပါ။ လိုအပ်ပါက ကျန်းမာရေးဝန်ထမ်းနှင့် တိုင်ပင်ပါ။',
    emergency:
      '⚠️ အရေးပေါ်သတိပေးချက်\n\n' +
      'အသက်ရှူမဝခြင်း၊ ရင်ဘတ်ပြင်းထန်စွာ နာခြင်း၊ သတိလစ်ခြင်း၊ သွေးထွက်မရပ်ခြင်း သို့မဟုတ် အသက်အန္တရာယ်ရှိနိုင်သော လက္ခဏာများရှိပါက Bot ကို မစောင့်ပါနှင့်။ နီးစပ်ရာ အရေးပေါ်ဆေးကုသမှုကို ချက်ချင်းရယူပါ။',
    callText:
      '📞 7887 ကို ဆက်သွယ်နိုင်ရန် သင့်ဖုန်း၏ Dial Pad မှ 7887 ကို ခေါ်ဆိုပါ။\n\n' +
      'ဤ Bot သည် သင့်အစား ဖုန်းခေါ်ဆိုပေးနိုင်ခြင်း မရှိပါ။ 7887 ၏ ဝန်ဆောင်မှုနှင့် ခေါ်ဆိုခကို သက်ဆိုင်ရာ ဝန်ဆောင်မှုပေးသူထံ အတည်ပြုပါ။',
    genderOptions: ['ကျား', 'မ', 'အခြား', 'မဖြေလိုပါ'],
    maritalOptions: ['အိမ်ထောင်ရှိ', 'အိမ်ထောင်မရှိ', 'မဖြေလိုပါ'],
    profileDone: 'ကိုယ်ရေးအချက်အလက် ဖြည့်သွင်းမှု ပြီးပါပြီ။',
    invalidAge: 'အသက်ကို ၁၂၀ ထက်မပိုသော ကိန်းဂဏန်းဖြင့် ရိုက်ပါ၊ သို့မဟုတ် ကျော်မည်ကို နှိပ်ပါ။',
    cancelled: 'လုပ်ဆောင်မှုကို ပယ်ဖျက်လိုက်ပါပြီ။',
    unknown: 'Menu မှ ရွေးချယ်ပါ၊ သို့မဟုတ် /start ကို နှိပ်ပါ။',
  },
  en: {
    welcome: 'Welcome to Htoo Care.',
    choose: 'Please choose your language.',
    menu: 'Choose an option below.',
    profile: 'Personal information',
    health: 'Health education',
    symptoms: 'My symptoms',
    severity: 'Symptom severity',
    call: 'Call 7887',
    back: 'Main menu',
    skip: 'Skip',
    cancel: 'Cancel',
    age: 'Enter your age (e.g. 25), or skip if you prefer not to answer.',
    gender: 'Choose your gender.',
    marital: 'Choose your marital status.',
    saved: 'Your answer has been stored temporarily.',
    healthText:
      'Health education\n\n' +
      '• Eat a balanced diet and drink enough water.\n' +
      '• Wash your hands regularly.\n' +
      '• Seek reliable sexual and reproductive health services when needed.\n' +
      '• Use medicines according to a qualified professional’s advice.\n\n' +
      'This is general education, not a substitute for professional medical advice.',
    symptomAsk:
      'What symptoms are you experiencing? Please describe them in text.\n' +
      'Example: fever, headache, cough.\n' +
      'Do not include identifying personal information.',
    severityAsk: 'How severe are your symptoms?',
    mild: 'Mild',
    moderate: 'Moderate',
    severe: 'Severe',
    symptomSaved:
      'This bot cannot diagnose your condition. Consult a qualified health professional when needed.',
    emergency:
      '⚠️ EMERGENCY WARNING\n\n' +
      'For difficulty breathing, severe chest pain, loss of consciousness, uncontrolled bleeding, or other potentially life-threatening symptoms, do not wait for this bot. Seek emergency medical care immediately.',
    callText:
      '📞 To contact 7887, open your phone dial pad and call 7887.\n\n' +
      'This bot cannot place a phone call for you. Please confirm the service and any call charges with the service provider.',
    genderOptions: ['Male', 'Female', 'Other', 'Prefer not to say'],
    maritalOptions: ['Married', 'Not married', 'Prefer not to say'],
    profileDone: 'Your profile questions are complete.',
    invalidAge: 'Enter a number from 1 to 120, or press Skip.',
    cancelled: 'Action cancelled.',
    unknown: 'Choose an option from the menu or send /start.',
  },
};

function keyboard(rows) {
  return {
    reply_markup: {
      inline_keyboard: rows.map(row =>
        row.map(item => ({
          text: item.text,
          callback_data: item.data,
        }))
      ),
    },
  };
}

function mainMenu(lang) {
  const w = words[lang];
  return keyboard([
    [{ text: w.profile, data: 'profile' }],
    [{ text: w.health, data: 'health' }],
    [{ text: w.symptoms, data: 'symptoms' }],
    [{ text: w.severity, data: 'severity' }],
    [{ text: w.call, data: 'call7887' }],
    [{ text: lang === 'my' ? '🌐 English' : '🌐 မြန်မာ', data: 'language' }],
  ]);
}

async function showMenu(chatId, session, prefix = '') {
  session.step = null;
  const w = words[session.language];
  await bot.sendMessage(
    chatId,
    [prefix, w.menu].filter(Boolean).join('\n\n'),
    mainMenu(session.language)
  );
}

async function askAge(chatId, session) {
  session.step = 'age';
  await bot.sendMessage(
    chatId,
    words[session.language].age,
    keyboard([
      [{ text: words[session.language].skip, data: 'skip' }],
      [{ text: words[session.language].cancel, data: 'cancel' }],
    ])
  );
}

async function askGender(chatId, session) {
  const w = words[session.language];
  session.step = 'gender';
  await bot.sendMessage(
    chatId,
    w.gender,
    keyboard([
      [{ text: w.genderOptions[0], data: 'gender_0' }],
      [{ text: w.genderOptions[1], data: 'gender_1' }],
      [{ text: w.genderOptions[2], data: 'gender_2' }],
      [{ text: w.genderOptions[3], data: 'gender_3' }],
      [{ text: w.skip, data: 'skip' }],
      [{ text: w.cancel, data: 'cancel' }],
    ])
  );
}

async function askMarital(chatId, session) {
  const w = words[session.language];
  session.step = 'marital';
  await bot.sendMessage(
    chatId,
    w.marital,
    keyboard([
      [{ text: w.maritalOptions[0], data: 'marital_0' }],
      [{ text: w.maritalOptions[1], data: 'marital_1' }],
      [{ text: w.maritalOptions[2], data: 'marital_2' }],
      [{ text: w.skip, data: 'skip' }],
      [{ text: w.cancel, data: 'cancel' }],
    ])
  );
}

async function askSeverity(chatId, session) {
  const w = words[session.language];
  session.step = 'severity';
  await bot.sendMessage(
    chatId,
    w.severityAsk,
    keyboard([
      [{ text: w.mild, data: 'severity_mild' }],
      [{ text: w.moderate, data: 'severity_moderate' }],
      [{ text: w.severe, data: 'severity_severe' }],
      [{ text: w.cancel, data: 'cancel' }],
    ])
  );
}

bot.onText(/^\/start$/, async msg => {
  const session = getSession(msg.chat.id);
  session.step = null;
  await bot.sendMessage(
    msg.chat.id,
    `${words[session.language].welcome}\n\n${words[session.language].choose}`,
    keyboard([
      [{ text: 'မြန်မာ 🇲🇲', data: 'lang_my' }],
      [{ text: 'English 🇬🇧', data: 'lang_en' }],
    ])
  );
});

bot.onText(/^\/menu$/, async msg => {
  const session = getSession(msg.chat.id);
  await showMenu(msg.chat.id, session);
});

bot.onText(/^\/cancel$/, async msg => {
  const session = getSession(msg.chat.id);
  session.step = null;
  await showMenu(msg.chat.id, session, words[session.language].cancelled);
});

bot.on('callback_query', async query => {
  const chatId = query.message?.chat.id;
  if (!chatId) return;

  const session = getSession(chatId);
  const w = words[session.language];
  const data = query.data;

  try {
    await bot.answerCallbackQuery(query.id);

    if (data === 'lang_my' || data === 'lang_en') {
      session.language = data === 'lang_my' ? 'my' : 'en';
      await showMenu(chatId, session, words[session.language].welcome);
      return;
    }

    if (data === 'language') {
      await bot.sendMessage(
        chatId,
        'Choose language / ဘာသာစကား ရွေးပါ။',
        keyboard([
          [{ text: 'မြန်မာ 🇲🇲', data: 'lang_my' }],
          [{ text: 'English 🇬🇧', data: 'lang_en' }],
        ])
      );
      return;
    }

    if (data === 'profile') {
      session.profile = {};
      await askAge(chatId, session);
      return;
    }

    if (data === 'skip') {
      if (session.step === 'age') {
        session.profile.age = null;
        await askGender(chatId, session);
      } else if (session.step === 'gender') {
        session.profile.gender = null;
        await askMarital(chatId, session);
      } else if (session.step === 'marital') {
        session.profile.marital = null;
        session.step = null;
        await showMenu(chatId, session, w.profileDone);
      } else {
        session.step = null;
        await showMenu(chatId, session);
      }
      return;
    }

    if (data.startsWith('gender_')) {
      if (session.step !== 'gender') return;
      session.profile.gender = w.genderOptions[Number(data.slice(7))];
      await bot.sendMessage(chatId, w.saved);
      await askMarital(chatId, session);
      return;
    }

    if (data.startsWith('marital_')) {
      if (session.step !== 'marital') return;
      session.profile.marital = w.maritalOptions[Number(data.slice(8))];
      session.step = null;
      await showMenu(chatId, session, w.profileDone);
      return;
    }

    if (data === 'health') {
      await bot.sendMessage(chatId, w.healthText, {
        ...keyboard([[{ text: w.back, data: 'menu' }]]),
      });
      return;
    }

    if (data === 'symptoms') {
      session.step = 'symptoms';
      await bot.sendMessage(
        chatId,
        w.symptomAsk,
        keyboard([[{ text: w.cancel, data: 'cancel' }]])
      );
      return;
    }

    if (data === 'severity') {
      await bot.sendMessage(chatId, w.emergency);
      await askSeverity(chatId, session);
      return;
    }

    if (data.startsWith('severity_')) {
      const severity = data.slice(9);
      if (!['mild', 'moderate', 'severe'].includes(severity)) return;
      session.profile.severity = severity;
      session.step = null;

      if (severity === 'severe') {
        await bot.sendMessage(chatId, w.emergency);
      }

      await showMenu(chatId, session, w.symptomSaved);
      return;
    }

    if (data === 'call7887') {
      await bot.sendMessage(
        chatId,
        w.callText,
        keyboard([[{ text: w.back, data: 'menu' }]])
      );
      return;
    }

    if (data === 'cancel' || data === 'menu') {
      session.step = null;
      await showMenu(
        chatId,
        session,
        data === 'cancel' ? w.cancelled : ''
      );
      return;
    }
  } catch (error) {
    console.error('Callback handling failed:', error.message);
  }
});

// Handle user text only when the bot is asking a question.
// No echo handler is used.
bot.on('message', async msg => {
  if (!msg.text || msg.text.startsWith('/')) return;

  const chatId = msg.chat.id;
  const session = getSession(chatId);
  const w = words[session.language];
  const text = msg.text.trim();

  try {
    if (session.step === 'age') {
      const age = Number(text);
      if (!Number.isInteger(age) || age < 1 || age > 120) {
        await bot.sendMessage(chatId, w.invalidAge);
        return;
      }
      session.profile.age = age;
      await bot.sendMessage(chatId, w.saved);
      await askGender(chatId, session);
      return;
    }

    if (session.step === 'symptoms') {
      if (text.length > 1500) {
        await bot.sendMessage(
          chatId,
          session.language === 'my'
            ? 'စာသားကို အတိုချုံးပြီး ပြန်ပို့ပေးပါ။'
            : 'Please shorten your message to 1500 characters or fewer.'
        );
        return;
      }

      // Do not log or persist symptom text.
      session.profile.symptoms = text;
      await bot.sendMessage(chatId, w.symptomSaved);
      await bot.sendMessage(chatId, w.emergency);
      await askSeverity(chatId, session);
      return;
    }

    await bot.sendMessage(chatId, w.unknown, mainMenu(session.language));
  } catch (error) {
    console.error('Message handling failed:', error.message);
  }
});

bot.on('polling_error', error => {
  console.error('Telegram polling error:', error.message);
});

process.on('unhandledRejection', error => {
  console.error('Unhandled rejection:', error);
});
