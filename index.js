
"use strict";

const TelegramBot = require("node-telegram-bot-api");
const express = require("express");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8080;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Set these environment variables in FadeHost.
// Never put real tokens or API keys directly in this file.

if (!TELEGRAM_BOT_TOKEN) {
  console.error("Missing TELEGRAM_BOT_TOKEN environment variable.");
  process.exit(1);
}

const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, {
  polling: true
});

// Health-check route for the hosting platform.
app.get("/", (req, res) => {
  res.status(200).send("Htoo Care Telegram Bot is running.");
});

app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    bot: "Htoo Care",
    aiConfigured: Boolean(GEMINI_API_KEY)
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Web server running on port ${PORT}`);
});

// Main menu
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

// Starter educational response.
// Replace with your existing, clinician-reviewed content.
function healthInformation() {
  return (
    "🩺 Health Information\n\n" +
    "Choose a health topic or use /ask followed by your question.\n\n" +
    "This bot provides health education, not a diagnosis."
  );
}

// Minimal bilingual emergency keyword screening.
// This is NOT a reliable emergency detection system.
function possibleEmergency(text) {
  return /unconscious|can't breathe|cannot breathe|difficulty breathing|heavy bleeding|severe bleeding|suicid|မူးလဲ|အသက်ရှူမရ|အသက်ရှူခက်|သွေးအလွန်ထွက်/i.test(text);
}

async function askGemini(question) {
  if (!GEMINI_API_KEY) {
    return (
      "SRHR AI is not configured yet.\n" +
      "Please try again later or contact a qualified health professional."
    );
  }

  const prompt = [
    "You are a cautious bilingual SRHR health-education assistant.",
    "Answer in the same language as the user's question, Burmese or English.",
    "Provide general educational information only.",
    "Do not diagnose, prescribe medicine, or claim certainty.",
    "Do not invent medical facts, local services, or emergency phone numbers.",
    "If the question needs individualized clinical advice, recommend a qualified clinician.",
    "If you lack reliable information, say so clearly.",
    "Do not ask for names, phone numbers, addresses, or other identifying details.",
    "",
    "User question:",
    question
  ].join("\n");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

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
      console.error("Gemini API returned HTTP", response.status);
      return "The AI service is temporarily unavailable. Please try again later.";
    }

    const data = await response.json();
    const answer = data.candidates?.[0]?.content?.parts
      ?.map((part) => part.text || "")
      .join("\n")
      .trim();

    if (!answer) {
      return "I could not prepare an answer. Please try again later.";
    }

    return answer;
  } catch (error) {
    console.error("Gemini request failed:", error.name || "Error");
    return "The AI service is temporarily unavailable. Please try again later.";
  } finally {
    clearTimeout(timeout);
  }
}

// Prevent simultaneous updates from being processed by this handler.
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
        "ကျန်းမာရေးအချက်အလက်အတွက် Menu ကို ရွေးချယ်ပါ။\n" +
        "Choose an option below.",
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
        "/ask Your question - Ask a general SRHR question"
      );
      return;
    }

    if (text.startsWith("/ask")) {
      const question = text.slice(4).trim();

      if (!question) {
        await bot.sendMessage(
          chatId,
          "Please enter a question after /ask.\n" +
          "ဥပမာ - /ask What is menstruation?"
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
          "Your message may describe an emergency. AI cannot assess emergencies reliably. " +
          "Please seek urgent medical care or contact a verified local emergency service now.\n\n" +
          "အရေးပေါ်အခြေအနေ ဖြစ်နိုင်ပါက AI အဖြေကို မစောင့်ဘဲ အနီးဆုံး ဆေးရုံသို့ အမြန်သွားရောက်ပါ။"
        );
        return;
      }

      await bot.sendMessage(chatId, "Preparing general health information...");

      const answer = await askGemini(question);

      await bot.sendMessage(
        chatId,
        answer + "\n\n" +
        "Educational information only; not a diagnosis. " +
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
        "You can ask a general sexual and reproductive health question.\n\n" +
        "Example: /ask What is menstruation?\n\n" +
        "သင့်အမည်၊ ဖုန်းနံပါတ် သို့မဟုတ် ကိုယ်ရေးကိုယ်တာ အချက်အလက်များ မပို့ပါနှင့်။"
      );
      return;
    }

    if (text === "📞 Call 7887") {
      await bot.sendMessage(
        chatId,
        "For healthcare assistance, you may call 7887 where the service is available to you."
      );
      return;
    }

    if (text === "ℹ️ About Htoo Care") {
      await bot.sendMessage(
        chatId,
        "Htoo Care provides general health education.\n" +
        "It does not replace a doctor or professional medical consultation."
      );
      return;
    }

    await bot.sendMessage(
      chatId,
      "Please choose an option from the menu or type /ask followed by a general health question.",
      mainMenu()
    );
  } catch (error) {
    console.error("Message handler failed:", error.message);
    try {
      await bot.sendMessage(
        chatId,
        "Sorry, something went wrong. Please try again later."
      );
    } catch (_) {
      // Telegram may also be temporarily unavailable.
    }
  }
});

bot.on("polling_error", (error) => {
  console.error("Telegram polling error:", error.message);
});

console.log("Htoo Care Telegram Bot started.");
