import { useState, useRef, memo } from 'react'
import ReactMarkdown from 'react-markdown'
import rehypeRaw from 'rehype-raw'
import rehypeSanitize from 'rehype-sanitize'
import rehypeHighlight from 'rehype-highlight'
import { Check, Copy, RefreshCw } from 'lucide-react'
import type { Message } from '../utils/ai'

interface ChatMessageProps {
  message: Message
  isStreaming?: boolean
  onRegenerate?: () => void
}

const useCopy = () => {
  const [copied, setCopied] = useState(false)
  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch (error) {
      console.error('Copy failed:', error)
    }
  }
  return { copied, copy }
}

// Code block with a copy button
const CodeBlock = (props: React.HTMLAttributes<HTMLPreElement>) => {
  const ref = useRef<HTMLPreElement>(null)
  const { copied, copy } = useCopy()
  return (
    <div className="relative group/code">
      <button
        type="button"
        onClick={() => copy(ref.current?.innerText ?? '')}
        className="absolute flex items-center gap-1 px-2 py-1 text-xs text-gray-300 transition-opacity rounded opacity-0 top-2 right-2 bg-gray-700/80 hover:bg-gray-600 group-hover/code:opacity-100 focus:opacity-100"
        aria-label="Copy code"
      >
        {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
        {copied ? 'Copied' : 'Copy'}
      </button>
      <pre ref={ref} {...props} />
    </div>
  )
}

export const ChatMessage = memo(({ message, isStreaming = false, onRegenerate }: ChatMessageProps) => {
  const { copied, copy } = useCopy()
  const isAssistant = message.role === 'assistant'

  return (
    <div
      className={`group py-6 streaming-message ${
        isAssistant ? 'bg-gradient-to-r from-orange-500/5 to-red-600/5' : 'bg-transparent'
      }`}
    >
      <div className="flex items-start w-full max-w-3xl gap-4 mx-auto">
        {isAssistant ? (
          <div className="flex items-center justify-center flex-shrink-0 w-8 h-8 ml-4 text-sm font-medium text-white rounded-lg bg-gradient-to-r from-orange-500 to-red-600">
            AI
          </div>
        ) : (
          <div className="flex items-center justify-center flex-shrink-0 w-8 h-8 ml-4 text-sm font-medium text-white bg-gray-700 rounded-lg">
            Y
          </div>
        )}
        <div className="flex-1 min-w-0 mr-4">
          <div className={isStreaming ? 'streaming-cursor' : ''}>
            {isAssistant ? (
              <ReactMarkdown
                className="prose dark:prose-invert max-w-none"
                rehypePlugins={[rehypeRaw, rehypeSanitize, rehypeHighlight]}
                components={{ pre: CodeBlock }}
              >
                {message.content}
              </ReactMarkdown>
            ) : (
              <p className="text-gray-100 whitespace-pre-wrap break-words">{message.content}</p>
            )}
          </div>
          {!isStreaming && (
            <div className="flex gap-1 mt-2 transition-opacity opacity-0 group-hover:opacity-100 focus-within:opacity-100">
              <button
                type="button"
                onClick={() => copy(message.content)}
                className="flex items-center gap-1 px-2 py-1 text-xs text-gray-400 rounded hover:text-white hover:bg-gray-700/60"
                aria-label="Copy message"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copied' : 'Copy'}
              </button>
              {onRegenerate && (
                <button
                  type="button"
                  onClick={onRegenerate}
                  className="flex items-center gap-1 px-2 py-1 text-xs text-gray-400 rounded hover:text-white hover:bg-gray-700/60"
                  aria-label="Regenerate response"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Regenerate
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
})
