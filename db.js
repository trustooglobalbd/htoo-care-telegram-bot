
const crypto = require('crypto');
const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not configured.');
}

if (!process.env.DATA_HASH_SECRET ||
    process.env.DATA_HASH_SECRET.length < 32) {
  throw new Error('DATA_HASH_SECRET must be at least 32 characters.');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === 'true'
    ? { rejectUnauthorized: false }
    : undefined,
  max: 5,
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000
});

// Convert Telegram's internal user ID to a pseudonymous key.
// The original Telegram ID is never written to PostgreSQL.
function makeUserKey(telegramUserId) {
  return crypto
    .createHmac('sha256', process.env.DATA_HASH_SECRET)
    .update(String(telegramUserId))
    .digest('hex');
}

async function ensureUser(userKey, language = 'my') {
  await pool.query(
    `INSERT INTO hc_users (user_key, language)
     VALUES ($1, $2)
     ON CONFLICT (user_key)
     DO UPDATE SET language = EXCLUDED.language`,
    [userKey, language]
  );
}

async function setConsent(userKey, language, consent) {
  await pool.query(
    `INSERT INTO hc_users
       (user_key, language, analytics_consent, consent_updated_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (user_key)
     DO UPDATE SET
       language = EXCLUDED.language,
       analytics_consent = EXCLUDED.analytics_consent,
       consent_updated_at = NOW()`,
    [userKey, language, consent]
  );

  // When analytics consent is withdrawn, delete prior analytics
  // events for that pseudonymous user as a privacy-first default.
  if (!consent) {
    await pool.query(
      'DELETE FROM hc_events WHERE user_key = $1',
      [userKey]
    );
  }
}

async function trackEvent(
  userKey,
  eventType,
  category = null,
  severity = null
) {
  const allowedEvents = new Set([
    'bot_start',
    'language_selected',
    'education_open',
    'education_chapter',
    'symptom_flow_opened',
    'symptom_category_selected',
    'severity_selected',
    'referral_opened',
    'contact_7887_opened'
  ]);

  if (!allowedEvents.has(eventType)) {
    throw new Error('Unsupported analytics event.');
  }

  await pool.query(
    `INSERT INTO hc_events
       (user_key, event_type, category, severity)
     SELECT user_key, $2, $3, $4
     FROM hc_users
     WHERE user_key = $1
       AND analytics_consent = TRUE`,
    [userKey, eventType, category, severity]
  );
}

async function getMonthlyReport() {
  const result = await pool.query(`
    SELECT
      COUNT(*) FILTER (
        WHERE event_type = 'bot_start'
      ) AS starts,

      COUNT(DISTINCT user_key) AS active_users,

      COUNT(*) FILTER (
        WHERE event_type = 'education_open'
      ) AS education_menu_opens,

      COUNT(*) FILTER (
        WHERE event_type = 'education_chapter'
      ) AS chapter_views,

      COUNT(*) FILTER (
        WHERE event_type = 'symptom_flow_opened'
      ) AS symptom_guide_opens,

      COUNT(*) FILTER (
        WHERE event_type = 'referral_opened'
      ) AS referral_requests,

      COUNT(*) FILTER (
        WHERE event_type = 'contact_7887_opened'
      ) AS contact_7887_opens

    FROM hc_events
    WHERE created_at >= date_trunc('month', NOW())
      AND created_at < date_trunc('month', NOW())
                         + INTERVAL '1 month'
  `);

  const categories = await pool.query(`
    SELECT category, COUNT(*) AS total
    FROM hc_events
    WHERE created_at >= date_trunc('month', NOW())
      AND created_at < date_trunc('month', NOW())
                         + INTERVAL '1 month'
      AND event_type = 'symptom_category_selected'
      AND category IS NOT NULL
    GROUP BY category
    ORDER BY total DESC
  `);

  const chapters = await pool.query(`
    SELECT category, COUNT(*) AS total
    FROM hc_events
    WHERE created_at >= date_trunc('month', NOW())
      AND created_at < date_trunc('month', NOW())
                         + INTERVAL '1 month'
      AND event_type = 'education_chapter'
      AND category IS NOT NULL
    GROUP BY category
    ORDER BY total DESC
  `);

  return {
    summary: result.rows[0],
    symptomCategories: categories.rows,
    chapters: chapters.rows
  };
}

async function closePool() {
  await pool.end();
}

module.exports = {
  pool,
  makeUserKey,
  ensureUser,
  setConsent,
  trackEvent,
  getMonthlyReport,
  closePool
};
