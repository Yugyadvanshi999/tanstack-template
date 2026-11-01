import { createServerFn } from '@tanstack/react-start'
import { and, asc, desc, eq, inArray } from 'drizzle-orm'
import { db } from '../../db'
import { conversations, messages } from '../../db/schema'
import type { Message } from './ai'

export interface ConversationSummary {
  id: string
  title: string
}

const isRole = (role: string): role is Message['role'] =>
  role === 'user' || role === 'assistant'

const requireId = (value: unknown, name: string) => {
  if (typeof value !== 'string' || value.length === 0 || value.length > 100) {
    throw new Error(`Invalid ${name}`)
  }
  return value
}

const ownsConversation = async (clientId: string, conversationId: string) => {
  const [row] = await db
    .select({ id: conversations.id })
    .from(conversations)
    .where(and(eq(conversations.id, conversationId), eq(conversations.clientId, clientId)))
  return Boolean(row)
}

export const listConversations = createServerFn({ method: 'GET' })
  .inputValidator((d: { clientId: string }) => ({ clientId: requireId(d.clientId, 'clientId') }))
  .handler(async ({ data }): Promise<ConversationSummary[]> => {
    return db
      .select({ id: conversations.id, title: conversations.title })
      .from(conversations)
      .where(eq(conversations.clientId, data.clientId))
      .orderBy(desc(conversations.updatedAt))
  })

export const getMessages = createServerFn({ method: 'GET' })
  .inputValidator((d: { clientId: string; conversationId: string }) => ({
    clientId: requireId(d.clientId, 'clientId'),
    conversationId: requireId(d.conversationId, 'conversationId'),
  }))
  .handler(async ({ data }): Promise<Message[]> => {
    if (!(await ownsConversation(data.clientId, data.conversationId))) return []
    const rows = await db
      .select({ id: messages.id, role: messages.role, content: messages.content })
      .from(messages)
      .where(eq(messages.conversationId, data.conversationId))
      .orderBy(asc(messages.createdAt))
    return rows.filter((r): r is Message => isRole(r.role))
  })

export const createConversation = createServerFn({ method: 'POST' })
  .inputValidator((d: { clientId: string; id: string; title: string }) => ({
    clientId: requireId(d.clientId, 'clientId'),
    id: requireId(d.id, 'id'),
    title: String(d.title).slice(0, 200),
  }))
  .handler(async ({ data }) => {
    await db.insert(conversations).values(data).onConflictDoNothing()
    return { ok: true }
  })

export const renameConversation = createServerFn({ method: 'POST' })
  .inputValidator((d: { clientId: string; id: string; title: string }) => ({
    clientId: requireId(d.clientId, 'clientId'),
    id: requireId(d.id, 'id'),
    title: String(d.title).slice(0, 200),
  }))
  .handler(async ({ data }) => {
    await db
      .update(conversations)
      .set({ title: data.title })
      .where(and(eq(conversations.id, data.id), eq(conversations.clientId, data.clientId)))
    return { ok: true }
  })

export const deleteConversation = createServerFn({ method: 'POST' })
  .inputValidator((d: { clientId: string; id: string }) => ({
    clientId: requireId(d.clientId, 'clientId'),
    id: requireId(d.id, 'id'),
  }))
  .handler(async ({ data }) => {
    await db
      .delete(conversations)
      .where(and(eq(conversations.id, data.id), eq(conversations.clientId, data.clientId)))
    return { ok: true }
  })

export const saveMessage = createServerFn({ method: 'POST' })
  .inputValidator((d: { clientId: string; conversationId: string; message: Message }) => {
    if (!isRole(d.message?.role)) throw new Error('Invalid role')
    return {
      clientId: requireId(d.clientId, 'clientId'),
      conversationId: requireId(d.conversationId, 'conversationId'),
      message: {
        id: requireId(d.message.id, 'message.id'),
        role: d.message.role,
        content: String(d.message.content),
      },
    }
  })
  .handler(async ({ data }) => {
    if (!(await ownsConversation(data.clientId, data.conversationId))) {
      throw new Error('Conversation not found')
    }
    await db
      .insert(messages)
      .values({ ...data.message, conversationId: data.conversationId })
      .onConflictDoNothing()
    await db
      .update(conversations)
      .set({ updatedAt: new Date() })
      .where(eq(conversations.id, data.conversationId))
    return { ok: true }
  })

export const deleteMessages = createServerFn({ method: 'POST' })
  .inputValidator((d: { clientId: string; conversationId: string; ids: string[] }) => ({
    clientId: requireId(d.clientId, 'clientId'),
    conversationId: requireId(d.conversationId, 'conversationId'),
    ids: d.ids.map((id) => requireId(id, 'id')),
  }))
  .handler(async ({ data }) => {
    if (data.ids.length === 0) return { ok: true }
    if (!(await ownsConversation(data.clientId, data.conversationId))) {
      throw new Error('Conversation not found')
    }
    await db
      .delete(messages)
      .where(and(eq(messages.conversationId, data.conversationId), inArray(messages.id, data.ids)))
    return { ok: true }
  })
