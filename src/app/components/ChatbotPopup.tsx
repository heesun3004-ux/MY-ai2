'use client';

import { useState, useRef, useEffect } from 'react';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatbotPopupProps {
  isOpen: boolean;
  onClose: () => void;
  swimmingContext: string;
}

export default function ChatbotPopup({ isOpen, onClose, swimmingContext }: ChatbotPopupProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [hasInitialized, setHasInitialized] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 팝업이 처음 열릴 때 AI가 분석/추천을 먼저 말하도록 초기화
  useEffect(() => {
    if (isOpen && !hasInitialized) {
      setHasInitialized(true);
      fetchInitialMessage();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, hasInitialized]);

  // 새 메시지가 생길 때마다 스크롤을 맨 아래로
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const fetchInitialMessage = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            {
              role: 'user',
              content: '안녕하세요!',
            },
          ],
          swimmingContext,
        }),
      });
      const data = await res.json();
      if (data.error) {
        setMessages([
          { role: 'assistant', content: `오류가 발생했어요: ${data.error}` },
        ]);
      } else {
        setMessages([{ role: 'assistant', content: data.content }]);
      }
    } catch {
      setMessages([
        {
          role: 'assistant',
          content: '죄송해요, 연결에 문제가 생겼어요. 잠시 후 다시 시도해주세요.',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    const userMessage: ChatMessage = { role: 'user', content: trimmed };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
          swimmingContext,
        }),
      });
      const data = await res.json();
      if (data.error) {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: `오류가 발생했어요: ${data.error}` },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: data.content },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: '죄송해요, 연결에 문제가 생겼어요. 잠시 후 다시 시도해주세요.',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="chatbot-overlay">
      <div className="chatbot-popup">
        {/* 헤더 */}
        <div className="chatbot-header">
          <div className="chatbot-header-info">
            <span className="chatbot-avatar">🏊‍♂️</span>
            <div>
              <div className="chatbot-title">AI 수영 코치</div>
              <div className="chatbot-status">훈련 추천 & 페이스 분석</div>
            </div>
          </div>
          <button className="chatbot-close" onClick={onClose} aria-label="닫기">
            ✕
          </button>
        </div>

        {/* 메시지 영역 */}
        <div className="chatbot-messages">
          {messages.length === 0 && isLoading && (
            <div className="chatbot-message assistant">
              <div className="chatbot-bubble assistant">
                <span className="chatbot-typing">
                  <span></span>
                  <span></span>
                  <span></span>
                </span>
              </div>
            </div>
          )}
          {messages.map((msg, idx) => (
            <div key={idx} className={`chatbot-message ${msg.role}`}>
              <div className={`chatbot-bubble ${msg.role}`}>{msg.content}</div>
            </div>
          ))}
          {isLoading && messages.length > 0 && (
            <div className="chatbot-message assistant">
              <div className="chatbot-bubble assistant">
                <span className="chatbot-typing">
                  <span></span>
                  <span></span>
                  <span></span>
                </span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* 입력 영역 */}
        <div className="chatbot-input-area">
          <input
            type="text"
            className="chatbot-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="코치에게 질문해보세요..."
            disabled={isLoading}
          />
          <button
            className="chatbot-send"
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            aria-label="전송"
          >
            ➤
          </button>
        </div>
      </div>
    </div>
  );
}