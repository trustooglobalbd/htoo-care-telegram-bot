
'use strict';

const express = require('express');
const TelegramBot = require('node-telegram-bot-api');

const app = express();
const PORT = Number(process.env.PORT) || 8080;

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL =
  process.env.GEMINI_MODEL || 'gemini-2.5-flash';

let bot = null;
let pollingStarted = false;

// Track users who selected Ask a Health Question.
const waitingForQuestion = new Set();
const userLanguages = new Map();

// ------------------------------
// Web server
// ------------------------------

app.get('/', (_req, res) => {
  res.status(200).send('Htoo Care Telegram Bot is running.');
});

app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'Htoo Care Telegram Bot',
    telegramPolling: pollingStarted
  });
});

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Htoo Care web server running on port ${PORT}`);
});

// ------------------------------
// Menu
// ------------------------------

function mainMenu() {
  return {
    reply_markup: {
      inline_keyboard: [
        [
          { text: 'Health Information', callback_data: 'health' }
        ],
        [
          { text: 'SRHR Topics', callback_data: 'srhr' }
        ],
        [
          { text: 'Ask a Health Question', callback_data: 'ask' }
        ],
        [
          { text: 'Call 7887', callback_data: 'call7887' }
        ],
        [
          {
            text: 'Overseas Myanmar Health Support',
            callback_data: 'overseas'
          }
        ],
        [
          { text: 'About Htoo Care', callback_data: 'about' }
        ],
        [
          { text: 'Change Language', callback_data: 'language' }
        ]
      ]
    }
  };
}

async function sendMainMenu(chatId, language = 'en') {
  const text = language === 'my'
    ? 'မင်္ဂလာပါ။ Htoo Care မှ ကြိုဆိုပါတယ်။\n\nအောက်ပါ Menu မှတစ်ခုကို ရွေးချယ်ပါ။'
    : 'Welcome to Htoo Care!\n\nPlease select an option below.';

  await bot.sendMessage(chatId, text, mainMenu());
}

// ------------------------------
// Basic health information
// ------------------------------

const healthTopics = {
  general: {
    en: 'General health: Maintain a balanced diet, drink safe water, get enough rest, and seek qualified medical advice when symptoms persist or worsen.',
    my: 'အထွေထွေကျန်းမာရေး — အာဟာရမျှတစွာစားပါ၊ သန့်ရှင်းသောရေသောက်ပါ၊ အနားယူပါ။ လက္ခဏာများ မသက်သာခြင်း သို့မဟုတ် ပိုဆိုးလာခြင်းရှိပါက ကျန်းမာရေးဝန်ထမ်းထံ အကြံဉာဏ်ရယူပါ။'
  },
  menstrual: {
    en: 'Menstrual health: Track your menstrual cycle and use clean menstrual products. Seek medical advice for unusually heavy bleeding, severe pain, or concerning changes.',
    my: 'ရာသီသွေးဆင်းခြင်း — ရာသီစက်ဝန်းကို မှတ်သားထားပြီး သန့်ရှင်းသော ရာသီသုံးပစ္စည်းများ အသုံးပြုပါ။ သွေးအလွန်များခြင်း၊ နာကျင်မှု ပြင်းထန်ခြင်း သို့မဟုတ် ပုံမှန်မဟုတ်သော ပြောင်းလဲမှုများရှိပါက ဆေးဘက်ဆိုင်ရာ အကြံဉာဏ်ရယူပါ။'
  },
  pregnancy: {
    en: 'Pregnancy: Attend antenatal care with a qualified health professional. Heavy bleeding, severe abdominal pain, difficulty breathing, or convulsions require urgent medical attention.',
    my: 'ကိုယ်ဝန်ဆောင်ကျန်းမာရေး — ကျွမ်းကျင်သော ကျန်းမာရေးဝန်ထမ်းထံ ပုံမှန်ကိုယ်ဝန်စောင့်ရှောက်မှု ခံယူပါ။ သွေးအများအပြားဆင်းခြင်း၊ ဗိုက်အလွန်နာခြင်း၊ အသက်ရှူခက်ခြင်း သို့မဟုတ် တက်ခြင်းရှိပါက အရေးပေါ်ဆေးကုသမှု ခံယူပါ။'
  },
  family: {
    en: 'Family planning: Contraceptive options differ in effectiveness, benefits, and risks. A qualified health professional can help you choose a suitable method.',
    my: 'သားဆက်ခြားခြင်း — သားဆက်ခြားနည်းများသည် ထိရောက်မှု၊ အကျိုးကျေးဇူးနှင့် ဘေးထွက်ဆိုးကျိုးများ မတူညီပါ။ သင့်တော်သောနည်းလမ်းကို ရွေးချယ်ရန် ကျန်းမာရေးဝန်ထမ်းနှင့် တိုင်ပင်ပါ။'
  },
  sti: {
    en: 'Sexual health: Some sexually transmitted infections have no obvious symptoms. Testing and advice from a qualified health professional can help protect your health.',
    my: 'လိင်ကျန်းမာရေး — လိင်မှတစ်ဆင့် ကူးစက်သောရောဂါအချို့တွင် သိသာသောလက္ခဏာ မရှိနိုင်ပါ။ စစ်ဆေးမှုခံယူခြင်းနှင့် ကျန်းမာရေးဝန်ထမ်းထံ တိုင်ပင်ခြင်းက အထောက်အကူပြုနိုင်ပါသည်။'
  }
};

function getText(key, language) {
  const item = healthTopics[key];
  if (!item) return 'Information is not available yet.';
  return item[language] || item.en;
}

function topicMenu(language) {
  const labels = language === 'my'
    ? [
        ['အထွေထွေကျန်းမာရေး', 'general'],
        ['ရာသီသွေးဆင်းခြင်း', 'menstrual'],
        ['ကိုယ်ဝန်ဆောင်ကျန်းမာရေး', 'pregnancy'],
        ['သားဆက်ခြားခြင်း', 'family'],
        ['လိင်ကျန်းမာရေး', 'sti']
      ]
    : [
        ['General Health', 'general'],
        ['Menstrual Health', 'menstrual'],
        ['Pregnancy', 'pregnancy'],
        ['Family Planning', 'family'],
        ['Sexual Health', 'sti']
      ];

  return {
    reply_markup: {
      inline_keyboard: [
        ...labels.map(([text, key]) => [
          { text, callback_data: `topic_${key}` }
        ]),
        [{ text: '⬅ Main Menu', callback_data: 'menu' }]
      ]
    }
  };
}

// ------------------------------
// Gemini health question support
// ------------------------------

async function askGemini(question) {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not configured.');
  }

  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/` +
    `${encodeURIComponent(GEMINI_MODEL)}:generateContent`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': GEMINI_API_KEY
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{
            text:
              'You provide general health education only. ' +
              'Do not diagnose, prescribe medicines, or replace a clinician. ' +
              'Encourage professional medical care when appropriate. ' +
              'If symptoms may indicate an emergency, advise urgent local medical care. ' +
              'Reply in the same language as the user. ' +
              'Keep the answer clear, respectful, and concise.'
          }]
        },
        contents: [{
          role: 'user',
          parts: [{ text: question }]
        }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 700
        }
      }),
      signal: controller.signal
    });

    console.log('Gemini HTTP status:', response.status);

    const data = await response.json();

    if (!response.ok) {
      console.error(
        'Gemini request failed:',
        response.status,
        JSON.stringify(data).slice(0, 1200)
      );
      throw new Error(`Gemini API returned HTTP ${response.status}`);
    }

    const answer = (data.candidates?.[0]?.content?.parts || [])
      .map(part => part.text || '')
      .join('\n')
      .trim();

    if (!answer) {
      throw new Error('Gemini returned an empty answer.');
    }

    return answer;
  } finally {
    clearTimeout(timeout);
  }
}

