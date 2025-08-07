'use client';

import { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, Send, Settings, MessageCircle } from 'lucide-react';
import { io, Socket } from 'socket.io-client';

// Types for audio streaming
interface AudioStreamData {
  audioChunk: Buffer;
  isFinal: boolean;
  timestamp: Date;
}

interface SpeechRecognitionResult {
  text: string;
  confidence: number;
  isFinal: boolean;
  timestamp: Date;
}

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
  const [isListening, setIsListening] = useState(false);
  const [isConnecting, setIsConnecting] = useState(true);
  const [isAITyping, setIsAITyping] = useState(false);
  const [isUserSpeaking, setIsUserSpeaking] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [isProcessingAudio, setIsProcessingAudio] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Socket.IO and audio refs
  const socketRef = useRef<Socket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const microphoneRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Voice Activity Detection
  const analyzeAudioLevel = () => {
    if (!analyserRef.current) return;

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);

    // Calculate average volume level
    const average = dataArray.reduce((acc, value) => acc + value, 0) / dataArray.length;
    const normalizedLevel = average / 255; // Normalize to 0-1

    setAudioLevel(normalizedLevel);

    // Detect if user is speaking (threshold can be adjusted)
    const isSpeaking = normalizedLevel > 0.1; // 10% threshold
    setIsUserSpeaking(isSpeaking);

    // Reset silence timer if speaking
    if (isSpeaking) {
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
      }
    } else {
      // Start silence timer if not speaking
      if (!silenceTimerRef.current && isRecording) {
        silenceTimerRef.current = setTimeout(() => {
          console.log('🔇 Silence detected, processing audio...');
          processAudioChunks();
        }, 2000); // 2 seconds of silence
      }
    }

    // Continue analyzing
    animationFrameRef.current = requestAnimationFrame(analyzeAudioLevel);
  };

  // Process accumulated audio chunks
  const processAudioChunks = () => {
    if (audioChunksRef.current.length === 0) return;

    console.log('📦 Processing accumulated audio chunks...');
    
    // Set processing state
    setIsProcessingAudio(true);
    
    // Combine all chunks
    const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
    
    // Convert to buffer and send to server
    audioBlob.arrayBuffer().then((arrayBuffer) => {
      const buffer = Buffer.from(arrayBuffer);
      
      if (socketRef.current) {
        console.log('📤 Sending complete audio to server:', {
          size: buffer.length,
          chunks: audioChunksRef.current.length,
          timestamp: new Date().toISOString()
        });
        
        socketRef.current.emit('audio-stream', {
          audioChunk: buffer,
          isFinal: true,
          timestamp: new Date()
        });
      }
    });

    // Clear chunks for next recording
    audioChunksRef.current = [];
  };

  // Initialize Socket.IO connection
  useEffect(() => {
    const socket = io('http://localhost:3001');
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('Connected to server');
      setIsConnected(true);
      setIsConnecting(false);
    });

    socket.on('disconnect', () => {
      console.log('Disconnected from server');
      setIsConnected(false);
      setIsConnecting(true);
      
      // Attempt to reconnect after 3 seconds
      setTimeout(() => {
        if (!socket.connected) {
          console.log('Attempting to reconnect...');
          socket.connect();
        }
      }, 3000);
    });

    socket.on('connect_error', (error) => {
      console.error('Connection error:', error);
      setIsConnecting(false);
      setIsConnected(false);
    });

    // Handle real-time message updates
    socket.on('message-received', (data) => {
      console.log('User message received:', data);
      const messageWithDate = {
        ...data.message,
        timestamp: new Date(data.message.timestamp)
      };
      setMessages(prev => [...prev, messageWithDate]);
    });

    socket.on('ai-typing', (data) => {
      console.log('AI typing status:', data.isTyping);
      setIsAITyping(data.isTyping);
    });

    socket.on('ai-response', (data) => {
      console.log('AI response received:', data);
      const messageWithDate = {
        ...data.message,
        timestamp: new Date(data.message.timestamp)
      };
      setMessages(prev => [...prev, messageWithDate]);
      
      // Reset processing state
      setIsProcessingAudio(false);
      
      // Play audio response automatically
      if (data.audioBuffer) {
        console.log('🔊 Playing AI audio response...');
        playAudioResponse(data.audioBuffer);
      } else {
        console.log('⚠️ No audio buffer received from AI response');
      }
    });

    // Legacy event handlers (for backward compatibility)
    socket.on('conversation-update', (data) => {
      console.log('Conversation update received:', data);
      const messagesWithDates = data.messages.map((message: any) => ({
        ...message,
        timestamp: new Date(message.timestamp)
      }));
      setMessages(messagesWithDates);
    });

    socket.on('speech-result', (result: SpeechRecognitionResult) => {
      console.log('Speech recognition result:', result);
      if (result.isFinal) {
        const newMessage: Message = {
          id: Date.now().toString(),
          text: result.text,
          sender: 'user',
          timestamp: new Date(),
          isVoice: true,
        };
        setMessages(prev => [...prev, newMessage]);
      }
    });

    socket.on('error', (error) => {
      console.error('Socket error:', error);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Play audio response from base64
  const playAudioResponse = (audioBuffer: string) => {
    try {
      console.log('🔊 Creating audio blob from base64...');
      const audioBlob = new Blob([Buffer.from(audioBuffer, 'base64')], { type: 'audio/mp3' });
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      
      console.log('🔊 Starting audio playback...');
      audio.play().then(() => {
        console.log('✅ Audio playback started successfully');
      }).catch((error) => {
        console.error('❌ Error starting audio playback:', error);
      });
      
      // Clean up URL after playing
      audio.onended = () => {
        console.log('🔊 Audio playback completed');
        URL.revokeObjectURL(audioUrl);
      };
      
      audio.onerror = (error) => {
        console.error('❌ Audio playback error:', error);
        URL.revokeObjectURL(audioUrl);
      };
    } catch (error) {
      console.error('❌ Error creating audio blob:', error);
    }
  };

  const handleSendMessage = () => {
    if (!inputText.trim() || !socketRef.current) return;

    const newMessage: Message = {
      id: Date.now().toString(),
      text: inputText,
      sender: 'user',
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, newMessage]);
    
    // Send text message to server
    socketRef.current.emit('text-message', {
      text: inputText,
      timestamp: new Date()
    });
    
    setInputText('');
  };

  const startRecording = async () => {
    try {
      console.log('🎤 Requesting microphone access...');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      console.log('✅ Microphone access granted');
      
      // Set up audio analysis for voice activity detection
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      
      const analyser = audioContext.createAnalyser();
      analyserRef.current = analyser;
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;
      
      const microphone = audioContext.createMediaStreamSource(stream);
      microphoneRef.current = microphone;
      microphone.connect(analyser);
      
      console.log('🎵 Audio analysis setup complete');
      
      // Check supported MIME types
      const supportedTypes = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') 
        ? 'audio/webm;codecs=opus' 
        : MediaRecorder.isTypeSupported('audio/webm') 
        ? 'audio/webm' 
        : 'audio/mp4';
      
      console.log('📊 Using MIME type:', supportedTypes);
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: supportedTypes
      });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = async (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      // Start recording with smaller timeslice for better responsiveness
      mediaRecorder.start(100); // Collect data every 100ms for smoother analysis
      setIsRecording(true);
      setIsListening(true);
      
      // Start voice activity detection
      analyzeAudioLevel();
      
      // Notify server that recording started
      if (socketRef.current) {
        socketRef.current.emit('start-recording');
      }
      
      console.log('🎙️ Started recording with voice activity detection');
      console.log('   📊 Recording settings:', {
        mimeType: mediaRecorder.mimeType,
        state: mediaRecorder.state,
        timeslice: 100
      });
    } catch (error) {
      console.error('❌ Error starting recording:', error);
      if (error instanceof Error) {
        console.error('   Details:', {
          error: error.message,
          name: error.name,
          stack: error.stack
        });
      }
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && streamRef.current) {
      // Stop voice activity detection
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      
      // Clear silence timer
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
      
      // Stop recording
      mediaRecorderRef.current.stop();
      streamRef.current.getTracks().forEach(track => track.stop());
      
      // Clean up audio context
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
      
      // Reset states
      setIsRecording(false);
      setIsListening(false);
      setIsUserSpeaking(false);
      setAudioLevel(0);
      
      // Process any remaining audio chunks
      if (audioChunksRef.current.length > 0) {
        processAudioChunks();
      }
      
      // Notify server that recording stopped
      if (socketRef.current) {
        socketRef.current.emit('stop-recording');
      }
      
      console.log('⏹️ Stopped recording and cleaned up audio analysis');
      console.log('   📊 Total chunks recorded:', audioChunksRef.current.length);
    }
  };

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };



  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Loading screen component
  const LoadingScreen = () => (
    <div style={{ 
      minHeight: '100vh', 
      background: '#f8f9fa', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      flexDirection: 'column',
      gap: '1rem'
    }}>
      <div style={{
        width: '60px',
        height: '60px',
        border: '3px solid #e5e7eb',
        borderTop: '3px solid #007aff',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite'
      }} />
      <div style={{ textAlign: 'center' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#1d1d1f', marginBottom: '0.5rem' }}>
          Connecting to AI Assistant
        </h2>
        <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>
          Establishing secure connection...
        </p>
      </div>
    </div>
  );

  // Show loading screen while connecting
  if (isConnecting) {
    return <LoadingScreen />;
  }

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
                background: isConnected ? '#34d399' : '#ef4444',
                animation: isConnecting ? 'pulse 2s infinite' : 'none'
              }} />
              <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                {isConnecting ? 'Connecting...' : isConnected ? 'Online' : 'Offline'}
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
                        {message.isVoice && <Mic size={16} />}
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
                
                {/* AI Typing Indicator */}
                {isAITyping && (
                  <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                    <div style={{
                      maxWidth: '75%',
                      padding: '0.75rem 1rem',
                      borderRadius: '18px',
                      background: '#f3f4f6',
                      color: '#1d1d1f',
                      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div style={{
                          display: 'flex',
                          gap: '4px',
                          alignItems: 'center'
                        }}>
                          <div style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            background: '#007aff',
                            animation: 'pulse 1.4s ease-in-out infinite both'
                          }} />
                          <div style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            background: '#007aff',
                            animation: 'pulse 1.4s ease-in-out infinite both',
                            animationDelay: '0.2s'
                          }} />
                          <div style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            background: '#007aff',
                            animation: 'pulse 1.4s ease-in-out infinite both',
                            animationDelay: '0.4s'
                          }} />
                        </div>
                        <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>AI is thinking...</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Audio Processing Indicator */}
                {isProcessingAudio && (
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <div style={{
                      maxWidth: '75%',
                      padding: '0.75rem 1rem',
                      borderRadius: '18px',
                      background: '#007aff',
                      color: '#ffffff',
                      boxShadow: '0 2px 8px rgba(0, 122, 255, 0.3)'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div style={{
                          display: 'flex',
                          gap: '4px',
                          alignItems: 'center'
                        }}>
                          <div style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            background: '#ffffff',
                            animation: 'pulse 1.4s ease-in-out infinite both'
                          }} />
                          <div style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            background: '#ffffff',
                            animation: 'pulse 1.4s ease-in-out infinite both',
                            animationDelay: '0.2s'
                          }} />
                          <div style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            background: '#ffffff',
                            animation: 'pulse 1.4s ease-in-out infinite both',
                            animationDelay: '0.4s'
                          }} />
                        </div>
                        <span style={{ fontSize: '0.875rem', color: '#ffffff' }}>Processing audio...</span>
                      </div>
                    </div>
                  </div>
                )}
                
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
                  placeholder={isConnected ? "Type a message..." : "Connecting to server..."}
                  disabled={!isConnected}
                  style={{
                    width: '100%',
                    background: isConnected ? '#f8f9fa' : '#f3f4f6',
                    border: '1px solid #e5e7eb',
                    borderRadius: '20px',
                    padding: '0.75rem 1rem',
                    color: isConnected ? '#1d1d1f' : '#9ca3af',
                    resize: 'none',
                    minHeight: '44px',
                    maxHeight: '120px',
                    fontSize: '0.875rem',
                    outline: 'none',
                    transition: 'border-color 0.2s',
                    cursor: isConnected ? 'text' : 'not-allowed'
                  }}
                  rows={1}
                />
              </div>

              {/* Send Button */}
              <button
                onClick={handleSendMessage}
                disabled={!inputText.trim() || !isConnected}
                style={{
                  padding: '0.75rem',
                  borderRadius: '50%',
                  background: inputText.trim() && isConnected ? '#007aff' : '#e5e7eb',
                  color: inputText.trim() && isConnected ? '#ffffff' : '#9ca3af',
                  border: 'none',
                  cursor: inputText.trim() && isConnected ? 'pointer' : 'not-allowed',
                  width: '44px',
                  height: '44px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s',
                  boxShadow: inputText.trim() && isConnected ? '0 2px 8px rgba(0, 122, 255, 0.3)' : 'none'
                }}
              >
                <Send size={20} />
              </button>

              {/* Voice Chat Button */}
              <button
                onClick={toggleRecording}
                disabled={!isConnected}
                style={{
                  padding: '0.75rem',
                  borderRadius: '50%',
                  background: !isConnected ? '#e5e7eb' : 
                    isRecording ? (isUserSpeaking ? '#10b981' : '#ef4444') : '#007aff',
                  color: '#ffffff',
                  border: 'none',
                  cursor: isConnected ? 'pointer' : 'not-allowed',
                  width: '44px',
                  height: '44px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s',
                  transform: isUserSpeaking ? 'scale(1.1)' : 'scale(1)',
                  boxShadow: !isConnected ? 'none' : 
                    isRecording ? (isUserSpeaking 
                      ? '0 2px 8px rgba(16, 185, 129, 0.4)' 
                      : '0 2px 8px rgba(239, 68, 68, 0.3)') 
                    : '0 2px 8px rgba(0, 122, 255, 0.3)'
                }}
              >
                {isRecording ? <Mic size={20} /> : <MicOff size={20} />}
              </button>
            </div>
            
            <div style={{ 
              textAlign: 'center', 
              marginTop: '0.5rem', 
              color: '#6b7280', 
              fontSize: '0.75rem' 
            }}>
              {isProcessingAudio ? '⏳ Processing audio...' :
                isRecording ? 
                  (isUserSpeaking ? '🎤 Speaking...' : '🔇 Listening for speech...') 
                  : 'Tap to start voice chat'
              }
              {isListening && !isProcessingAudio && (
                <div style={{ 
                  marginTop: '0.25rem', 
                  color: isUserSpeaking ? '#10b981' : '#007aff',
                  fontWeight: isUserSpeaking ? '600' : '400'
                }}>
                  {isUserSpeaking ? '🎤 Voice detected!' : '🎤 Recording audio...'}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
