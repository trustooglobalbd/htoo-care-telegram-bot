
'use strict';

const express = require('express');
const TelegramBot = require('node-telegram-bot-api');

const app = express();
const PORT = Number(process.env.PORT) || 8080;

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL =
  process.env.GEMINI_MODEL || 'gemini-2.5-flash';

let bot;
let pollingStarted = false;

const waitingForQuestion = new Set();
const userLanguages = new Map();

// =====================================
// 1. WEB SERVER
// =====================================

app.get('/', (_req, res) => {
  res.status(200).send('Htoo Care Telegram Bot is running.');
});

app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    telegramPolling: pollingStarted
  });
});

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Htoo Care web server running on port ${PORT}`);
});

// =====================================
// 2. LANGUAGE HELPERS
// =====================================

function getLanguage(chatId) {
  return userLanguages.get(chatId) || 'en';
}

function tr(chatId, english, burmese) {
  return getLanguage(chatId) === 'my' ? burmese : english;
}

// =====================================
// 3. MAIN MENU
// Use inline buttons with callback_data.
// =====================================

function getMainMenu() {
  return {
    reply_markup: {
      inline_keyboard: [
        [
          { text: '🩺 Health Information', callback_data: 'health' }
        ],
        [
          { text: '🌸 SRHR Topics', callback_data: 'srhr' }
        ],
        [
          { text: '💬 Ask a Health Question', callback_data: 'ask' }
        ],
        [
          { text: '📞 Call 7887', callback_data: 'call7887' }
        ],
        [
          {
            text: '🌏 Overseas Myanmar Health Support',
            callback_data: 'overseas'
          }
        ],
        [
          { text: 'ℹ️ About Htoo Care', callback_data: 'about' }
        ],
        [
          { text: '🌐 Change Language', callback_data: 'language' }
        ]
      ]
    }
  };
}

async function showMainMenu(chatId) {
  await bot.sendMessage(
    chatId,
    tr(
      chatId,
      'Welcome to Htoo Care!\n\nPlease select an option below.',
      'Htoo Care မှ ကြိုဆိုပါတယ်။\n\nအောက်ပါ Menu မှတစ်ခုကို ရွေးချယ်ပါ။'
    ),
    getMainMenu()
  );
}

// =====================================
// 4. HEALTH INFORMATION
// These are general educational drafts.
// They are not a substitute for clinical advice.
// =====================================

const healthTopics = {
  general: {
    en: 'General Health\n\nMaintain a balanced diet, drink safe water, get enough rest, and seek advice from a qualified health professional if symptoms persist or worsen.',
    my: 'အထွေထွေကျန်းမာရေး\n\nအာဟာရမျှတစွာစားပါ၊ သန့်ရှင်းသောရေသောက်ပါ၊ အနားယူပါ။ လက္ခဏာများ မသက်သာခြင်း သို့မဟုတ် ပိုဆိုးလာခြင်းရှိပါက ကျန်းမာရေးဝန်ထမ်းထံ အကြံဉာဏ်ရယူပါ။'
  },
  heat: {
    en: 'Heat Health\n\nDrink water regularly, stay in a cool or shaded place when possible, and reduce strenuous activity during the hottest hours. Confusion, collapse, or very high body temperature may be an emergency. Seek urgent medical care.',
    my: 'အပူဒဏ်နှင့် ကျန်းမာရေး\n\nရေကို ပုံမှန်သောက်ပါ။ ဖြစ်နိုင်ပါက အေးမြသောနေရာ သို့မဟုတ် အရိပ်တွင် နေပါ။ အပူဆုံးအချိန်များတွင် ပြင်းထန်သော ကိုယ်လက်လှုပ်ရှားမှုကို လျှော့ချပါ။ သတိရှုပ်ထွေးခြင်း၊ လဲကျခြင်း သို့မဟုတ် ကိုယ်အပူချိန် အလွန်မြင့်ခြင်းသည် အရေးပေါ်အခြေအနေ ဖြစ်နိုင်သောကြောင့် ဆေးကုသမှု အမြန်ခံယူပါ။'
  },
  menstrual: {
    en: 'Menstrual Health\n\nTrack your menstrual cycle and use clean menstrual products. Seek medical advice for unusually heavy bleeding, severe pain, or concerning changes.',
    my: 'ရာသီသွေးဆင်းခြင်း\n\nရာသီစက်ဝန်းကို မှတ်သားထားပြီး သန့်ရှင်းသော ရာသီသုံးပစ္စည်းများ အသုံးပြုပါ။ သွေးအလွန်များခြင်း၊ နာကျင်မှု ပြင်းထန်ခြင်း သို့မဟုတ် ပုံမှန်မဟုတ်သော ပြောင်းလဲမှုများရှိပါက ကျန်းမာရေးဝန်ထမ်းထံ တိုင်ပင်ပါ။'
  },
  pregnancy: {
    en: 'Pregnancy Health\n\nAttend antenatal care with a qualified health professional. Heavy bleeding, severe abdominal pain, difficulty breathing, or convulsions require urgent medical attention.',
    my: 'ကိုယ်ဝန်ဆောင်ကျန်းမာရေး\n\nကျွမ်းကျင်သော ကျန်းမာရေးဝန်ထမ်းထံ ပုံမှန်ကိုယ်ဝန်စောင့်ရှောက်မှု ခံယူပါ။ သွေးအများအပြားဆင်းခြင်း၊ ဗိုက်အလွန်နာခြင်း၊ အသက်ရှူခက်ခြင်း သို့မဟုတ် တက်ခြင်းရှိပါက အရေးပေါ်ဆေးကုသမှု ခံယူပါ။'
  },
  family: {
    en: 'Family Planning\n\nContraceptive methods differ in effectiveness, benefits, and risks. A qualified health professional can help you choose a suitable method.',
    my: 'သားဆက်ခြားခြင်း\n\nသားဆက်ခြားနည်းများသည် ထိရောက်မှု၊ အကျိုးကျေးဇူးနှင့် ဘေးထွက်ဆိုးကျိုးများ မတူညီပါ။ သင့်တော်သောနည်းလမ်းကို ရွေးချယ်ရန် ကျန်းမာရေးဝန်ထမ်းနှင့် တိုင်ပင်ပါ။'
  },
  sti: {
    en: 'Sexual Health\n\nSome sexually transmitted infections have no obvious symptoms. Testing and advice from a qualified health professional can help protect your health.',
    my: 'လိင်ကျန်းမာရေး\n\nလိင်မှတစ်ဆင့် ကူးစက်သောရောဂါအချို့တွင် သိသာသောလက္ခဏာ မရှိနိုင်ပါ။ စစ်ဆေးမှုခံယူခြင်းနှင့် ကျန်းမာရေးဝန်ထမ်းထံ တိုင်ပင်ခြင်းက အထောက်အကူပြုနိုင်ပါသည်။'
  }
};

function getTopicMenu(chatId) {
  const isMyanmar = getLanguage(chatId) === 'my';

  const topics = isMyanmar
    ? [
        ['အထွေထွေကျန်းမာရေး', 'general'],
        ['အပူဒဏ်နှင့် ကျန်းမာရေး', 'heat'],
        ['ရာသီသွေးဆင်းခြင်း', 'menstrual'],
        ['ကိုယ်ဝန်ဆောင်ကျန်းမာရေး', 'pregnancy'],
        ['သားဆက်ခြားခြင်း', 'family'],
        ['လိင်ကျန်းမာရေး', 'sti']
      ]
    : [
        ['General Health', 'general'],
        ['Heat Health', 'heat'],
        ['Menstrual Health', 'menstrual'],
        ['Pregnancy Health', 'pregnancy'],
        ['Family Planning', 'family'],
        ['Sexual Health', 'sti']
      ];

  return {
    reply_markup: {
      inline_keyboard: [
        ...topics.map(([label, key]) => [
          { text: label, callback_data: `topic_${key}` }
        ]),
        [
          {
            text: '⬅ Main Menu',
            callback_data: 'menu'
          }
        ]
      ]
    }
  };
}

function getTopicText(key, chatId) {
  const topic = healthTopics[key];

  if (!topic) {
    return tr(
      chatId,
      'This topic is not available yet.',
      'ဤအကြောင်းအရာကို လက်ရှိ မရရှိနိုင်သေးပါ။'
    );
  }

  return topic[getLanguage(chatId)] || topic.en;
}

// =====================================
// 5. GEMINI API
// Used only when a user submits a question.
// =====================================

async function askGemini(question) {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is missing.');
  }

  const url =
    'https://generativelanguage.googleapis.com/v1beta/models/' +
    encodeURIComponent(GEMINI_MODEL) +
    ':generateContent';

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
              'You provide general health education, not medical diagnosis. ' +
              'Do not prescribe medicines or replace a clinician. ' +
              'Use the same language as the user. ' +
              'For potentially serious or emergency symptoms, recommend urgent local medical care. ' +
              'Be respectful, concise, and clear.'
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
        'Gemini API error:',
        response.status,
        JSON.stringify(data).slice(0, 1000)
      );

      throw new Error(`Gemini HTTP ${response.status}`);
    }

    const answer = (data.candidates?.[0]?.content?.parts || [])
      .map(part => part.text || '')
      .join('\n')
      .trim();

    if (!answer) {
      throw new Error('Gemini returned an empty response.');
    }

    return answer;
  } finally {
    clearTimeout(timeout);
  }
}

// =====================================
// 6. TELEGRAM STARTUP
// =====================================

async function startBot() {
  if (!TOKEN) {
    console.error(
      'STARTUP ERROR: TELEGRAM_BOT_TOKEN is missing.'
    );
    return;
  }

  try {
    bot = new TelegramBot(TOKEN, { polling: false });

    bot.on('polling_error', error => {
      console.error('TELEGRAM POLLING ERROR:', error.message);
    });

    bot.on('error', error => {
      console.error('TELEGRAM BOT ERROR:', error.message);
    });

    // Log incoming messages for debugging.
    bot.on('message', msg => {
      console.log(
        '[TELEGRAM INCOMING]',
        'chat:', msg.chat.id,
        'text:', JSON.stringify(msg.text || '')
      );
    });

    // /start
    bot.onText(/^\/start(?:@\w+)?(?:\s.*)?$/i, async msg => {
      try {
        waitingForQuestion.delete(msg.chat.id);
        await showMainMenu(msg.chat.id);
      } catch (error) {
        console.error('/start ERROR:', error.message);
      }
    });

    // /menu
    bot.onText(/^\/menu(?:@\w+)?$/i, async msg => {
      try {
        waitingForQuestion.delete(msg.chat.id);
        await showMainMenu(msg.chat.id);
      } catch (error) {
        console.error('/menu ERROR:', error.message);
      }
    });

    // /help
    bot.onText(/^\/help(?:@\w+)?$/i, async msg => {
      try {
        await bot.sendMessage(
          msg.chat.id,
          'Send /start to open the menu. Select Ask a Health Question to submit a question.'
        );
      } catch (error) {
        console.error('/help ERROR:', error.message);
      }
    });

    // =================================
    // 7. INLINE BUTTON HANDLER
    // =================================

    bot.on('callback_query', async query => {
      const chatId = query.message?.chat?.id;
      const action = query.data;

      console.log(
        '[CALLBACK RECEIVED]',
        'action:', action,
        'chat:', chatId
      );

      try {
        await bot.answerCallbackQuery(query.id);

        if (!chatId || !action) return;

        const language = getLanguage(chatId);

        if (action === 'menu') {
          waitingForQuestion.delete(chatId);
          await showMainMenu(chatId);
          return;
        }

        if (action === 'health' || action === 'srhr') {
          const intro = action === 'srhr'
            ? tr(
                chatId,
                'Sexual and Reproductive Health topics:',
                'လိင်နှင့် မျိုးဆက်ပွားကျန်းမာရေး အကြောင်းအရာများကို ရွေးချယ်ပါ။'
              )
            : tr(
                chatId,
                'Please choose a health information topic:',
                'ကျန်းမာရေးအကြောင်းအရာတစ်ခုကို ရွေးချယ်ပါ။'
              );

          await bot.sendMessage(
            chatId,
            intro,
            getTopicMenu(chatId)
          );
          return;
        }

        if (action.startsWith('topic_')) {
          const key = action.slice('topic_'.length);

          await bot.sendMessage(
            chatId,
            getTopicText(key, chatId),
            {
              reply_markup: {
                inline_keyboard: [
                  [
                    {
                      text: '⬅ Main Menu',
                      callback_data: 'menu'
                    }
                  ]
                ]
              }
            }
          );
          return;
        }

        if (action === 'ask') {
          waitingForQuestion.add(chatId);

          await bot.sendMessage(
            chatId,
            tr(
              chatId,
              'Please type your health question in your next message. This service provides general health education only and does not replace a qualified health professional.',
              'သင့်ကျန်းမာရေးမေးခွန်းကို နောက်စာတိုအဖြစ် ပို့ပေးပါ။ ဤဝန်ဆောင်မှုသည် အထွေထွေကျန်းမာရေးပညာပေးအတွက်သာ ဖြစ်ပြီး ဆရာဝန်၏ စစ်ဆေးကုသမှုကို အစားမထိုးနိုင်ပါ။'
            )
          );
          return;
        }

        if (action === 'call7887') {
          await bot.sendMessage(
            chatId,
            tr(
              chatId,
              '7887 Healthcare Call Center\n\nPlease check availability with your mobile operator. If you have an emergency, seek urgent local medical care.',
              '7887 Healthcare Call Center\n\nသင့်မိုဘိုင်းအော်ပရေတာထံ ဝန်ဆောင်မှုရရှိနိုင်မှုကို စစ်ဆေးပါ။ အရေးပေါ်အခြေအနေဖြစ်ပါက နီးစပ်ရာ အရေးပေါ်ဆေးကုသမှုကို ခံယူပါ။'
            )
          );
          return;
        }

        if (action === 'overseas') {
          await bot.sendMessage(
            chatId,
            tr(
              chatId,
              'Overseas Myanmar Health Support\n\nPlease contact Trust Oo through its officially verified contact channels. Do not share sensitive medical information in a public chat.',
              'ပြည်ပရောက် မြန်မာနိုင်ငံသားများအတွက် ကျန်းမာရေးအကူအညီ\n\nTrust Oo ၏ အတည်ပြုထားသော ဆက်သွယ်ရေးလမ်းကြောင်းများမှ ဆက်သွယ်ပါ။ အများမြင်နိုင်သော chat တွင် ကိုယ်ရေးကိုယ်တာ ဆေးဘက်ဆိုင်ရာအချက်အလက်များ မမျှဝေပါနှင့်။'
            )
          );
          return;
        }

        if (action === 'about') {
          await bot.sendMessage(
            chatId,
            tr(
              chatId,
              'Htoo Care provides health information and education. Automated information is not a diagnosis and does not replace advice from a qualified health professional.',
              'Htoo Care သည် ကျန်းမာရေးဆိုင်ရာ အချက်အလက်နှင့် ပညာပေးဝန်ဆောင်မှုများကို ပေးပါသည်။ အလိုအလျောက်ပေးသော အချက်အလက်များသည် ရောဂါရှာဖွေခြင်းမဟုတ်သလို ကျွမ်းကျင်သော ကျန်းမာရေးဝန်ထမ်း၏ အကြံဉာဏ်ကိုလည်း အစားမထိုးနိုင်ပါ။'
            )
          );
          return;
        }

        if (action === 'language') {
          await bot.sendMessage(
            chatId,
            'Choose your language / ဘာသာစကားရွေးချယ်ပါ။',
            {
              reply_markup: {
                inline_keyboard: [
                  [{ text: 'English', callback_data: 'lang_en' }],
                  [{ text: 'မြန်မာ', callback_data: 'lang_my' }],
                  [{ text: '⬅ Main Menu', callback_data: 'menu' }]
                ]
              }
            }
          );
          return;
        }

        if (action === 'lang_en' || action === 'lang_my') {
          userLanguages.set(
            chatId,
            action === 'lang_my' ? 'my' : 'en'
          );

          await showMainMenu(chatId);
          return;
        }

        console.warn('Unknown callback action:', action);

      } catch (error) {
        console.error('CALLBACK HANDLER ERROR:', error.message);

        try {
          await bot.sendMessage(
            chatId,
            'Sorry, this option could not be processed. Please send /start and try again.'
          );
        } catch (sendError) {
          console.error(
            'Could not send callback error:',
            sendError.message
          );
        }
      }
    });

    // =================================
    // 8. HEALTH QUESTION MESSAGE HANDLER
    // =================================

    bot.on('message', async msg => {
      if (!msg.text || msg.text.startsWith('/')) return;

      const chatId = msg.chat.id;

      if (!waitingForQuestion.has(chatId)) return;

      waitingForQuestion.delete(chatId);

      try {
        await bot.sendChatAction(chatId, 'typing');

        const answer = await askGemini(msg.text);

        const chunks = answer.match(/[\s\S]{1,3500}/g) || [answer];

        for (const chunk of chunks) {
          await bot.sendMessage(chatId, chunk);
        }

        await bot.sendMessage(
          chatId,
          tr(
            chatId,
            'Reminder: This is general health education, not a medical diagnosis.',
            'သတိပြုရန် — ဤအချက်အလက်သည် အထွေထွေကျန်းမာရေးပညာပေးသာဖြစ်ပြီး ရောဂါရှာဖွေချက် မဟုတ်ပါ။'
          ),
          {
            reply_markup: {
              inline_keyboard: [
                [{ text: '⬅ Main Menu', callback_data: 'menu' }]
              ]
            }
          }
        );

      } catch (error) {
        console.error('HEALTH QUESTION ERROR:', error.message);

        let reply = tr(
          chatId,
          'Sorry, health information is temporarily unavailable. Please try again later or contact a qualified health professional.',
          'တောင်းပန်ပါတယ်။ လက်ရှိတွင် ကျန်းမာရေးအချက်အလက်ကို မရရှိနိုင်သေးပါ။ နောက်မှ ထပ်စမ်းကြည့်ပါ သို့မဟုတ် ကျန်းမာရေးဝန်ထမ်းနှင့် တိုင်ပင်ပါ။'
        );

        if (!GEMINI_API_KEY) {
          reply = tr(
            chatId,
            'Health question support is not configured yet. Please contact the administrator.',
            'ကျန်းမာရေးမေးခွန်းဖြေကြားမှုကို မသတ်မှတ်ရသေးပါ။ စီမံခန့်ခွဲသူထံ ဆက်သွယ်ပါ။'
          );
        } else if (error.name === 'AbortError') {
          reply = tr(
            chatId,
            'The request timed out. Please try again later.',
            'တောင်းဆိုမှု ကြာမြင့်သွားပါသည်။ နောက်မှ ထပ်စမ်းကြည့်ပါ။'
          );
        }

        try {
          await bot.sendMessage(chatId, reply);
        } catch (sendError) {
          console.error(
            'Could not send health error:',
            sendError.message
          );
        }
      }
    });

    // Confirm credentials and start polling.
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

// =====================================
// 9. GRACEFUL SHUTDOWN
// =====================================

async function shutdown(signal) {
  console.log(`${signal} received. Shutting down...`);

  try {
    if (bot && pollingStarted) {
      await bot.stopPolling();
    }
  } catch (error) {
    console.error('Polling shutdown error:', error.message);
  }

  server.close(() => process.exit(0));

  setTimeout(() => process.exit(1), 5000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Start Telegram only after registering all handlers.
startBot();
