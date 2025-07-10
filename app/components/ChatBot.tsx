'use client';

import { useState, useRef, useEffect } from 'react';

interface Message {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
}

export default function ChatBot() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: 'שלום! אני מצ\'יק בוט! איזה כיף שבאת לדבר איתי! מה שלומך אח יקר? 😄',
      isUser: false,
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentInstruction, setCurrentInstruction] = useState('');
  const [showInstruction, setShowInstruction] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Fetch current system instruction
  const fetchCurrentInstruction = async () => {
    try {
      const response = await fetch('/api/chat', {
        method: 'GET',
      });
      if (response.ok) {
        const data = await response.json();
        setCurrentInstruction(data.systemInstruction);
      }
    } catch (error) {
      console.error('Error fetching system instruction:', error);
    }
  };

  useEffect(() => {
    fetchCurrentInstruction();
  }, []);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: input,
      isUser: true,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // Build conversation history for the API - exclude the initial welcome message
      const history = messages.slice(1).map(msg => ({
        role: msg.isUser ? 'user' : 'model',
        parts: [{ text: msg.text }],
      }));

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: input,
          history,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let botResponse = '';

      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: '',
        isUser: false,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, botMessage]);

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          botResponse += chunk;

          setMessages(prev => 
            prev.map(msg => 
              msg.id === botMessage.id 
                ? { ...msg, text: botResponse }
                : msg
            )
          );

          // Check if mood changed (indicated by the mood change message)
          if (chunk.includes('🎭 *מצב הרוח השתנה!*')) {
            // Refresh the system instruction
            setTimeout(fetchCurrentInstruction, 1000);
          }
        }
      }
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: 'אוי לא! משהו השתבש... נסה שוב בבקשה! 😅',
        isUser: false,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto" dir="rtl">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* System Instruction Panel */}
        <div className="lg:col-span-1 order-2 lg:order-1">
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 h-full">
            <div className="bg-gradient-to-r from-purple-500 to-pink-600 text-white p-4 rounded-t-lg">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-lg">🎭 מצב הרוח הנוכחי</h3>
                <button
                  onClick={() => setShowInstruction(!showInstruction)}
                  className="text-white/80 hover:text-white transition-colors"
                >
                  {showInstruction ? '👁️' : '👁️‍🗨️'}
                </button>
              </div>
            </div>
            <div className="p-4">
              {showInstruction ? (
                <div className="space-y-3">
                  <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
                    <h4 className="font-semibold text-sm text-gray-700 dark:text-gray-300 mb-2">
                      הנחיה נוכחית:
                    </h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed text-right">
                      {currentInstruction || 'טוען...'}
                    </p>
                  </div>
                  <button
                    onClick={fetchCurrentInstruction}
                    className="w-full px-3 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors text-sm"
                  >
                    🔄 רענן הנחיה
                  </button>
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="text-4xl mb-2">🎭</div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    לחץ על העין כדי לראות את מצב הרוח הנוכחי
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Chat Panel */}
        <div className="lg:col-span-2 order-1 lg:order-2">
          <div className="flex flex-col h-[600px] bg-white dark:bg-gray-900 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-500 to-purple-600 text-white p-4 rounded-t-lg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                  <span className="text-lg">🤖</span>
                </div>
                <div className="text-right">
                  <h2 className="font-bold text-lg">מצ'יק בוט</h2>
                  <p className="text-sm opacity-90">הבוט הכי מתלהב בעולם!</p>
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.isUser ? 'justify-start' : 'justify-end'}`}
                >
                  <div
                    className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                      message.isUser
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100'
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap text-right">{message.text}</p>
                    <p className="text-xs opacity-70 mt-1 text-right">
                      {message.timestamp.toLocaleTimeString('he-IL', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-end">
                  <div className="bg-gray-100 dark:bg-gray-800 px-4 py-2 rounded-lg">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-4 border-t border-gray-200 dark:border-gray-700">
              <div className="flex gap-2">
                <button
                  onClick={sendMessage}
                  disabled={!input.trim() || isLoading}
                  className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors order-first"
                >
                  {isLoading ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    '📤'
                  )}
                </button>
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="כתוב הודעה..."
                  className="flex-1 p-3 border border-gray-300 dark:border-gray-600 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white text-right"
                  rows={1}
                  disabled={isLoading}
                  dir="rtl"
                />
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center">
                לחץ Enter לשליחה • Shift+Enter לשורה חדשה
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 