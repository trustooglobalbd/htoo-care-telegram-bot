
"use strict";

const TelegramBot = require("node-telegram-bot-api");
const express = require("express");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8080;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Stop safely if the Telegram token is missing.
if (!TELEGRAM_BOT_TOKEN) {
  console.error("Missing TELEGRAM_BOT_TOKEN environment variable.");
  process.exit(1);
}

// Telegram bot
const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, {
  polling: true
});

// Web server for hosting health checks
app.get("/", (req, res) => {
  res.status(200).send("Htoo Care Telegram Bot is running.");
});

app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    bot: "Htoo Care",
    geminiConfigured: Boolean(GEMINI_API_KEY)
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Web server running on port ${PORT}`);
  console.log(
    "Gemini API key configured:",
    Boolean(GEMINI_API_KEY)
  );
});

function mainMenu() {
  return {
    reply_markup: {
      keyboard: [
        [{ text: "🩺 Health Information" }],
        [{ text: "🌸 SRHR Questions" }],
        [{ text: "📞 Call 7887" }],
        [{ text: "ℹ️ About Htoo Care" }]
      ],
      resize_keyboard: true
    }
  };
}

function healthInformation() {
  return (
    "🩺 Health Information\n\n" +
    "Choose a health topic or use /ask followed by your question.\n\n" +
    "This bot provides health education, not a diagnosis."
  );
}

// Basic emergency keyword check only.
// This is NOT a reliable emergency detection system.
function possibleEmergency(text) {
  return /unconscious|can't breathe|cannot breathe|difficulty breathing|heavy bleeding|severe bleeding|suicid|မူးလဲ|အသက်ရှူမရ|အသက်ရှူခက်|သွေးအလွန်ထွက်/i.test(text);
}

async function askGemini(question) {
  if (!GEMINI_API_KEY) {
    console.error("GEMINI_API_KEY is missing.");
    return "The AI service is not configured yet. Please contact the administrator.";
  }

  const prompt = [
    "You provide general sexual and reproductive health education.",
    "Answer in the same language as the question, Burmese or English.",
    "Use cautious, respectful, non-judgmental language.",
    "Do not diagnose, prescribe medicine, or invent medical facts.",
    "If you are uncertain, say so.",
    "For individual medical advice, recommend a qualified clinician.",
    "Do not request identifying information.",
    "This bot is not an emergency service.",
    "",
    "Question:",
    question
  ].join("\n");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);

  try {
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": GEMINI_API_KEY
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }]
            }
          ],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 500
          }
        }),
        signal: controller.signal
      }
    );

    if (!response.ok) {
      const errorBody = await response.text();

      // Do not log the API key or request headers.
      console.error("Gemini API HTTP status:", response.status);
      console.error("Gemini API error:", errorBody.slice(0, 1000));

      return "The AI service is temporarily unavailable. Please try again later.";
    }

    const data = await response.json();

    const answer = data.candidates?.[0]?.content?.parts
      ?.map((part) => part.text || "")
      .join("\n")
      .trim();

    if (!answer) {
      console.error("Gemini API returned no answer.");
      return "I could not prepare an answer. Please try again later.";
    }

    return answer;
  } catch (error) {
    // Log the error type, not secrets or user health questions.
    console.error(
      "Gemini connection error:",
      error.name || "UnknownError"
    );

    return "The AI service is temporarily unavailable. Please try again later.";
  } finally {
    clearTimeout(timeout);
  }
}

bot.on("message", async (msg) => {
  if (!msg.text || !msg.chat?.id) return;

  const chatId = msg.chat.id;
  const text = msg.text.trim();

  try {
    if (text === "/start" || text === "/menu") {
      await bot.sendMessage(
        chatId,
        "မင်္ဂလာပါ။ Htoo Care မှ ကြိုဆိုပါတယ်။\n" +
        "Welcome to Htoo Care.\n\n" +
        "ကျန်းမာရေးအချက်အလက်အတွက် Menu ကို ရွေးချယ်ပါ။",
        mainMenu()
      );
      return;
    }

    if (text === "/help") {
      await bot.sendMessage(
        chatId,
        "Commands:\n" +
        "/start - Open the menu\n" +
        "/menu - Show the menu\n" +
        "/ask Your question - Ask a general health question"
      );
      return;
    }

    if (text.startsWith("/ask")) {
      const question = text.slice(4).trim();

      if (!question) {
        await bot.sendMessage(
          chatId,
          "Please enter a question after /ask.\n" +
          "Example: /ask What is menstruation?"
        );
        return;
      }

      if (question.length > 500) {
        await bot.sendMessage(
          chatId,
          "Please keep your question under 500 characters."
        );
        return;
      }

      if (possibleEmergency(question)) {
        await bot.sendMessage(
          chatId,
          "This may be an emergency. AI cannot assess emergencies reliably. " +
          "Please seek urgent medical care or contact a verified local emergency service.\n\n" +
          "အရေးပေါ်အခြေအနေဖြစ်နိုင်ပါက AI အဖြေကို မစောင့်ဘဲ အမြန်ဆုံး ဆေးကုသမှုခံယူပါ။"
        );
        return;
      }

      await bot.sendMessage(
        chatId,
        "Preparing general health information..."
      );

      const answer = await askGemini(question);

      await bot.sendMessage(
        chatId,
        answer +
        "\n\nEducational information only; not a diagnosis. " +
        "For personal medical advice, consult a qualified health professional."
      );
      return;
    }

    if (text === "🩺 Health Information") {
      await bot.sendMessage(chatId, healthInformation());
      return;
    }

    if (text === "🌸 SRHR Questions") {
      await bot.sendMessage(
        chatId,
        "Ask a general sexual and reproductive health question using /ask.\n\n" +
        "Example: /ask What is menstruation?\n\n" +
        "ကိုယ်ရေးကိုယ်တာအချက်အလက်များ မပို့ပါနှင့်။"
      );
      return;
    }

    if (text === "📞 Call 7887") {
      await bot.sendMessage(
        chatId,
        "You may call 7887 for healthcare assistance where the service is available to you."
      );
      return;
    }

    if (text === "ℹ️ About Htoo Care") {
      await bot.sendMessage(
        chatId,
        "Htoo Care provides general health education. " +
        "It does not replace a doctor or professional medical consultation."
      );
      return;
    }

    await bot.sendMessage(
      chatId,
      "Please choose an option from the menu or type /ask followed by your question.",
      mainMenu()
    );
  } catch (error) {
    console.error("Message handler error:", error.message);

    try {
      await bot.sendMessage(
        chatId,
        "Sorry, something went wrong. Please try again later."
      );
    } catch (_) {
      // Telegram may be temporarily unavailable.
    }
  }
});

bot.on("polling_error", (error) => {
  console.error("Telegram polling error:", error.message);
});

console.log("Htoo Care Telegram Bot started.");
