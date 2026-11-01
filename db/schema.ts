import { pgTable, text, timestamp, index } from 'drizzle-orm/pg-core'

// Conversations are scoped to an anonymous per-browser client ID
export const conversations = pgTable(
  'conversations',
  {
    id: text().primaryKey(),
    clientId: text('client_id').notNull(),
    title: text().notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [index('conversations_client_id_idx').on(t.clientId, t.updatedAt)],
)

export const messages = pgTable(
  'messages',
  {
    id: text().primaryKey(),
    conversationId: text('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    role: text().notNull(),
    content: text().notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [index('messages_conversation_id_idx').on(t.conversationId, t.createdAt)],
)
