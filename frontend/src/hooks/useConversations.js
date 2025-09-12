import { useState, useEffect, useMemo } from 'react';
import { dbApi } from '../services/localDb';

/**
 * Custom hook for managing global conversations
 * @param {string} email - User email
 * @returns {Object} Conversation management state and methods
 */
export const useConversations = (email) => {
  const [list, setList] = useState(() => dbApi.globalConvs(email));
  const [currentId, setCurrentId] = useState(list[0]?.id || null);
  
  const current = useMemo(() => 
    list.find(c => c.id === currentId) || null, 
    [list, currentId]
  );

  // Save conversations to local storage whenever list changes
  useEffect(() => {
    dbApi.saveGlobalConvs(email, list);
  }, [email, list]);

  // Migrate historical conversation titles (one-time operation)
  useEffect(() => {
    const needsMigration = list.some(conv => 
      conv.title.includes('Conversation #') || 
      conv.title.includes('#') ||
      (conv.title === 'New Conversation' && !conv.title.includes('💬'))
    );
    
    if (needsMigration) {
      const migratedList = list.map((conv) => {
        if (conv.title.includes('Conversation #') || 
            conv.title.includes('#') || 
            (conv.title === 'New Conversation' && !conv.title.includes('💬'))) {
          
          const firstUserMessage = conv.messages.find(m => m.role === 'user');
          
          if (firstUserMessage) {
            const cleanMessage = firstUserMessage.text.trim().replace(/\n/g, ' ');
            const messageTitle = cleanMessage.length <= 40 ? cleanMessage : cleanMessage.substring(0, 37) + '...';
            return { ...conv, title: `💭 ${messageTitle}` };
          } else {
            const timestamp = conv.updatedAt || Date.now();
            const date = new Date(timestamp);
            const timeString = date.toLocaleString('en-US', {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
              hour12: false
            });
            return { ...conv, title: `💬 New Conversation · ${timeString}` };
          }
        }
        return conv;
      });
      setList(migratedList);
    }
  }, [list]);

  return {
    list,
    setList,
    current,
    currentId,
    setCurrentId
  };
};

/**
 * Generate conversation title from message content
 * @param {string} message - Message content
 * @returns {string} Generated title
 */
export const generateTitleFromMessage = (message) => {
  const now = new Date();
  const timeString = now.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
  
  if (!message || message.trim().length === 0) {
    return `💬 New Conversation · ${timeString}`;
  }
  
  const cleanMessage = message.trim().replace(/\n/g, ' ');
  const messageTitle = cleanMessage.length <= 40 ? cleanMessage : cleanMessage.substring(0, 37) + '...';
  
  return `💭 ${messageTitle}`;
};

/**
 * Create a new conversation
 * @param {Function} setList - List setter function
 * @param {Function} setCurrentId - Current ID setter function
 */
export const createNewConversation = (setList, setCurrentId) => {
  const id = Math.random().toString(36).slice(2);
  
  const now = new Date();
  const timeString = now.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
  
  const title = `💬 New Conversation · ${timeString}`;
  const conversation = { id, title, messages: [], updatedAt: Date.now() };
  
  setList(prev => [conversation, ...prev]);
  setCurrentId(id);
  
  return conversation;
};

// Default export
export default useConversations;
