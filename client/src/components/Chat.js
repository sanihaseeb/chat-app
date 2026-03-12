import { useState, useEffect, useRef, useCallback } from 'react';

const SERVER = 'http://localhost:3001';
const TYPING_TIMEOUT = 1500;

function userHue(name) {
  return [...name].reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;
}

function Avatar({ name, size = 34 }) {
  return (
    <div style={{
      width: `${size}px`, height: `${size}px`, borderRadius: '50%', flexShrink: 0,
      background: `hsl(${userHue(name)}, 55%, 42%)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: `${Math.floor(size * 0.35)}px`, fontWeight: '700', color: '#fff',
    }}>
      {name.slice(0, 2).toUpperCase()}
    </div>
  );
}

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function groupMessages(messages) {
  const groups = [];
  for (const msg of messages) {
    const last = groups[groups.length - 1];
    if (last && last.username === msg.username) {
      last.messages.push(msg);
    } else {
      groups.push({ username: msg.username, messages: [msg] });
    }
  }
  return groups;
}

export default function Chat({ token, username, activeChat, onlineUsers, socket }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [typingUsers, setTypingUsers] = useState([]);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState('');
  const bottomRef = useRef(null);
  const typingTimerRef = useRef(null);
  const isTypingRef = useRef(false);

  const isDM = activeChat?.type === 'dm';
  const conversationId = activeChat?.conversation?.id;
  const otherUsername = activeChat?.otherUser?.username;
  const isOtherOnline = isDM && onlineUsers.includes(otherUsername);

  useEffect(() => {
    setMessages([]);
    setTypingUsers([]);
    setError('');
    const url = isDM
      ? `${SERVER}/api/conversations/${conversationId}/messages`
      : `${SERVER}/api/messages`;
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setMessages(data); })
      .catch(() => setError('Failed to load messages'));
  }, [token, isDM, conversationId]);

  useEffect(() => {
    if (!socket) return;
    setConnected(socket.connected);

    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    const onConnectError = () => setError('Connection failed. Is the server running?');
    const onMessage = (msg) => { if (!isDM) setMessages(prev => [...prev, msg]); };
    const onDmMessage = (msg) => {
      if (isDM && msg.conversation_id === conversationId) setMessages(prev => [...prev, msg]);
    };
    const onTyping = ({ users, conversationId: convId }) => {
      const relevant = isDM ? convId === conversationId : convId === null;
      if (relevant) setTypingUsers(users.filter(u => u !== username));
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onConnectError);
    socket.on('message', onMessage);
    socket.on('dm_message', onDmMessage);
    socket.on('typing', onTyping);

    if (isDM && conversationId) socket.emit('join_conversation', conversationId);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onConnectError);
      socket.off('message', onMessage);
      socket.off('dm_message', onDmMessage);
      socket.off('typing', onTyping);
    };
  }, [socket, isDM, conversationId, username]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typingUsers]);

  const stopTyping = useCallback(() => {
    if (isTypingRef.current) {
      socket?.emit('stop_typing', isDM ? { conversationId } : {});
      isTypingRef.current = false;
    }
  }, [socket, isDM, conversationId]);

  function handleInputChange(e) {
    setInput(e.target.value);
    if (!isTypingRef.current) {
      socket?.emit('typing', isDM ? { conversationId } : {});
      isTypingRef.current = true;
    }
    clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(stopTyping, TYPING_TIMEOUT);
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!input.trim() || !connected) return;
    if (isDM) {
      socket.emit('dm_message', { conversationId, content: input.trim() });
    } else {
      socket.emit('message', input.trim());
    }
    setInput('');
    clearTimeout(typingTimerRef.current);
    stopTyping();
  }

  function typingText() {
    if (typingUsers.length === 0) return null;
    if (typingUsers.length === 1) return `${typingUsers[0]} is typing...`;
    if (typingUsers.length === 2) return `${typingUsers[0]} and ${typingUsers[1]} are typing...`;
    return 'Several people are typing...';
  }

  const groups = groupMessages(messages);
  const placeholder = connected
    ? isDM ? `Message ${otherUsername}...` : 'Message #general...'
    : 'Connecting...';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, background: '#120e1f', minWidth: 0 }}>
      {/* Header */}
      <div style={{
        padding: '14px 22px', borderBottom: '1px solid #2d2448',
        display: 'flex', alignItems: 'center', gap: '12px',
        background: '#120e1f', flexShrink: 0,
      }}>
        {isDM ? (
          <>
            <div style={{ position: 'relative' }}>
              <Avatar name={otherUsername} size={32} />
              <div style={{
                position: 'absolute', bottom: 0, right: 0,
                width: '9px', height: '9px', borderRadius: '50%',
                background: isOtherOnline ? '#22c55e' : '#3d3060',
                border: '2px solid #120e1f',
              }} />
            </div>
            <div>
              <div style={{ fontWeight: '600', fontSize: '15px', color: '#ffffff', lineHeight: 1.2 }}>
                {otherUsername}
              </div>
              <div style={{ fontSize: '11px', color: isOtherOnline ? '#22c55e' : '#6d5aad', marginTop: '1px' }}>
                {isOtherOnline ? 'Active now' : 'Offline'}
              </div>
            </div>
          </>
        ) : (
          <>
            <div style={{
              width: '32px', height: '32px', borderRadius: '8px',
              background: 'rgba(124,58,237,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '16px', color: '#a855f7', fontWeight: '700',
            }}>
              #
            </div>
            <div>
              <div style={{ fontWeight: '600', fontSize: '15px', color: '#ffffff', lineHeight: 1.2 }}>
                general
              </div>
              <div style={{ fontSize: '11px', color: connected ? '#22c55e' : '#ef4444', marginTop: '1px' }}>
                {connected ? 'Connected' : 'Disconnected'}
              </div>
            </div>
          </>
        )}
      </div>

      {error && (
        <div style={{ background: '#2d1a1a', color: '#fca5a5', padding: '10px 22px', fontSize: '13px', flexShrink: 0 }}>
          {error}
        </div>
      )}

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 22px 8px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {groups.length === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '80px', gap: '12px' }}>
            {isDM ? (
              <Avatar name={otherUsername} size={56} />
            ) : (
              <div style={{
                width: '56px', height: '56px', borderRadius: '14px',
                background: 'rgba(124,58,237,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '28px', color: '#a855f7',
              }}>
                #
              </div>
            )}
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '16px', fontWeight: '600', color: '#ffffff', marginBottom: '4px' }}>
                {isDM ? `Your conversation with ${otherUsername}` : 'Welcome to #general!'}
              </div>
              <div style={{ fontSize: '13px', color: '#9d8abf' }}>
                {isDM ? 'Send a message to start chatting.' : 'This is the beginning of the general chat.'}
              </div>
            </div>
          </div>
        )}

        {groups.map((group, gi) => {
          const isOwn = group.username === username;
          return (
            <div key={gi} style={{
              display: 'flex', gap: '10px', alignItems: 'flex-end',
              marginTop: '14px', flexDirection: isOwn ? 'row-reverse' : 'row',
            }}>
              {!isOwn && <Avatar name={group.username} />}
              {isOwn && <div style={{ width: '34px', flexShrink: 0 }} />}

              <div style={{
                maxWidth: '68%', display: 'flex', flexDirection: 'column',
                gap: '3px', alignItems: isOwn ? 'flex-end' : 'flex-start',
              }}>
                {!isOwn && (
                  <span style={{ fontSize: '12px', color: '#9d8abf', fontWeight: '600', marginBottom: '1px', paddingLeft: '2px' }}>
                    {group.username}
                  </span>
                )}
                {group.messages.map((msg, mi) => (
                  <div key={msg.id} style={{
                    display: 'flex', alignItems: 'flex-end', gap: '6px',
                    flexDirection: isOwn ? 'row-reverse' : 'row',
                  }}>
                    <div style={{
                      padding: '9px 14px',
                      borderRadius: isOwn
                        ? mi === 0 ? '18px 18px 4px 18px' : '18px 4px 4px 18px'
                        : mi === 0 ? '18px 18px 18px 4px' : '4px 18px 18px 4px',
                      background: isOwn
                        ? 'linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)'
                        : '#1e1833',
                      color: '#ffffff',
                      fontSize: '14.5px',
                      lineHeight: '1.5',
                      wordBreak: 'break-word',
                      boxShadow: isOwn
                        ? '0 2px 12px rgba(124,58,237,0.35)'
                        : '0 1px 3px rgba(0,0,0,0.4)',
                    }}>
                      {msg.content}
                    </div>
                    {mi === group.messages.length - 1 && (
                      <span style={{ fontSize: '11px', color: '#4d3f72', flexShrink: 0, paddingBottom: '2px' }}>
                        {formatTime(msg.created_at)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {typingUsers.length > 0 && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            marginTop: '12px', paddingLeft: isDM ? '0' : '44px',
          }}>
            <div style={{
              display: 'flex', gap: '3px', alignItems: 'center',
              background: '#1e1833', borderRadius: '12px', padding: '8px 12px',
            }}>
              {[0, 1, 2].map((i) => (
                <div key={i} style={{
                  width: '6px', height: '6px', borderRadius: '50%', background: '#a855f7',
                  animation: `bounce 1.2s ease-in-out ${i * 0.15}s infinite`,
                }} />
              ))}
            </div>
            <span style={{ fontSize: '12px', color: '#9d8abf' }}>{typingText()}</span>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} style={{ padding: '14px 22px 18px', flexShrink: 0 }}>
        <div style={{
          display: 'flex', gap: '10px', alignItems: 'center',
          background: '#1e1833', borderRadius: '14px',
          border: '1px solid #3d3060', padding: '4px 4px 4px 16px',
        }}>
          <input
            value={input}
            onChange={handleInputChange}
            placeholder={placeholder}
            disabled={!connected}
            style={{
              flex: 1, padding: '8px 0', background: 'transparent',
              border: 'none', color: '#f0e9ff', fontSize: '14.5px', outline: 'none',
            }}
          />
          <button
            type="submit"
            disabled={!connected || !input.trim()}
            style={{
              padding: '9px 18px',
              background: (!connected || !input.trim())
                ? '#2d2448'
                : 'linear-gradient(135deg, #7c3aed, #a855f7)',
              color: (!connected || !input.trim()) ? '#4d3f72' : '#fff',
              border: 'none', borderRadius: '10px',
              fontSize: '14px', fontWeight: '600',
              cursor: (!connected || !input.trim()) ? 'default' : 'pointer',
              transition: 'background 0.2s, color 0.2s',
              flexShrink: 0,
              boxShadow: (!connected || !input.trim()) ? 'none' : '0 2px 10px rgba(124,58,237,0.4)',
            }}
          >
            Send
          </button>
        </div>
      </form>

      <style>{`
        @keyframes bounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-4px); }
        }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #3d3060; border-radius: 4px; }
        input::placeholder { color: #4d3f72; }
      `}</style>
    </div>
  );
}
