'use client';

import { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, Send, Volume2, VolumeX, Settings, MessageCircle } from 'lucide-react';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  timestamp: Date;
  isVoice?: boolean;
}

export default function VoiceChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = () => {
    if (!inputText.trim()) return;

    const newMessage: Message = {
      id: Date.now().toString(),
      text: inputText,
      sender: 'user',
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, newMessage]);
    setInputText('');

    // Simulate AI response
    setTimeout(() => {
      const aiResponse: Message = {
        id: (Date.now() + 1).toString(),
        text: 'I received your message: "' + inputText + '". This is a demo response.',
        sender: 'ai',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, aiResponse]);
    }, 1000);
  };

  const toggleRecording = () => {
    setIsRecording(!isRecording);
    if (!isRecording) {
      console.log('Started recording...');
    } else {
      console.log('Stopped recording...');
    }
  };



  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f8f9fa', color: '#1d1d1f' }}>
      {/* Header */}
      <header style={{ 
        background: '#ffffff', 
        padding: '1rem', 
        borderBottom: '1px solid #e5e7eb',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
        position: 'sticky',
        top: 0,
        zIndex: 10
      }}>
        <div style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ 
              width: '40px', 
              height: '40px', 
              background: '#007aff', 
              borderRadius: '12px', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(0, 122, 255, 0.3)'
            }}>
              <MessageCircle size={20} color="#ffffff" />
            </div>
            <div>
              <h1 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#1d1d1f' }}>AI Chat Assistant</h1>
              <p style={{ fontSize: '0.875rem', color: '#6b7280' }}>Intelligent conversations</p>
            </div>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            {/* Connection Status */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ 
                width: '8px', 
                height: '8px', 
                borderRadius: '50%', 
                background: isConnected ? '#34d399' : '#ef4444' 
              }} />
              <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                {isConnected ? 'Online' : 'Offline'}
              </span>
            </div>
            
            {/* Settings Button */}
            <button style={{ 
              padding: '0.5rem', 
              color: '#6b7280', 
              background: 'none', 
              border: 'none', 
              cursor: 'pointer',
              borderRadius: '8px',
              transition: 'background-color 0.2s'
            }}>
              <Settings size={20} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Chat Area */}
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '1rem' }}>
        <div style={{ 
          background: '#ffffff', 
          borderRadius: '16px', 
          border: '1px solid #e5e7eb', 
          height: 'calc(100vh - 140px)', 
          display: 'flex', 
          flexDirection: 'column',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)'
        }}>
          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>
            {messages.length === 0 ? (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
                <div>
                  <div style={{ 
                    width: '80px', 
                    height: '80px', 
                    background: '#f3f4f6', 
                    borderRadius: '50%', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    margin: '0 auto 1.5rem'
                  }}>
                    <MessageCircle size={32} color="#007aff" />
                  </div>
                  <h2 style={{ fontSize: '1.5rem', fontWeight: '600', marginBottom: '0.5rem', color: '#1d1d1f' }}>Start a conversation</h2>
                  <p style={{ color: '#6b7280', marginBottom: '2rem', fontSize: '0.875rem' }}>Ask me anything or share your thoughts</p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', maxWidth: '400px', margin: '0 auto' }}>
                    <div style={{ 
                      background: '#f8f9fa', 
                      padding: '1rem', 
                      borderRadius: '12px', 
                      border: '1px solid #e5e7eb',
                      textAlign: 'center'
                    }}>
                      <div style={{ 
                        width: '32px', 
                        height: '32px', 
                        background: '#007aff', 
                        borderRadius: '8px', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        margin: '0 auto 0.5rem'
                      }}>
                        <Mic size={16} color="#ffffff" />
                      </div>
                      <h3 style={{ fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.25rem', color: '#1d1d1f' }}>Voice Chat</h3>
                      <p style={{ fontSize: '0.75rem', color: '#6b7280' }}>Speak naturally</p>
                    </div>
                    <div style={{ 
                      background: '#f8f9fa', 
                      padding: '1rem', 
                      borderRadius: '12px', 
                      border: '1px solid #e5e7eb',
                      textAlign: 'center'
                    }}>
                      <div style={{ 
                        width: '32px', 
                        height: '32px', 
                        background: '#007aff', 
                        borderRadius: '8px', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        margin: '0 auto 0.5rem'
                      }}>
                        <Send size={16} color="#ffffff" />
                      </div>
                      <h3 style={{ fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.25rem', color: '#1d1d1f' }}>Text Chat</h3>
                      <p style={{ fontSize: '0.75rem', color: '#6b7280' }}>Type messages</p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {messages.map((message) => (
                  <div
                    key={message.id}
                    style={{
                      display: 'flex',
                      justifyContent: message.sender === 'user' ? 'flex-end' : 'flex-start'
                    }}
                  >
                    <div style={{
                      maxWidth: '75%',
                      padding: '0.75rem 1rem',
                      borderRadius: '18px',
                      background: message.sender === 'user' 
                        ? '#007aff' 
                        : '#f3f4f6',
                      color: message.sender === 'user' ? '#ffffff' : '#1d1d1f',
                      boxShadow: message.sender === 'user' 
                        ? '0 2px 8px rgba(0, 122, 255, 0.3)' 
                        : '0 1px 3px rgba(0, 0, 0, 0.1)'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                        {message.isVoice && <Volume2 size={16} />}
                        <p style={{ fontSize: '0.875rem', lineHeight: '1.4' }}>{message.text}</p>
                      </div>
                      <p style={{ 
                        fontSize: '0.75rem', 
                        opacity: 0.7, 
                        marginTop: '0.5rem',
                        color: message.sender === 'user' ? 'rgba(255, 255, 255, 0.8)' : '#6b7280'
                      }}>
                        {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Input Area */}
          <div style={{ 
            padding: '1rem', 
            borderTop: '1px solid #e5e7eb',
            background: '#ffffff',
            borderBottomLeftRadius: '16px',
            borderBottomRightRadius: '16px'
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.75rem' }}>
              {/* Text Input */}
              <div style={{ flex: 1 }}>
                <textarea
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Type a message..."
                  style={{
                    width: '100%',
                    background: '#f8f9fa',
                    border: '1px solid #e5e7eb',
                    borderRadius: '20px',
                    padding: '0.75rem 1rem',
                    color: '#1d1d1f',
                    resize: 'none',
                    minHeight: '44px',
                    maxHeight: '120px',
                    fontSize: '0.875rem',
                    outline: 'none',
                    transition: 'border-color 0.2s'
                  }}
                  rows={1}
                />
              </div>

              {/* Send Button */}
              <button
                onClick={handleSendMessage}
                disabled={!inputText.trim()}
                style={{
                  padding: '0.75rem',
                  borderRadius: '50%',
                  background: inputText.trim() ? '#007aff' : '#e5e7eb',
                  color: inputText.trim() ? '#ffffff' : '#9ca3af',
                  border: 'none',
                  cursor: inputText.trim() ? 'pointer' : 'not-allowed',
                  width: '44px',
                  height: '44px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s',
                  boxShadow: inputText.trim() ? '0 2px 8px rgba(0, 122, 255, 0.3)' : 'none'
                }}
              >
                <Send size={20} />
              </button>

              {/* Voice Chat Button */}
              <button
                onClick={toggleRecording}
                style={{
                  padding: '0.75rem',
                  borderRadius: '50%',
                  background: isRecording ? '#ef4444' : '#007aff',
                  color: '#ffffff',
                  border: 'none',
                  cursor: 'pointer',
                  width: '44px',
                  height: '44px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s',
                  boxShadow: isRecording 
                    ? '0 2px 8px rgba(239, 68, 68, 0.3)' 
                    : '0 2px 8px rgba(0, 122, 255, 0.3)'
                }}
              >
                {isRecording ? <MicOff size={20} /> : <Mic size={20} />}
              </button>
            </div>
            
            <div style={{ 
              textAlign: 'center', 
              marginTop: '0.5rem', 
              color: '#6b7280', 
              fontSize: '0.75rem' 
            }}>
              {isRecording ? 'Listening...' : 'Tap to start voice chat'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
