-- Tabla de mensajes de WhatsApp persistidos por Cleexs.
-- Captura entrantes (cliente -> Cleexs) y salientes (Cleexs -> cliente).
CREATE TABLE IF NOT EXISTS "whatsapp_messages" (
  "id"            TEXT PRIMARY KEY,
  "chat_id"       TEXT NOT NULL,
  "phone_digits"  TEXT,
  "direction"     TEXT NOT NULL,
  "message"       TEXT NOT NULL,
  "media_url"     TEXT,
  "status"        TEXT NOT NULL DEFAULT 'received',
  "source"        TEXT,
  "external_id"   TEXT,
  "error_message" TEXT,
  "diagnostic_id" TEXT,
  "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "whatsapp_messages_chat_created_idx"  ON "whatsapp_messages"("chat_id", "created_at");
CREATE INDEX IF NOT EXISTS "whatsapp_messages_phone_idx"         ON "whatsapp_messages"("phone_digits");
CREATE INDEX IF NOT EXISTS "whatsapp_messages_created_idx"       ON "whatsapp_messages"("created_at");
