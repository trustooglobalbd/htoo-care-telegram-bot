
const TelegramBot = require("node-telegram-bot-api");
const express = require("express");

// ========================================
// 1. Environment variables
// ========================================
const PORT = process.env.PORT || 8080;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!TELEGRAM_BOT_TOKEN) {
  console.error("ERROR: TELEGRAM_BOT_TOKEN is missing.");
  process.exit(1);
}

if (!GEMINI_API_KEY) {
  console.error("WARNING: GEMINI_API_KEY is missing.");
}

// ========================================
// 2. Web server (FadeHost health check)
// ========================================
const app = express();

app.get("/", (req, res) => {
  res.status(200).send("Htoo Care Telegram Bot is running.");
});

app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    bot: "Htoo Care",
    geminiConfigured: Boolean(GEMINI_API_KEY),
  });
});

const server = app.listen(PORT, () => {
  console.log(`Web server running on port ${PORT}`);
});

// ========================================
// 3. Telegram bot
// ========================================
const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, {
  polling: true,
});

console.log("Telegram token configured: true");
console.log("Gemini API key configured:", Boolean(GEMINI_API_KEY));
console.log("Htoo Care Telegram Bot started.");

// ========================================
// 4. Main menu
// ========================================
const mainMenu = {
  reply_markup: {
    keyboard: [
      ["🩺 Health Information", "🌸 SRHR Questions"],
      ["📞 Call 7887", "ℹ️ About Htoo Care"],
    ],
    resize_keyboard: true,
  },
};

const DISCLAIMER =
  "\n\nEducational information only; not a diagnosis. " +
  "For personal medical advice, consult a qualified health professional.";

const WELCOME =
  "Welcome to Htoo Care 🌸\n\n" +
  "You can explore general health information and " +
  "sexual and reproductive health education.\n\n" +
  "Choose a menu option below or use /ask followed by your question.";

bot.onText(/^\/start(?:@\w+)?(?:\s|$)/i, async (msg) => {
  try {
    await bot.sendMessage(msg.chat.id, WELCOME, mainMenu);
  } catch (error) {
    console.error("Start command error:", error.message);
  }
});

bot.onText(/^\/menu(?:@\w+)?(?:\s|$)/i, async (msg) => {
  try {
    await bot.sendMessage(msg.chat.id, "Please choose an option:", mainMenu);
  } catch (error) {
    console.error("Menu command error:", error.message);
  }
});

bot.onText(/^\/help(?:@\w+)?(?:\s|$)/i, async (msg) => {
  const helpText =
    "Htoo Care Help\n\n" +
    "/start - Start the bot\n" +
    "/menu - Open the main menu\n" +
    "/ask your question - Ask a general health question\n" +
    "/help - Show this help message\n\n" +
    "Do not send passwords, personal identification numbers, " +
    "or information that identifies a patient.";

  try {
    await bot.sendMessage(msg.chat.id, helpText, mainMenu);
  } catch (error) {
    console.error("Help command error:", error.message);
  }
});

// ========================================
// 5. Basic emergency warning
// This is only a limited keyword check.
// It cannot reliably detect every emergency.
// ========================================
function looksLikeEmergency(text) {
  const patterns = [
    /\b(can'?t breathe|difficulty breathing|severe difficulty breathing)\b/i,
    /\b(unconscious|not waking up|unresponsive)\b/i,
    /\b(heavy bleeding|severe bleeding|bleeding heavily)\b/i,
    /\b(chest pain|severe chest pain)\b/i,
    /\b(overdose|poisoning)\b/i,
    /\b(want to kill myself|suicidal|self[- ]harm)\b/i,
  ];

  return patterns.some((pattern) => pattern.test(text));
}

const EMERGENCY_MESSAGE =
  "⚠️ Your message may describe an urgent health problem.\n\n" +
  "Do not wait for an AI response. Seek emergency medical care " +
  "or contact local emergency services now. If possible, ask " +
  "someone nearby to help you.\n\n" +
  "Htoo Care cannot assess emergencies reliably.";

// ========================================
// 6. Ask Gemini using the Interactions API
// ========================================
async function askGemini(question) {
  if (!GEMINI_API_KEY) {
    return "The AI service is not configured yet. Please try again later.";
  }

  const systemInstructions =
    "You provide general health education for Htoo Care. " +
    "Answer in the same language as the user's question, using " +
    "simple, respectful and non-judgmental language. " +
    "For SRHR questions, be factual, inclusive and age-appropriate. " +
    "Do not claim to diagnose, prescribe treatment, or replace a doctor. " +
    "Do not invent medical facts. If information is uncertain, say so. " +
    "For symptoms that may be serious, recommend prompt assessment by " +
    "a qualified health professional. For emergencies, tell the user " +
    "to seek emergency medical care immediately. Keep the response " +
    "concise and easy to understand. This is educational information, " +
    "not a clinical consultation.";

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);

  try {
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/interactions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": GEMINI_API_KEY,
        },
        body: JSON.stringify({
          model: "gemini-3.8-flash",
          input:
            systemInstructions +
            "\n\nUser's general health question:\n" +
            question,
          store: false,
        }),
        signal: controller.signal,
      }
    );

    const responseText = await response.text();

    if (!response.ok) {
      console.error("Gemini API HTTP status:", response.status);
      // Do not log the API key or the user's question.
      console.error("Gemini API error:", responseText.slice(0, 1200));

      return "The AI service is temporarily unavailable. Please try again later.";
    }

    let data;

    try {
      data = JSON.parse(responseText);
    } catch {
      console.error("Gemini API returned invalid JSON.");
      return "The AI service returned an unexpected response. Please try again later.";
    }

    const answer = (data.steps || [])
      .filter((step) => step.type === "model_output")
      .flatMap((step) => step.content || [])
      .filter((item) => item.type === "text" && item.text)
      .map((item) => item.text)
      .join("\n")
      .trim();

    if (!answer) {
      console.error(
        "Gemini API returned no text. Status:",
        data.status || "unknown"
      );

      return "I could not prepare an answer this time. Please try again later.";
    }

    return answer;
  } catch (error) {
    if (error.name === "AbortError") {
      console.error("Gemini request timed out.");
    } else {
      console.error("Gemini connection error:", error.message);
    }

    return "The AI service is temporarily unavailable. Please try again later.";
  } finally {
    clearTimeout(timeout);
  }
}

