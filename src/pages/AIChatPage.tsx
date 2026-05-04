import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAI } from '../hooks/useAI';
import { useUserContext } from '../context/UserContext';
import styles from './AIChatPage.module.css';

const WELCOME_MESSAGE = {
  id: 'welcome',
  role: 'assistant' as const,
  content: "hey. i'm mate. i've read all your applications — want the honest take or the nice one? (both are fine)",
  timestamp: new Date().toISOString(),
};

const QUICK_ACTIONS = [
  { label: 'Optimize CV',         q: 'Optimize my CV for software engineering internships.' },
  { label: 'Review Applications', q: 'Review my active applications — which should I prioritize?' },
  { label: 'Find Roles',          q: 'Find me more roles that match my profile.' },
  { label: 'View Analytics',      q: 'Show me analytics on my application patterns.' },
  { label: 'Interview Prep',      q: 'Help me prep for my upcoming interviews.' },
];

export default function AIChatPage() {
  const navigate = useNavigate();
  const { profile } = useUserContext();
  const { chatMessages, isTyping, sendMessage } = useAI({ profile });
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const allMessages = [WELCOME_MESSAGE, ...chatMessages];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, isTyping]);

  const [input, setInput] = useState('');

  const handleSend = useCallback(async (text: string) => {
    if (!text.trim() || isTyping) return;
    setInput('');
    await sendMessage(text.trim());
  }, [sendMessage, isTyping]);

  const showQuickActions = chatMessages.length < 3;

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={() => navigate(-1)}>←</button>
        <div className={styles.mateIcon}>
          <span className={styles.mateLetter}>M</span>
          <span className={`${styles.mateOnlineDot} ${isTyping ? styles.mateOnlineDotTyping : styles.mateOnlineDotOnline}`} />
        </div>
        <div className={styles.mateInfo}>
          <div className={styles.mateName}>Mate</div>
          <div className={`${styles.mateStatus} ${isTyping ? styles.mateStatusTyping : styles.mateStatusOnline}`}>
            {isTyping ? 'typing…' : 'online · reads your applications'}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className={styles.messages}>
        {allMessages.map((msg) => (
          <div key={msg.id} className={`${styles.msgBubble} ${msg.role === 'user' ? styles.msgBubbleUser : styles.msgBubbleAssist}`}>
            <div className={`${styles.msgContent} ${msg.role === 'user' ? styles.msgContentUser : styles.msgContentAssist}`}>
              {msg.content}
            </div>
          </div>
        ))}

        {isTyping && (
          <div className={styles.typingBubble}>
            <div className={styles.typingDots}>
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className={styles.typingDot}
                  style={{ animation: `typingDot 1.2s infinite ${i * 0.15}s` }}
                />
              ))}
            </div>
          </div>
        )}

        {showQuickActions && (
          <div className={styles.quickActions}>
            <div className={styles.quickLabel}>—— try asking ——</div>
            {QUICK_ACTIONS.map((a) => (
              <button key={a.label} className={styles.quickBtn} onClick={() => handleSend(a.q)}>
                <span>⚡ {a.label}</span>
                <span className={styles.quickChevron}>›</span>
              </button>
            ))}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className={styles.inputBar}>
        <input
          className={styles.chatInput}
          placeholder="ask mate anything…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend(input)}
          disabled={isTyping}
        />
        <button
          className={styles.sendBtn}
          disabled={isTyping || !input.trim()}
          onClick={() => handleSend(input)}
        >
          {isTyping ? <span className={styles.spinner} /> : '↵'}
        </button>
      </div>
    </div>
  );
}
