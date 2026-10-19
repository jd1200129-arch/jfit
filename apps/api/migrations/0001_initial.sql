-- Jfit initial relational foundation. Apply with psql; all timestamps are timestamptz (UTC).
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE TYPE staff_role AS ENUM ('administrator','content_manager','trainer','commerce','support','finance');
CREATE TYPE subscription_status AS ENUM ('pending','active','past_due','cancel_at_period_end','cancelled','expired','refunded');
CREATE TYPE order_status AS ENUM ('pending_payment','paid','reserved','fulfilling','shipped','delivered','cancelled','refund_pending','partially_refunded','refunded');
CREATE TYPE capability_state AS ENUM ('disabled','configured_unverified','enabled');

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email text NOT NULL UNIQUE,
  password_hash text,
  email_verified_at timestamptz, display_name text NOT NULL DEFAULT '',
  birth_date date, country_code char(2) NOT NULL DEFAULT 'GB',
  created_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz,
  CHECK (email = lower(email))
);
CREATE TABLE staff_memberships (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  role staff_role NOT NULL, approved_by uuid REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE, device_label text, expires_at timestamptz NOT NULL,
  revoked_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sessions_live_by_user ON sessions(user_id, expires_at) WHERE revoked_at IS NULL;
CREATE TABLE auth_tokens (
  token_hash text PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose text NOT NULL CHECK (purpose IN ('verify_email','recover_password','invite')),
  expires_at timestamptz NOT NULL, consumed_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX auth_tokens_live_user ON auth_tokens(user_id,purpose,expires_at) WHERE consumed_at IS NULL;
CREATE TABLE auth_rate_limits (
  bucket_hash char(64) PRIMARY KEY, window_started_at timestamptz NOT NULL, attempts integer NOT NULL CHECK(attempts >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE plans (
  id text PRIMARY KEY, name text NOT NULL, seat_limit smallint NOT NULL CHECK (seat_limit BETWEEN 1 AND 5),
  features jsonb NOT NULL DEFAULT '[]', active boolean NOT NULL DEFAULT false
);
CREATE TABLE plan_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), plan_id text NOT NULL REFERENCES plans(id),
  interval text NOT NULL CHECK(interval IN ('month','year')), amount_minor integer NOT NULL CHECK(amount_minor > 0),
  currency char(3) NOT NULL DEFAULT 'GBP', active boolean NOT NULL DEFAULT false,
  UNIQUE(plan_id, interval, currency)
);
INSERT INTO plans(id,name,seat_limit,features) VALUES
 ('train','Jfit Train',1,'["individual_training","programmes","progress"]'),
 ('pro','Jfit Pro',5,'["individual_training","programmes","progress","family_seats","premium_capabilities"]');
INSERT INTO plan_prices(plan_id,interval,amount_minor) VALUES ('train','month',1400),('train','year',14400),('pro','month',3400),('pro','year',34900);
CREATE TABLE subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_user_id uuid NOT NULL REFERENCES users(id), plan_id text NOT NULL REFERENCES plans(id),
  price_id uuid NOT NULL REFERENCES plan_prices(id), status subscription_status NOT NULL DEFAULT 'pending', source text NOT NULL DEFAULT 'web',
  provider text NOT NULL DEFAULT 'none', provider_subscription_id text UNIQUE, current_period_start timestamptz,
  current_period_end timestamptz, cancel_at_period_end boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(), CHECK(current_period_end IS NULL OR current_period_start < current_period_end)
);
CREATE TABLE subscription_members (
  subscription_id uuid NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  member_user_id uuid NOT NULL REFERENCES users(id), invited_at timestamptz NOT NULL DEFAULT now(), accepted_at timestamptz,
  PRIMARY KEY(subscription_id, member_user_id)
);
CREATE TABLE invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), subscription_id uuid NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  invited_email text NOT NULL, token_hash text NOT NULL UNIQUE, expires_at timestamptz NOT NULL,
  accepted_by uuid REFERENCES users(id), accepted_at timestamptz, revoked_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), slug text NOT NULL UNIQUE, name text NOT NULL,
  category text NOT NULL CHECK(category IN ('treadmill','bike','cross_trainer','rower','pilates','accessory','bundle')),
  description text NOT NULL DEFAULT '', published boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE product_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), product_id uuid NOT NULL REFERENCES products(id), sku text NOT NULL UNIQUE,
  model text, specs jsonb NOT NULL DEFAULT '{}', price_minor integer NOT NULL CHECK(price_minor >= 0), currency char(3) NOT NULL DEFAULT 'GBP',
  tax_minor integer, tax_configuration text NOT NULL DEFAULT 'unconfigured', inventory_on_hand integer NOT NULL DEFAULT 0 CHECK(inventory_on_hand >= 0),
  reserved_count integer NOT NULL DEFAULT 0 CHECK(reserved_count >= 0 AND reserved_count <= inventory_on_hand), published boolean NOT NULL DEFAULT false
);
CREATE TABLE carts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid REFERENCES users(id), anonymous_token_hash text UNIQUE,
  currency char(3) NOT NULL DEFAULT 'GBP', updated_at timestamptz NOT NULL DEFAULT now(), CHECK(user_id IS NOT NULL OR anonymous_token_hash IS NOT NULL)
);
CREATE TABLE cart_items (
  cart_id uuid NOT NULL REFERENCES carts(id) ON DELETE CASCADE, variant_id uuid NOT NULL REFERENCES product_variants(id),
  quantity integer NOT NULL CHECK(quantity > 0), PRIMARY KEY(cart_id, variant_id)
);
CREATE TABLE orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_number text NOT NULL UNIQUE, user_id uuid NOT NULL REFERENCES users(id),
  status order_status NOT NULL DEFAULT 'pending_payment', currency char(3) NOT NULL DEFAULT 'GBP',
  subtotal_minor integer NOT NULL CHECK(subtotal_minor >= 0), tax_minor integer, shipping_minor integer, total_minor integer NOT NULL CHECK(total_minor >= 0),
  billing_snapshot jsonb NOT NULL, shipping_snapshot jsonb NOT NULL, reservation_expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_id uuid NOT NULL REFERENCES orders(id), variant_id uuid REFERENCES product_variants(id),
  sku_snapshot text NOT NULL, title_snapshot text NOT NULL, quantity integer NOT NULL CHECK(quantity > 0),
  unit_price_minor integer NOT NULL CHECK(unit_price_minor >= 0), tax_minor integer, line_total_minor integer NOT NULL CHECK(line_total_minor >= 0)
);
CREATE TABLE payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_id uuid REFERENCES orders(id), subscription_id uuid REFERENCES subscriptions(id),
  provider text NOT NULL, provider_payment_id text, status text NOT NULL, amount_minor integer NOT NULL CHECK(amount_minor >= 0),
  currency char(3) NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), CHECK(order_id IS NOT NULL OR subscription_id IS NOT NULL)
);
CREATE UNIQUE INDEX payments_provider_id_uq ON payments(provider,provider_payment_id) WHERE provider_payment_id IS NOT NULL;
CREATE TABLE processed_events (
  provider text NOT NULL, event_id text NOT NULL, event_type text NOT NULL, processed_at timestamptz,
  payload_hash text NOT NULL, PRIMARY KEY(provider,event_id)
);