// ------------------------------
// Telegram initialization
// ------------------------------

async function startTelegram() {
  if (!TOKEN) {
    console.error(
      'TELEGRAM STARTUP ERROR: TELEGRAM_BOT_TOKEN is missing.'
    );
    return;
  }

  try {
    bot = new TelegramBot(TOKEN, { polling: false });

    bot.on('polling_error', (error) => {
      console.error(
        'TELEGRAM POLLING ERROR:',
        error.message
      );
    });

    bot.on('error', (error) => {
      console.error('TELEGRAM BOT ERROR:', error.message);
    });

    // Log incoming messages for troubleshooting.
    bot.on('message', (msg) => {
      console.log(
        '[TELEGRAM INCOMING]',
        'chat:', msg.chat.id,
        'text:', JSON.stringify(msg.text || '')
      );
    });

    // /start and /menu
    bot.onText(/^\/start(?:@\w+)?(?:\s.*)?$/i, async (msg) => {
      try {
        waitingForQuestion.delete(msg.chat.id);
        await sendMainMenu(
          msg.chat.id,
          userLanguages.get(msg.chat.id) || 'en'
        );
      } catch (error) {
        console.error('/start handler error:', error.message);
      }
    });

    bot.onText(/^\/menu(?:@\w+)?$/i, async (msg) => {
      try {
        waitingForQuestion.delete(msg.chat.id);
        await sendMainMenu(
          msg.chat.id,
          userLanguages.get(msg.chat.id) || 'en'
        );
      } catch (error) {
        console.error('/menu handler error:', error.message);
      }
    });

    bot.onText(/^\/help(?:@\w+)?$/i, async (msg) => {
      try {
        await bot.sendMessage(
          msg.chat.id,
          'Use /start to open the menu. Choose Ask a Health Question to submit a general health question.'
        );
      } catch (error) {
        console.error('/help handler error:', error.message);
      }
    });

    // Menu button callbacks
    bot.on('callback_query', async (query) => {
      const chatId = query.message?.chat?.id;
      const action = query.data;

      try {
        await bot.answerCallbackQuery(query.id);

        if (!chatId) return;

        const language = userLanguages.get(chatId) || 'en';

        if (action === 'menu') {
          waitingForQuestion.delete(chatId);
          await sendMainMenu(chatId, language);
          return;
        }

        if (action === 'health') {
          await bot.sendMessage(
            chatId,
            language === 'my'
              ? 'အောက်ပါ ကျန်းမာရေးအကြောင်းအရာကို ရွေးချယ်ပါ။'
              : 'Choose a health information topic.',
            topicMenu(language)
          );
          return;
        }

        if (action === 'srhr') {
          await bot.sendMessage(
            chatId,
            language === 'my'
              ? 'လိင်နှင့် မျိုးဆက်ပွားကျန်းမာရေးဆိုင်ရာ အခြေခံအကြောင်းအရာများကို ရွေးချယ်ပါ။'
              : 'Choose a sexual and reproductive health topic.',
            topicMenu(language)
          );
          return;
        }

        if (action.startsWith('topic_')) {
          const key = action.slice('topic_'.length);
          await bot.sendMessage(chatId, getText(key, language), {
            reply_markup: {
              inline_keyboard: [
                [{ text: '⬅ Main Menu', callback_data: 'menu' }]
              ]
            }
          });
          return;
        }

        if (action === 'ask') {
          waitingForQuestion.add(chatId);
          await bot.sendMessage(
            chatId,
            language === 'my'
              ? 'သင့်ကျန်းမာရေးမေးခွန်းကို စာသားဖြင့် ပို့ပေးပါ။ ဤဝန်ဆောင်မှုသည် အထွေထွေကျန်းမာရေးအချက်အလက်အတွက်သာ ဖြစ်ပြီး ဆရာဝန်၏ စစ်ဆေးကုသမှုကို အစားမထိုးနိုင်ပါ။'
              : 'Please type your general health question. This service provides health education only and does not replace assessment by a qualified health professional.'
          );
          return;
        }

        if (action === 'call7887') {
          await bot.sendMessage(
            chatId,
            '7887 Healthcare Call Center\n\nFor available 7887 service access, check your mobile operator and local service availability. If you have a medical emergency, seek urgent local medical care.'
          );
          return;
        }

        if (action === 'overseas') {
          await bot.sendMessage(
            chatId,
            'Overseas Myanmar Health Support\n\nPlease contact the Trust Oo team through its officially verified contact channels. Do not share sensitive medical or identity information in a public chat.'
          );
          return;
        }

        if (action === 'about') {
          await bot.sendMessage(
            chatId,
            'Htoo Care is a health information service. Its menu provides general health education. Automated responses are not a diagnosis and do not replace advice from a qualified health professional.'
          );
          return;
        }

        if (action === 'language') {
          await bot.sendMessage(chatId, 'Choose your language / ဘာသာစကားရွေးချယ်ပါ။', {
            reply_markup: {
              inline_keyboard: [
                [{ text: 'English', callback_data: 'lang_en' }],
                [{ text: 'မြန်မာ', callback_data: 'lang_my' }],
                [{ text: '⬅ Main Menu', callback_data: 'menu' }]
              ]
            }
          });
          return;
        }

        if (action === 'lang_en' || action === 'lang_my') {
          userLanguages.set(chatId, action === 'lang_my' ? 'my' : 'en');
          await sendMainMenu(chatId, action === 'lang_my' ? 'my' : 'en');
        }
      } catch (error) {
        console.error('CALLBACK HANDLER ERROR:', error.message);
        try {
          await bot.sendMessage(
            chatId,
            'Sorry, this option could not be processed. Please send /start and try again.'
          );
        } catch (_) {
          // The original error has already been logged.
        }
      }
    });

    // Handle ordinary text messages and health questions.
    bot.on('message', async (msg) => {
      if (!msg.text || msg.text.startsWith('/')) return;

      const chatId = msg.chat.id;

      if (!waitingForQuestion.has(chatId)) {
        return;
      }

      waitingForQuestion.delete(chatId);

      try {
        await bot.sendMessage(
          chatId,
          'Preparing your general health information...'
        );

        const answer = await askGemini(msg.text);

        // Telegram messages have a maximum length.
        const chunks = answer.match(/[\s\S]{1,3500}/g) || [answer];

        for (const chunk of chunks) {
          await bot.sendMessage(chatId, chunk);
        }

        await bot.sendMessage(
          chatId,
          'This information is educational and does not replace a qualified health professional.'
        );
      } catch (error) {
        console.error('HEALTH QUESTION ERROR:', error.message);

        let message =
          'Sorry, I could not retrieve health information right now. Please try again later or consult a qualified health professional.';

        if (!GEMINI_API_KEY) {
          message =
            'Health question support is not configured yet. Please contact the service administrator.';
        } else if (error.name === 'AbortError') {
          message =
            'The request took too long. Please try again later.';
        }

        try {
          await bot.sendMessage(chatId, message);
        } catch (sendError) {
          console.error(
            'Failed to send error response:',
            sendError.message
          );
        }
      }
    });

    const me = await bot.getMe();
    console.log(
      `Telegram token OK. Connected as @${me.username}.`
    );

    await bot.startPolling();
    pollingStarted = true;
    console.log('Telegram polling started. Send /start to the bot.');
  } catch (error) {
    pollingStarted = false;
    console.error('TELEGRAM STARTUP ERROR:', error.message);
  }
}

startTelegram();

// Graceful shutdown
async function shutdown(signal) {
  console.log(`${signal} received. Shutting down...`);

  try {
    if (bot && pollingStarted) {
      await bot.stopPolling();
    }
  } catch (error) {
    console.error('Polling shutdown error:', error.message);
  }

  server.close(() => {
    process.exit(0);
  });

  setTimeout(() => process.exit(1), 5000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
