
CREATE TABLE IF NOT EXISTS hc_users (
    user_key CHAR(64) PRIMARY KEY,
    language VARCHAR(5) NOT NULL DEFAULT 'my',
    analytics_consent BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    consent_updated_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS hc_events (
    event_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_key CHAR(64) NOT NULL
        REFERENCES hc_users(user_key) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL,
    category VARCHAR(60),
    severity VARCHAR(20),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT hc_event_type_allowed CHECK (
        event_type IN (
            'bot_start',
            'language_selected',
            'education_open',
            'education_chapter',
            'symptom_flow_opened',
            'symptom_category_selected',
            'severity_selected',
            'referral_opened',
            'contact_7887_opened'
        )
    ),

    CONSTRAINT hc_severity_allowed CHECK (
        severity IS NULL OR severity IN (
            'mild', 'moderate', 'severe'
        )
    )
);

CREATE INDEX IF NOT EXISTS idx_hc_events_created_at
    ON hc_events(created_at);

CREATE INDEX IF NOT EXISTS idx_hc_events_type_date
    ON hc_events(event_type, created_at);

CREATE INDEX IF NOT EXISTS idx_hc_events_category_date
    ON hc_events(category, created_at);

CREATE INDEX IF NOT EXISTS idx_hc_events_user_date
    ON hc_events(user_key, created_at);
