import { Store } from '@tanstack/store'
import type { Message } from '../utils/ai'
import { DEFAULT_MODEL } from '../utils/models'

// Types
export interface Prompt {
  id: string
  name: string
  content: string
  is_active: boolean
  created_at: number
}

export interface Conversation {
  id: string
  title: string
  messages: Message[]
  // Whether messages have been fetched from the database
  loaded?: boolean
}

export interface State {
  prompts: Prompt[]
  conversations: Conversation[]
  currentConversationId: string | null
  isLoading: boolean
  selectedModel: string
}

const initialState: State = {
  prompts: [],
  conversations: [],
  currentConversationId: null,
  isLoading: false,
  selectedModel: DEFAULT_MODEL
}

export const store = new Store<State>(initialState)

// Persist prompts and model choice in the browser
const SETTINGS_KEY = 'chat-settings'

export function hydrateSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}')
    store.setState(state => ({
      ...state,
      prompts: Array.isArray(saved.prompts) ? saved.prompts : state.prompts,
      selectedModel: typeof saved.selectedModel === 'string' ? saved.selectedModel : state.selectedModel
    }))
  } catch {
    // Ignore malformed settings
  }
  return store.subscribe(() => {
    const { prompts, selectedModel } = store.state
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ prompts, selectedModel }))
  })
}

export const actions = {
  // Prompt actions
  createPrompt: (name: string, content: string) => {
    const id = Date.now().toString()
    store.setState(state => {
      const updatedPrompts = state.prompts.map(p => ({ ...p, is_active: false }))
      return {
        ...state,
        prompts: [
          ...updatedPrompts,
          {
            id,
            name,
            content,
            is_active: true,
            created_at: Date.now()
          }
        ]
      }
    })
  },

  deletePrompt: (id: string) => {
    store.setState(state => ({
      ...state,
      prompts: state.prompts.filter(p => p.id !== id)
    }))
  },

  setPromptActive: (id: string, shouldActivate: boolean) => {
    store.setState(state => {
      if (shouldActivate) {
        return {
          ...state,
          prompts: state.prompts.map(p => ({
            ...p,
            is_active: p.id === id ? true : false
          }))
        };
      } else {
        return {
          ...state,
          prompts: state.prompts.map(p => ({
            ...p,
            is_active: p.id === id ? false : p.is_active
          }))
        };
      }
    });
  },

  // Chat actions
  setConversations: (conversations: Conversation[]) => {
    store.setState(state => ({ ...state, conversations }))
  },

  setCurrentConversationId: (id: string | null) => {
    store.setState(state => ({ ...state, currentConversationId: id }))
  },

  addConversation: (conversation: Conversation) => {
    store.setState(state => ({
      ...state,
      conversations: [conversation, ...state.conversations],
      currentConversationId: conversation.id
    }))
  },

  updateConversationTitle: (id: string, title: string) => {
    store.setState(state => ({
      ...state,
      conversations: state.conversations.map(conv =>
        conv.id === id ? { ...conv, title } : conv
      )
    }))
  },

  deleteConversation: (id: string) => {
    store.setState(state => ({
      ...state,
      conversations: state.conversations.filter(conv => conv.id !== id),
      currentConversationId: state.currentConversationId === id ? null : state.currentConversationId
    }))
  },

  setMessages: (conversationId: string, messages: Message[]) => {
    store.setState(state => ({
      ...state,
      conversations: state.conversations.map(conv =>
        conv.id === conversationId ? { ...conv, messages, loaded: true } : conv
      )
    }))
  },

  removeMessages: (conversationId: string, ids: string[]) => {
    store.setState(state => ({
      ...state,
      conversations: state.conversations.map(conv =>
        conv.id === conversationId
          ? { ...conv, messages: conv.messages.filter(m => !ids.includes(m.id)) }
          : conv
      )
    }))
  },

  addMessage: (conversationId: string, message: Message) => {
    store.setState(state => ({
      ...state,
      conversations: state.conversations.map(conv =>
        conv.id === conversationId
          ? { ...conv, messages: [...conv.messages, message] }
          : conv
      ).sort((a, b) => (a.id === conversationId ? -1 : b.id === conversationId ? 1 : 0))
    }))
  },

  setLoading: (isLoading: boolean) => {
    store.setState(state => ({ ...state, isLoading }))
  },

  setSelectedModel: (selectedModel: string) => {
    store.setState(state => ({ ...state, selectedModel }))
  }
}

// Selectors
export const selectors = {
  getActivePrompt: (state: State) => state.prompts.find(p => p.is_active),
  getCurrentConversation: (state: State) =>
    state.conversations.find(c => c.id === state.currentConversationId),
  getPrompts: (state: State) => state.prompts,
  getConversations: (state: State) => state.conversations,
  getCurrentConversationId: (state: State) => state.currentConversationId,
  getIsLoading: (state: State) => state.isLoading,
  getSelectedModel: (state: State) => state.selectedModel
} 