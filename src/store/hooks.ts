import { useStore } from '@tanstack/react-store';
import { v4 as uuidv4 } from 'uuid';
import { actions, hydrateSettings, selectors, store, type Conversation } from './store';
import type { Message } from '../utils/ai';
import {
  createConversation,
  deleteConversation as deleteConversationFn,
  deleteMessages,
  getMessages,
  listConversations,
  renameConversation,
  saveMessage,
} from '../utils/chat-db';
import { useEffect } from 'react';

// Anonymous per-browser ID that scopes saved conversations
const CLIENT_ID_KEY = 'chat-client-id';

export function getClientId() {
  let id = localStorage.getItem(CLIENT_ID_KEY);
  if (!id) {
    id = uuidv4();
    localStorage.setItem(CLIENT_ID_KEY, id);
  }
  return id;
}

// Original app hook that matches the interface expected by the app
export function useAppState() {
  const isLoading = useStore(store, s => selectors.getIsLoading(s));
  const conversations = useStore(store, s => selectors.getConversations(s));
  const currentConversationId = useStore(store, s => selectors.getCurrentConversationId(s));
  const prompts = useStore(store, s => selectors.getPrompts(s));
  const selectedModel = useStore(store, s => selectors.getSelectedModel(s));

  return {
    conversations,
    currentConversationId,
    isLoading,
    prompts,
    selectedModel,

    // Actions
    setCurrentConversationId: actions.setCurrentConversationId,
    addConversation: actions.addConversation,
    deleteConversation: actions.deleteConversation,
    updateConversationTitle: actions.updateConversationTitle,
    addMessage: actions.addMessage,
    setLoading: actions.setLoading,
    setSelectedModel: actions.setSelectedModel,
    createPrompt: actions.createPrompt,
    deletePrompt: actions.deletePrompt,
    setPromptActive: actions.setPromptActive,

    // Selectors
    getCurrentConversation: selectors.getCurrentConversation,
    getActivePrompt: selectors.getActivePrompt,
  };
}

// Hook for conversations saved in Netlify Database
export function useConversations() {
  const conversations = useStore(store, s => selectors.getConversations(s));
  const currentConversationId = useStore(store, s => selectors.getCurrentConversationId(s));
  const currentConversation = useStore(store, s => selectors.getCurrentConversation(s));

  // Load settings and the conversation list once in the browser
  useEffect(() => {
    const unsubscribe = hydrateSettings();
    listConversations({ data: { clientId: getClientId() } })
      .then((list) => {
        const local = store.state.conversations;
        const merged: Conversation[] = [
          ...local.filter(c => !list.some(l => l.id === c.id)),
          ...list.map(l => local.find(c => c.id === l.id) ?? { ...l, messages: [] }),
        ];
        actions.setConversations(merged);
      })
      .catch((error) => console.error('Failed to load conversations:', error));
    return unsubscribe;
  }, []);

  // Fetch messages the first time a saved conversation is opened
  useEffect(() => {
    if (!currentConversation || currentConversation.loaded || currentConversation.messages.length > 0) {
      return;
    }
    const id = currentConversation.id;
    getMessages({ data: { clientId: getClientId(), conversationId: id } })
      .then((msgs) => actions.setMessages(id, msgs))
      .catch((error) => console.error('Failed to load messages:', error));
  }, [currentConversation]);

  return {
    conversations,
    currentConversationId,
    currentConversation,

    setCurrentConversationId: (id: string | null) => {
      actions.setCurrentConversationId(id);
    },

    createNewConversation: async (title: string = 'New Conversation') => {
      const id = uuidv4();
      actions.addConversation({ id, title, messages: [], loaded: true });
      try {
        await createConversation({ data: { clientId: getClientId(), id, title } });
      } catch (error) {
        console.error('Failed to save conversation:', error);
      }
      return id;
    },

    updateConversationTitle: async (id: string, title: string) => {
      actions.updateConversationTitle(id, title);
      try {
        await renameConversation({ data: { clientId: getClientId(), id, title } });
      } catch (error) {
        console.error('Failed to rename conversation:', error);
      }
    },

    deleteConversation: async (id: string) => {
      actions.deleteConversation(id);
      try {
        await deleteConversationFn({ data: { clientId: getClientId(), id } });
      } catch (error) {
        console.error('Failed to delete conversation:', error);
      }
    },

    addMessage: async (conversationId: string, message: Message) => {
      actions.addMessage(conversationId, message);
      try {
        await saveMessage({ data: { clientId: getClientId(), conversationId, message } });
      } catch (error) {
        console.error('Failed to save message:', error);
      }
    },

    removeMessages: async (conversationId: string, ids: string[]) => {
      actions.removeMessages(conversationId, ids);
      try {
        await deleteMessages({ data: { clientId: getClientId(), conversationId, ids } });
      } catch (error) {
        console.error('Failed to delete messages:', error);
      }
    },
  };
}
