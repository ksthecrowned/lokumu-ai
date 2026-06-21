import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

export default function ChatPage() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [message, setMessage] = useState('');
  const [response, setResponse] = useState('');
  const [mode, setMode] = useState<'chat' | 'code'>('chat');

  useEffect(() => {
    const s = io('http://localhost:3000');
    setSocket(s);
    return () => { s.disconnect(); };
  }, []);

  const sendMessage = () => {
    if (!socket || !message) return;
    
    socket.emit('message', { prompt: message });
    socket.on('stream', (data: { chunk: string; done: boolean; mode: 'chat' | 'code' }) => {
      setResponse(prev => prev + data.chunk);
      setMode(data.mode);
    });
  };

  return (
    <div style={{ padding: '2rem' }}>
      <h1>Lokumu AI - {mode === 'chat' ? '💬 Chat' : '💻 Code Mode'}</h1>
      
      <div style={{ marginBottom: '1rem' }}>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Ask me anything or request code..."
          style={{ width: '100%', height: '100px' }}
        />
      </div>
      
      <button onClick={sendMessage} disabled={!message}>
        Send
      </button>
      
      <div style={{ marginTop: '1rem', padding: '1rem', background: '#f5f5f5' }}>
        <pre>{response}</pre>
      </div>
    </div>
  );
}