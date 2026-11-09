# Htuu Care | Digital Health Information Assistant

<p align="center">
  <strong>Healthcare information should be easier to access, understand and act on.</strong>
</p>

Htuu Care is a Telegram-based digital health information initiative developed by **Trust Oo Co., Ltd.** It is designed to make general health education more accessible to Myanmar communities, including Myanmar nationals living abroad.

> **Our purpose:** Help people find understandable health information and connect with appropriate healthcare support — through a simple messaging experience.

---

## 🌏 About Htuu Care

Htuu Care brings basic health education and service navigation into a familiar messaging platform. The project is being developed with a focus on accessibility, respectful communication and responsible use of digital technology.

### What the bot is designed to offer

- **Health information:** General educational information on common health topics.
- **Health questions:** A guided flow for users to describe a health concern and receive general educational information.
- **SRHR information:** Non-judgmental information about sexual and reproductive health, menstruation, pregnancy, contraception and STI/HIV topics.
- **Health learning quiz:** Short educational quizzes to support health awareness.
- **Service connection:** Information about the 7887 Healthcare Call Center and specialist consultation contact options.
- **Language access:** A language-selection experience for Myanmar, English and Thai. The completeness of translated screens and content is an ongoing improvement area.
- **User feedback:** Planned feedback collection to help improve the service.

## 🗣️ Language Access

The intended language options are:

| Language | Selection |
|---|---|
| Myanmar | 🇲🇲 မြန်မာ |
| English | 🇬🇧 English |
| Thai | 🇹🇭 ภาษาไทย |

The selected language should be used consistently across welcome messages, menus, instructions, consent notices, quiz content, service information and feedback prompts. Translation quality and completeness should be reviewed before public release.

## 🔐 Privacy, Consent & Safety

Htuu Care is a health education tool, not a clinical diagnostic service.

- Do not enter names, identity numbers, exact addresses or other unnecessary personal information in health questions.
- Health information sent to an AI provider may be processed under that provider's terms and data practices. Do not submit identifiable patient information.
- Saving health-related information to Google Sheets should happen only after the user is clearly informed and gives consent.
- Telephone numbers should be requested **only when a user chooses to be contacted after submitting feedback**. Providing a number must remain optional.
- Feedback should be accepted without requiring a telephone number.
- Do not use bot responses as a substitute for assessment, diagnosis or treatment by a qualified healthcare professional.
- For emergency warning signs, users should seek urgent medical care immediately.

## 🧭 User Experience

The bot's core service journey is intended to remain simple:

1. Choose a language.
2. Select the user's location context.
3. Open the main menu.
4. Use the selected service, such as health information, a health question, a quiz or service contact information.
5. After a completed interaction, optionally rate the experience and share suggestions.
6. Only if the user asks to be contacted, optionally provide a telephone number.
7. Return to the main menu.

Feedback and optional contact details should be handled separately from health-question records and used only for the stated purpose.

## 🧰 Technology

The current project uses:

- **Node.js** for the bot application
- **Telegram Bot API** via `node-telegram-bot-api`
- **Express** for the health/status endpoint
- **Google Apps Script / Google Sheets** for configured record-saving workflows
- **Google Gemini API** for AI-generated general health education, when configured

Provider availability, model names, quotas and pricing can change. Check the provider's official documentation and account limits before deployment.

## ⚙️ Configuration

Configure secrets in your hosting provider's environment-variable settings. **Do not commit API keys, bot tokens or Apps Script secrets to GitHub.**

| Environment variable | Purpose |
|---|---|
| `TELEGRAM_BOT_TOKEN` | Telegram bot token |
| `GEMINI_API_KEY` | Google Gemini API key |
| `GEMINI_MODEL` | Gemini model name (optional; application default applies) |
| `GOOGLE_APPS_SCRIPT_URL` | Deployed Google Apps Script `/exec` URL |
| `GOOGLE_APPS_SCRIPT_SECRET` | Shared secret used by the Apps Script integration |
| `PORT` | Hosting port (optional; defaults to 8080) |

### Run locally

1. Install a supported Node.js version.
2. Clone this repository.
3. Install the dependencies declared in `package.json`.
4. Set the required environment variables in your local environment.
5. Start the application using the start script declared in `package.json`.

Never paste secrets into issues, chat messages, screenshots or source files.

### Health check

When the application is running, open:

```text
/health
```

The endpoint reports application configuration status. It does not prove that every Telegram flow, AI request or Google Sheets write has been tested successfully.

## 🗺️ Development Priorities

- Complete and quality-check Myanmar, English and Thai localization across all bot screens and content.
- Keep existing health-question, quiz and service-navigation flows stable.
- Add an optional feedback rating and suggestion flow.
- Request a telephone number only when the user explicitly asks for follow-up.
- Store feedback and contact consent with clear purpose limitation and appropriate access controls.
- Test the full user journey in all three languages before release.

## 🏥 About Trust Oo

Htuu Care is developed by **Trust Oo Co., Ltd.**, a Myanmar social enterprise working to improve access to health information and digital health services.

**Related service:** 7887 Healthcare Call Center

- Website: [Trust Oo](https://trustooglobal.com)
- Telegram bot: [@HtooCare_Bot](https://t.me/HtooCare_Bot)

---

*Htuu Care provides general health education only. It does not diagnose conditions, prescribe treatment or replace qualified healthcare professionals. In an emergency, contact local emergency services or seek immediate medical care.*

**Developed by Trust Oo Co., Ltd.**  
*Digital Health • Healthcare Access • Telehealth Innovation*

#HtuuCare #TrustOo #DigitalHealth #HealthTech #HealthcareAccess #Myanmar