CREATE TABLE trainers (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), display_name text NOT NULL, biography text NOT NULL DEFAULT '', published boolean NOT NULL DEFAULT false);
CREATE TABLE workouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), slug text NOT NULL UNIQUE, title text NOT NULL, activity text NOT NULL,
  duration_minutes smallint NOT NULL CHECK(duration_minutes > 0), difficulty text NOT NULL CHECK(difficulty IN ('beginner','intermediate','advanced')),
  trainer_id uuid REFERENCES trainers(id), required_equipment text[] NOT NULL DEFAULT '{}', membership_required text NOT NULL DEFAULT 'train', published boolean NOT NULL DEFAULT false
);
CREATE TABLE media_assets (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workout_id uuid REFERENCES workouts(id), provider text NOT NULL DEFAULT 'none', provider_asset_id text, state text NOT NULL DEFAULT 'unavailable', captions jsonb NOT NULL DEFAULT '[]');
CREATE TABLE programs (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), slug text UNIQUE NOT NULL, title text NOT NULL, description text NOT NULL DEFAULT '', published boolean NOT NULL DEFAULT false);
CREATE TABLE program_sessions (program_id uuid NOT NULL REFERENCES programs(id), position smallint NOT NULL, workout_id uuid NOT NULL REFERENCES workouts(id), PRIMARY KEY(program_id,position), UNIQUE(program_id,workout_id));
CREATE TABLE schedules (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id), workout_id uuid NOT NULL REFERENCES workouts(id), scheduled_at timestamptz NOT NULL, status text NOT NULL DEFAULT 'scheduled');
CREATE TABLE completions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id), workout_id uuid NOT NULL REFERENCES workouts(id), operation_id uuid NOT NULL, completed_at timestamptz NOT NULL, metrics jsonb NOT NULL DEFAULT '{}', UNIQUE(user_id,operation_id));
CREATE TABLE capability_flags (key text PRIMARY KEY, state capability_state NOT NULL DEFAULT 'disabled', updated_at timestamptz NOT NULL DEFAULT now(), notes text NOT NULL DEFAULT '');
INSERT INTO capability_flags(key,notes) VALUES ('ai_coach','Provider and adult eligibility controls required'),('maps','Route provider required'),('health_integrations','Native platform permissions and providers required'),('hardware_control','Verified device capability contract and safety controls required'),('live_classes','Optional extension; disabled by default'),('private_sessions','Optional extension; disabled by default');
CREATE TABLE audit_events (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), actor_user_id uuid REFERENCES users(id), action text NOT NULL, resource_type text NOT NULL, resource_id text, details jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE integration_consents (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id), integration text NOT NULL, granted_at timestamptz NOT NULL DEFAULT now(), revoked_at timestamptz, UNIQUE(user_id,integration));
CREATE TABLE support_cases (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid REFERENCES users(id), order_id uuid REFERENCES orders(id), status text NOT NULL DEFAULT 'open', subject text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE shipments (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_id uuid NOT NULL REFERENCES orders(id), carrier text, tracking_number text, status text NOT NULL DEFAULT 'unconfigured', shipped_at timestamptz, delivered_at timestamptz);
CREATE TABLE return_requests (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_id uuid NOT NULL REFERENCES orders(id), user_id uuid NOT NULL REFERENCES users(id), status text NOT NULL DEFAULT 'requested', reason text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE refunds (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), payment_id uuid NOT NULL REFERENCES payments(id), provider_refund_id text UNIQUE, amount_minor integer NOT NULL CHECK(amount_minor > 0), status text NOT NULL DEFAULT 'requested', created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE product_reviews (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), product_id uuid NOT NULL REFERENCES products(id), user_id uuid NOT NULL REFERENCES users(id), order_id uuid REFERENCES orders(id), rating smallint NOT NULL CHECK(rating BETWEEN 1 AND 5), body text NOT NULL DEFAULT '', status text NOT NULL DEFAULT 'pending', created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(product_id,user_id));
CREATE TABLE notifications (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id), channel text NOT NULL, template_key text NOT NULL, status text NOT NULL DEFAULT 'queued', scheduled_at timestamptz, sent_at timestamptz, provider_message_id text);
CREATE TABLE notification_templates (key text PRIMARY KEY, subject text NOT NULL, body text NOT NULL, active boolean NOT NULL DEFAULT false, updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE outbox_jobs (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), topic text NOT NULL, aggregate_id uuid, payload jsonb NOT NULL, status text NOT NULL DEFAULT 'pending', attempts integer NOT NULL DEFAULT 0 CHECK(attempts >= 0), available_at timestamptz NOT NULL DEFAULT now(), locked_at timestamptz, completed_at timestamptz, provider_message_id text, last_error text, created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX outbox_jobs_ready ON outbox_jobs(available_at) WHERE status IN ('pending','retry');
CREATE UNIQUE INDEX outbox_provider_message_id_uq ON outbox_jobs(provider_message_id) WHERE provider_message_id IS NOT NULL;
CREATE TABLE account_data_requests (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id), request_type text NOT NULL CHECK(request_type IN ('export','deletion')), status text NOT NULL DEFAULT 'requested', created_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz, retention_notes text NOT NULL DEFAULT '');
COMMIT;
