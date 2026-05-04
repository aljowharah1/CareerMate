import { useState, useCallback } from 'react';
import type { Application, ChatMessage, Internship, UserProfile } from '../types';
import { sendChatMessage } from '../services/ai/chatbot';
import { calculateMatchScore, MatchResult } from '../services/ai/matchingEngine';

interface UseAIOptions {
  profile?: UserProfile | null;
  applications?: Application[];
  internships?: Internship[];
}

export function useAI(options: UseAIOptions = {}) {
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);

  const sendMessage = useCallback(async (content: string) => {
    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
    };

    setChatMessages((prev) => [...prev, userMessage]);
    setIsTyping(true);

    try {
      const response = await sendChatMessage(
        content,
        [...chatMessages, userMessage],
        {
          profile: options.profile ?? null,
          applications: options.applications ?? [],
          internships: options.internships ?? [],
        }
      );
      setChatMessages((prev) => [...prev, response]);
      return response;
    } finally {
      setIsTyping(false);
    }
  }, [chatMessages, options.profile, options.applications, options.internships]);

  const getMatchScore = useCallback(
    (profile: UserProfile, internship: Internship): MatchResult => {
      return calculateMatchScore(internship, profile);
    },
    []
  );

  const clearChat = useCallback(() => {
    setChatMessages([]);
  }, []);

  return {
    chatMessages,
    isTyping,
    sendMessage,
    getMatchScore,
    clearChat,
  };
}
