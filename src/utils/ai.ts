import { createServerFn } from '@tanstack/react-start'
import { Anthropic } from '@anthropic-ai/sdk'
import { DEFAULT_MODEL, MODELS } from './models'

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
}

const DEFAULT_SYSTEM_PROMPT = `You are a highly capable, friendly AI assistant. Give accurate, thoughtful, genuinely helpful answers: think through problems carefully, say so when you are unsure instead of guessing, and match the length of your answer to the question. Use Markdown for clear and structured responses. Format your responses following these guidelines:

1. Use headers for sections:
   # For main topics
   ## For subtopics
   ### For subsections

2. For lists and steps:
   - Use bullet points for unordered lists
   - Number steps when sequence matters
   
3. For code:
   - Use inline \`code\` for short snippets
   - Use triple backticks with language for blocks:
   \`\`\`python
   def example():
       return "like this"
   \`\`\`

4. For emphasis:
   - Use **bold** for important points
   - Use *italics* for emphasis
   - Use > for important quotes or callouts

5. For structured data:
   | Use | Tables |
   |-----|---------|
   | When | Needed |

6. Break up long responses with:
   - Clear section headers
   - Appropriate spacing between sections
   - Bullet points for better readability
   - Short, focused paragraphs

7. For technical content:
   - Always specify language for code blocks
   - Use inline \`code\` for technical terms
   - Include example usage where helpful

Keep responses well-structured and no longer than they need to be. Use appropriate Markdown formatting to enhance readability and understanding.`

// Roughly 4 characters per token; keep well under the 200k token context window
// so arbitrarily long conversations keep working by dropping the oldest turns.
const MAX_CONTEXT_CHARS = 400_000

const trimToContext = (msgs: Array<{ role: Message['role']; content: string }>) => {
  let total = 0
  let start = msgs.length
  while (start > 0 && total + msgs[start - 1].content.length <= MAX_CONTEXT_CHARS) {
    total += msgs[start - 1].content.length
    start--
  }
  // Always keep at least the latest message, and start on a user turn
  let trimmed = msgs.slice(Math.min(start, msgs.length - 1))
  while (trimmed.length > 1 && trimmed[0].role !== 'user') trimmed = trimmed.slice(1)
  return trimmed
}

const errorResponse = (error: string, status: number) =>
  new Response(JSON.stringify({ error }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

// Streaming implementation
export const genAIResponse = createServerFn({ method: 'POST', response: 'raw' })
  .inputValidator(
    (d: {
      messages: Array<Message>
      systemPrompt?: { value: string; enabled: boolean }
      model?: string
    }) => d,
  )
  .handler(async ({ data }) => {
    // Netlify AI Gateway injects credentials automatically
    const anthropic = new Anthropic({ timeout: 10 * 60 * 1000 })

    const model = MODELS.some((m) => m.id === data.model) ? data.model! : DEFAULT_MODEL

    // Filter out error messages and empty messages
    const formattedMessages = trimToContext(
      data.messages
        .filter(
          (msg) =>
            msg.content.trim() !== '' &&
            !msg.content.startsWith('Sorry, I encountered an error'),
        )
        .map((msg) => ({
          role: msg.role,
          content: msg.content.trim(),
        })),
    )

    if (formattedMessages.length === 0) {
      return errorResponse('No valid messages to send', 400)
    }

    const systemPrompt = data.systemPrompt?.enabled
      ? `${DEFAULT_SYSTEM_PROMPT}\n\n${data.systemPrompt.value}`
      : DEFAULT_SYSTEM_PROMPT

    try {
      const stream = anthropic.messages.stream({
        model,
        max_tokens: 32000,
        system: systemPrompt,
        messages: formattedMessages,
      })

      // Each line of the response body is one JSON object
      const encoder = new TextEncoder()
      const send = (controller: ReadableStreamDefaultController, chunk: object) =>
        controller.enqueue(encoder.encode(JSON.stringify(chunk) + '\n'))

      const transformedStream = new ReadableStream({
        async start(controller) {
          try {
            for await (const event of stream) {
              if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
                send(controller, {
                  type: 'content_block_delta',
                  delta: { type: 'text_delta', text: event.delta.text },
                })
              }
            }
            controller.close()
          } catch (error) {
            console.error('Stream error:', error)
            send(controller, { type: 'error', error: describeError(error) })
            controller.close()
          }
        },
        cancel() {
          stream.abort()
        },
      })

      return new Response(transformedStream, {
        headers: { 'Content-Type': 'application/x-ndjson' },
      })
    } catch (error) {
      console.error('Error in genAIResponse:', error)
      return errorResponse(describeError(error), 500)
    }
  })

function describeError(error: unknown) {
  if (error instanceof Anthropic.RateLimitError) {
    return 'The AI is getting a lot of requests right now. Please try again in a moment.'
  }
  if (error instanceof Anthropic.APIConnectionError) {
    return 'Could not reach the AI service. Please try again.'
  }
  if (error instanceof Error) return error.message
  return 'Failed to get AI response'
}

// Short title for a new conversation, generated by a fast model
export const genTitle = createServerFn({ method: 'POST' })
  .inputValidator((d: { text: string }) => ({ text: String(d.text).slice(0, 2000) }))
  .handler(async ({ data }) => {
    try {
      const anthropic = new Anthropic()
      const result = await anthropic.messages.create({
        model: 'claude-haiku-5-5',
        max_tokens: 30,
        system:
          'Write a short title (2-6 words) for a chat that starts with the user message below. Reply with the title only, no quotes or punctuation at the end.',
        messages: [{ role: 'user', content: data.text }],
      })
      const block = result.content.find((b) => b.type === 'text')
      const title = block && block.type === 'text' ? block.text.trim().replace(/^["']|["'.]$/g, '') : ''
      return { title: title.slice(0, 80) }
    } catch (error) {
      console.error('Error generating title:', error)
      return { title: '' }
    }
  })
