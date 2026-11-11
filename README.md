# Htuu Care
### AI-Assisted Health Information & Referral Platform

<p align="center">
  <strong>Clear health information. Safer choices. Better access to care.</strong>
</p>

<p align="center">
  <a href="https://t.me/HtooCare_Bot">Explore the Telegram Prototype</a>
  ·
  <a href="https://github.com/trustooglobalbd/htoo-care-telegram-bot">View Source Code</a>
</p>

---

## 🌍 The Vision

**Htuu Care** is a digital health information and referral initiative by **Trust Oo Co., Ltd.**, designed to make reliable, understandable and inclusive health information easier to access.

For many women, adolescents and young people, finding clear and trustworthy information about their health can be difficult. Language barriers, stigma, limited access to health services and uncertainty about where to seek help can prevent people from making informed decisions.

Htuu Care aims to help close this information gap through a simple, familiar digital channel — connecting people with health education, guided information support and appropriate healthcare referral pathways.

Our long-term vision is an accessible, multilingual health information and navigation platform for **people in Myanmar and Myanmar communities living abroad**.

## 💡 What Makes Htuu Care Different?

Htuu Care is being developed around three connected elements:

| Element | What it means |
|---|---|
| **Accessible digital information** | Health education through a familiar messaging platform, with Myanmar, English and Thai language pathways. |
| **AI-assisted guidance** | A planned AI-supported experience to help users navigate general health information in clear, understandable language. |
| **Human support & referral** | Connecting users with appropriate healthcare professionals and services when additional support is needed. |

The platform is intended to make health information easier to understand — **not to replace clinicians, diagnose conditions or prescribe treatment**.

## 🎯 Who We Aim to Support

Htuu Care is designed with the needs of the following communities in mind:

- **Women and adolescent girls** seeking accessible, respectful health information.
- **Adolescents and young people** who need clear, age-appropriate and non-judgmental health education.
- **Underserved communities** facing barriers to reliable health information and service access.
- **Myanmar nationals living abroad** who may need health information and guidance in familiar languages.

Priority content areas include sexual and reproductive health and rights (SRHR), menstrual health, pregnancy and maternal health, general health awareness and service navigation. Content will be developed and reviewed with appropriate health expertise.

## 🧪 Current Prototype

A functional **Telegram-based prototype** has been developed and is being improved.

### Available in the current prototype

- Language selection for Myanmar, English and Thai.
- A guided menu-based experience for general health information.
- Health topic navigation and a structured health-question journey.
- Health education and awareness features.
- Service information and pathways to relevant healthcare support.

### Development in progress

The current prototype is an early-stage foundation. The full AI-assisted health navigation experience, expanded clinician-reviewed content, broader user testing and strengthened referral workflows are planned development activities. They should not be interpreted as already completed or fully deployed features.

We are taking an iterative approach: improve the working prototype, review content and user experience, test with intended users, and use feedback to guide the next development stages.

## 🗺️ 12-Month Development Roadmap

| Period | Planned milestone |
|---|---|
| **Months 1–3** | Improve the prototype, user experience and reliability of the planned AI-assisted functions. |
| **Months 4–6** | Expand and review health information in Myanmar, English and Thai, prioritizing SRHR, menstrual health and maternal health. |
| **Months 7–9** | Pilot with women, adolescents, young people and underserved communities; collect user feedback and improve accessibility. |
| **Months 10–12** | Evaluate engagement, user satisfaction and referral pathways; document learning and explore partnerships for responsible scale-up. |

### Intended results

- Easier access to understandable health information.
- Improved ability to navigate relevant health topics and support options.
- More inclusive access through multilingual digital channels.
- User feedback and learning to continuously improve the service.
- Stronger connections between digital health information and appropriate human support.

Specific targets and indicators will be established and monitored during implementation.

## 🔐 Privacy, Safety & Responsible Use

Trust and user safety are central to the development of Htuu Care.

- The service is intended for general health education and navigation, not medical diagnosis or treatment.
- Users should avoid sharing names, identity numbers, exact addresses or other unnecessary personal information.
- Any use of AI-supported services must be accompanied by clear information about how submitted data may be processed.
- Personal or health-related information should only be collected when necessary, with clear explanation and user consent.
- Optional follow-up contact details should only be requested when a user explicitly asks to be contacted.
- Health information and contact details should be protected with appropriate access controls and purpose limitation.
- Users with urgent or emergency symptoms should seek immediate medical attention.

Health content and referral pathways should be reviewed with qualified health professionals and relevant service providers.

## 🤝 Implementation & Sustainability

Htuu Care is being developed by **Trust Oo Co., Ltd.**, building on the organization's experience in digital health information and healthcare access.

The initiative aims to combine technology, health expertise and partnerships to support responsible implementation. Potential collaboration areas include clinician-reviewed content, community-based piloting, referral coordination, language accessibility and technical development.

Long-term sustainability will be explored through partnerships with healthcare organizations, development partners and institutions working in digital health, women's health and youth well-being.

## 🛠️ Technology

The current codebase includes:

- **Node.js** — application runtime
- **Telegram Bot API** with `node-telegram-bot-api` — messaging interface
- **Express** — application health/status endpoint
- **Google Apps Script / Google Sheets** — configured data-recording workflows
- **Google Gemini API** — AI integration configured for development, subject to availability and testing

Technology integrations and planned capabilities may evolve as the prototype is tested and improved.

## ⚙️ Run & Configure

### Environment variables

Set secrets in your hosting provider's environment-variable settings. **Never commit API keys, Telegram bot tokens or shared secrets to the repository.**

| Variable | Purpose |
|---|---|
| `TELEGRAM_BOT_TOKEN` | Telegram bot token |
| `GEMINI_API_KEY` | Google Gemini API key |
| `GEMINI_MODEL` | Optional Gemini model name |
| `GOOGLE_APPS_SCRIPT_URL` | Deployed Google Apps Script endpoint |
| `GOOGLE_APPS_SCRIPT_SECRET` | Shared secret for the Apps Script integration |
| `PORT` | Application port; defaults to 8080 |

### Run locally

1. Install a supported version of Node.js.
2. Clone this repository.
3. Install dependencies declared in `package.json`.
4. Configure the required environment variables securely.
5. Start the application using the start script in `package.json`.

### Health endpoint

When the application is running, the `/health` endpoint provides application configuration status. A successful health response does not, by itself, confirm that every bot journey, AI response or data-saving workflow has been fully tested.

## 🏥 About Trust Oo

**Trust Oo Co., Ltd.** is a Myanmar social enterprise working to improve access to digital health information and services.

Htuu Care is part of Trust Oo's wider commitment to making health information more accessible and connecting people with appropriate support.

**Related service:** [7887 Healthcare Call Center](https://t.me/HtooCare_Bot)

- Website: [Trust Oo](https://trustooglobal.com)
- Telegram prototype: [@HtooCare_Bot](https://t.me/HtooCare_Bot)

---

<p align="center">
  <strong>Health information should be understandable, accessible and respectful to everyone.</strong>
</p>

<p align="center">
  <em>Htuu Care — Supporting informed health decisions through digital access and human connection.</em>
</p>

#HtuuCare #DigitalHealth #SRHR #FemTech #HealthInformation #HealthcareAccess #TrustOo