// ========================================
// 7. Process health questions
// ========================================
async function handleHealthQuestion(msg, question) {
  const chatId = msg.chat.id;

  if (!question || !question.trim()) {
    await bot.sendMessage(
      chatId,
      "Please enter your question after /ask.\n\n" +
        "Example: /ask What is menstruation?"
    );
    return;
  }

  const cleanedQuestion = question.trim();

  if (cleanedQuestion.length > 500) {
    await bot.sendMessage(
      chatId,
      "Please keep your question within 500 characters."
    );
    return;
  }

  if (looksLikeEmergency(cleanedQuestion)) {
    await bot.sendMessage(chatId, EMERGENCY_MESSAGE);
    return;
  }

  await bot.sendMessage(
    chatId,
    "Preparing general health information..."
  );

  const answer = await askGemini(cleanedQuestion);

  try {
    await bot.sendMessage(
      chatId,
      answer + DISCLAIMER,
      { disable_web_page_preview: true }
    );
  } catch (error) {
    console.error("Sending health answer failed:", error.message);
  }
}

bot.onText(/^\/ask(?:@\w+)?(?:\s+([\s\S]+))?$/i, async (msg, match) => {
  try {
    await handleHealthQuestion(msg, match?.[1] || "");
  } catch (error) {
    console.error("Ask command error:", error.message);

    await bot.sendMessage(
      msg.chat.id,
      "Sorry, something went wrong. Please try again later."
    );
  }
});

// ========================================
// 8. Menu button handling
// ========================================
bot.on("message", async (msg) => {
  if (!msg.text || msg.text.startsWith("/")) {
    return;
  }

  const text = msg.text.trim();

  try {
    switch (text) {
      case "🩺 Health Information":
        await bot.sendMessage(
          msg.chat.id,
          "🩺 Health Information\n\n" +
            "Ask about general health topics, symptoms, healthy habits, " +
            "or prevention.\n\n" +
            "Example:\n/ask How can I prevent dehydration?",
          mainMenu
        );
        break;

      case "🌸 SRHR Questions":
        await bot.sendMessage(
          msg.chat.id,
          "🌸 Sexual and Reproductive Health\n\n" +
            "You can ask general questions about menstruation, puberty, " +
            "reproductive health, contraception, and sexual health.\n\n" +
            "Example:\n/ask What is menstruation?\n\n" +
            "Please avoid sharing your full name or other identifying details.",
          mainMenu
        );
        break;

      case "📞 Call 7887":
        await bot.sendMessage(
          msg.chat.id,
          "📞 For healthcare information, you can call 7887 " +
            "if the service is available on your network and in your area.\n\n" +
            "Please check with your mobile operator if you cannot connect.",
          mainMenu
        );
        break;

      case "ℹ️ About Htoo Care":
        await bot.sendMessage(
          msg.chat.id,
          "ℹ️ About Htoo Care\n\n" +
            "Htoo Care provides general health education through Telegram.\n\n" +
            "AI-generated answers may be inaccurate and are not a diagnosis. " +
            "Clinical decisions should be made with a qualified health professional.",
          mainMenu
        );
        break;
    }
  } catch (error) {
    console.error("Menu message error:", error.message);
  }
});

// ========================================
// 9. Telegram polling errors
// ========================================
bot.on("polling_error", (error) => {
  console.error("Telegram polling error:", error.message);
});

// ========================================
// 10. Graceful shutdown
// ========================================
function shutdown() {
  console.log("Stopping Htoo Care Bot...");

  bot.stopPolling()
    .catch((error) => {
      console.error("Error stopping polling:", error.message);
    })
    .finally(() => {
      server.close(() => {
        process.exit(0);
      });
    });
}

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
