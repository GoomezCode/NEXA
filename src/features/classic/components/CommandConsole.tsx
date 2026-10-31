import { useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Terminal, Send, Mic } from 'lucide-react';
import { useApp } from '../ClassicContext';

const orb = { fontFamily: 'Orbitron, sans-serif' };
const mono = { fontFamily: 'Share Tech Mono, monospace' };
const raj = { fontFamily: 'Rajdhani, sans-serif' };

const SUGGESTIONS = ['Como você pode me ajudar?', 'Resuma esta conversa', 'diagnóstico', 'gestos'];

export function CommandConsole({ conversationMode = false }: { conversationMode?: boolean }) {
  const {
    messages,
    isStreaming,
    sendMessage,
    stop,
    chatError,
    setSettingsOpen,
    setAppGridOpen,
    setScanningActive,
    setGestureOpen,
    consoleDraft: input,
    setConsoleDraft: setInput,
    voiceSupported,
    voiceListening,
    startVoice,
    stopVoice,
  } = useApp();
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (conversationMode) inputRef.current?.focus();
  }, [conversationMode]);

  const handleSubmit = () => {
    if (!input.trim() || isStreaming) return;
    const text = input.trim();
    setInput('');
    const command = text.toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    if (['settings', 'ajustes', 'configuracoes'].includes(command)) setSettingsOpen(true);
    else if (['apps', 'aplicativos'].includes(command)) setAppGridOpen(true);
    else if (['scan', 'diagnostico', 'iniciar diagnostico'].includes(command)) setScanningActive(true);
    else if (['gestures', 'gestos', 'abrir gestos'].includes(command)) setGestureOpen(true);
    else void sendMessage(text);
  };

  return (
    <div className="flex flex-col h-full min-h-0 gap-3 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          {conversationMode ? <span className="classic-chat-presence" aria-hidden="true" /> : <Terminal className="w-4 h-4" style={{ color: '#00f5ff' }} />}
          <span style={{ ...orb, color: '#00f5ff', fontSize: '0.6875rem', letterSpacing: '0.15em' }}>
            {conversationMode ? 'CONVERSA NEXA' : 'COMMAND CONSOLE'}
          </span>
        </div>
      </div>

      {/* Messages */}
      <div
        className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-3 pr-1"
        style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(0,245,255,0.2) transparent' }}
      >
        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 10, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.25 }}
              className={`flex gap-2 ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.type === 'ai' && (
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{
                    background: 'rgba(0,245,255,0.1)',
                    border: '1px solid rgba(0,245,255,0.3)',
                    boxShadow: '0 0 8px rgba(0,245,255,0.2)',
                  }}
                >
                  <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#00f5ff' }} />
                </div>
              )}

              <div
                className="max-w-[85%] rounded-2xl px-3.5 py-2.5"
                style={
                  msg.type === 'ai'
                    ? {
                        background: 'rgba(0, 245, 255, 0.05)',
                        border: '1px solid rgba(0,245,255,0.2)',
                        boxShadow: '0 0 12px rgba(0,245,255,0.05)',
                        borderRadius: '4px 16px 16px 16px',
                      }
                    : {
                        background: 'rgba(168, 85, 247, 0.12)',
                        border: '1px solid rgba(168,85,247,0.3)',
                        boxShadow: '0 0 12px rgba(168,85,247,0.08)',
                        borderRadius: '16px 4px 16px 16px',
                      }
                }
              >
                {msg.type === 'ai' ? (
                  <p
                    style={{
                      ...raj,
                      color: 'rgba(220,240,255,0.9)',
                      fontSize: '13px',
                      lineHeight: '1.6',
                    }}
                  >
                    {msg.text || (isStreaming ? '…' : '')}
                  </p>
                ) : (
                  <p
                    style={{
                      ...raj,
                      color: 'rgba(220,200,255,0.9)',
                      fontSize: '13px',
                      lineHeight: '1.6',
                    }}
                  >
                    {msg.text}
                  </p>
                )}
                <div className="mt-1 flex justify-end">
                  <span style={{ ...mono, color: 'rgba(255,255,255,0.2)', fontSize: '0.6875rem' }}>
                    {msg.timestamp.toLocaleTimeString('en-US', { hour12: false })}
                  </span>
                </div>
              </div>

              {msg.type === 'user' && (
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{
                    background: 'rgba(168,85,247,0.15)',
                    border: '1px solid rgba(168,85,247,0.4)',
                    boxShadow: '0 0 8px rgba(168,85,247,0.2)',
                  }}
                >
                  <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#a855f7' }} />
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Typing indicator */}
        <AnimatePresence>
          {isStreaming && messages.at(-1)?.type !== 'ai' && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="flex gap-2 items-center"
            >
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
                style={{
                  background: 'rgba(0,245,255,0.1)',
                  border: '1px solid rgba(0,245,255,0.3)',
                }}
              >
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#00f5ff' }} />
              </div>
              <div
                className="px-3 py-2 rounded-2xl flex items-center gap-1.5"
                style={{
                  background: 'rgba(0,245,255,0.05)',
                  border: '1px solid rgba(0,245,255,0.15)',
                }}
              >
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    animate={{ y: [-2, 2, -2] }}
                    transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }}
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ background: '#00f5ff' }}
                  />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <div ref={endRef} />
      </div>

      {/* Suggestions */}
      <div className="flex flex-wrap gap-1.5 flex-shrink-0">
        {SUGGESTIONS.map((s) => (
          <motion.button
            key={s}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              setInput(s);
              inputRef.current?.focus();
            }}
            className="px-2.5 py-1 rounded-lg cursor-pointer"
            style={{
              background: 'rgba(0,245,255,0.04)',
              border: '1px solid rgba(0,245,255,0.15)',
            }}
          >
            <span style={{ ...mono, color: 'rgba(0,245,255,0.6)', fontSize: '0.6875rem' }}>{s}</span>
          </motion.button>
        ))}
      </div>

      {/* Input */}
      <div
        className="flex items-center gap-2 rounded-xl px-3 py-2.5 flex-shrink-0"
        style={{
          background: 'rgba(0,8,25,0.7)',
          border: '1px solid rgba(0,245,255,0.2)',
          boxShadow: '0 0 10px rgba(0,245,255,0.04)',
        }}
      >
        <span style={{ ...mono, color: 'rgba(0,245,255,0.5)', fontSize: '12px' }}>{'>'}</span>
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          placeholder={conversationMode ? 'Escreva sua mensagem...' : 'Enter command or speak...'}
          className="flex-1 outline-none bg-transparent"
          style={{ ...raj, color: 'rgba(255,255,255,0.85)', fontSize: '13px' }}
        />
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={handleSubmit}
          disabled={!input.trim() || isStreaming}
          className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer"
          style={{
            background: input.trim() && !isStreaming ? 'rgba(0,245,255,0.2)' : 'rgba(0,245,255,0.04)',
            border: `1px solid ${input.trim() && !isStreaming ? 'rgba(0,245,255,0.5)' : 'rgba(0,245,255,0.1)'}`,
          }}
        >
          <Send
            className="w-3.5 h-3.5"
            style={{ color: input.trim() && !isStreaming ? '#00f5ff' : 'rgba(0,245,255,0.3)' }}
          />
        </motion.button>
        <button
          type="button"
          onClick={() => voiceListening ? stopVoice() : startVoice()}
          disabled={!voiceSupported || isStreaming}
          aria-label={voiceListening ? 'Parar entrada por voz' : 'Iniciar entrada por voz'}
          aria-pressed={voiceListening}
          className="classic-console-mic"
        >
          <Mic aria-hidden="true" />
        </button>
        {isStreaming && (
          <button type="button" onClick={stop} className="px-2 font-mono text-2xs text-warning">
            PARAR
          </button>
        )}
      </div>
      {chatError && <p role="alert" className="text-xs text-red-300">{chatError}</p>}
    </div>
  );
}
