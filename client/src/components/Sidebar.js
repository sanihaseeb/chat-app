import { useState, useEffect } from 'react';

const SERVER = 'http://localhost:3001';

function userHue(name) {
  return [...name].reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;
}

function MiniAvatar({ name }) {
  return (
    <div style={{
      width: '28px', height: '28px', borderRadius: '50%', flexShrink: 0,
      background: `hsl(${userHue(name)}, 55%, 42%)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: '10px', fontWeight: '700', color: '#fff',
    }}>
      {name.slice(0, 2).toUpperCase()}
    </div>
  );
}

export default function Sidebar({ token, username, onlineUsers, activeChat, onSelectChat, onLogout }) {
  const [users, setUsers] = useState([]);
  const [conversations, setConversations] = useState([]);

  // Refresh user list whenever online presence changes so newly registered users appear
  useEffect(() => {
    fetch(`${SERVER}/api/users`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setUsers(data); });
  }, [token, onlineUsers]);

  useEffect(() => {
    fetch(`${SERVER}/api/conversations`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setConversations(data); });
  }, [token]);

  async function handleUserClick(user) {
    const res = await fetch(`${SERVER}/api/conversations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ userId: user.id }),
    });
    const conv = await res.json();
    setConversations(prev => prev.find(c => c.id === conv.id) ? prev : [conv, ...prev]);
    onSelectChat({ type: 'dm', conversation: conv, otherUser: conv.otherUser });
  }

  const isGeneralActive = !activeChat;
  const activeDmId = activeChat?.conversation?.id;

  return (
    <div style={{
      width: '256px', flexShrink: 0,
      background: 'linear-gradient(180deg, #130e22 0%, #0f0b1e 100%)',
      display: 'flex', flexDirection: 'column',
      borderRight: '1px solid #2d2448',
      height: '100vh',
    }}>
      {/* App title */}
      <div style={{
        padding: '18px 16px 14px', borderBottom: '1px solid #2d2448',
        display: 'flex', alignItems: 'center', gap: '10px',
      }}>
        <div style={{
          width: '32px', height: '32px', borderRadius: '9px',
          background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '16px', flexShrink: 0,
          boxShadow: '0 4px 12px rgba(124,58,237,0.4)',
        }}>
          💬
        </div>
        <span style={{ fontWeight: '700', fontSize: '15px', color: '#ffffff', letterSpacing: '-0.3px' }}>
          ChatApp
        </span>
      </div>

      {/* Current user */}
      <div style={{
        padding: '12px 14px', borderBottom: '1px solid #2d2448',
        display: 'flex', alignItems: 'center', gap: '10px',
      }}>
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <div style={{
            width: '34px', height: '34px', borderRadius: '50%',
            background: `hsl(${userHue(username)}, 55%, 42%)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '12px', fontWeight: '700', color: '#fff',
          }}>
            {username.slice(0, 2).toUpperCase()}
          </div>
          <div style={{
            position: 'absolute', bottom: 0, right: 0,
            width: '9px', height: '9px', borderRadius: '50%',
            background: '#22c55e', border: '2px solid #130e22',
          }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '13px', fontWeight: '600', color: '#ffffff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {username}
          </div>
          <div style={{ fontSize: '11px', color: '#22c55e' }}>Online</div>
        </div>
        <button
          onClick={onLogout}
          title="Logout"
          style={{
            padding: '4px 8px', background: 'transparent', border: '1px solid #3d3060',
            borderRadius: '6px', color: '#9d8abf', cursor: 'pointer', fontSize: '11px',
            transition: 'color 0.15s, border-color 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.color = '#f0e9ff'; e.currentTarget.style.borderColor = '#6d5aad'; }}
          onMouseLeave={e => { e.currentTarget.style.color = '#9d8abf'; e.currentTarget.style.borderColor = '#3d3060'; }}
        >
          Out
        </button>
      </div>

      {/* Nav */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 8px' }}>
        {/* Channels */}
        <div style={{ marginBottom: '4px' }}>
          <div style={{
            fontSize: '10.5px', fontWeight: '700', color: '#6d5aad',
            textTransform: 'uppercase', letterSpacing: '0.08em',
            padding: '6px 8px 4px',
          }}>
            Channels
          </div>
          <NavItem
            active={isGeneralActive}
            onClick={() => onSelectChat(null)}
            icon={<span style={{ fontSize: '15px' }}>#</span>}
            label="general"
          />
        </div>

        {/* Direct Messages */}
        <div style={{ marginTop: '12px' }}>
          <div style={{
            fontSize: '10.5px', fontWeight: '700', color: '#6d5aad',
            textTransform: 'uppercase', letterSpacing: '0.08em',
            padding: '6px 8px 4px',
          }}>
            Direct Messages
          </div>
          {users.length === 0 && (
            <div style={{ fontSize: '12px', color: '#4d3f72', padding: '6px 10px' }}>
              No other users yet
            </div>
          )}
          {users.map(user => {
            const isOnline = onlineUsers.includes(user.username);
            const active = activeDmId != null && conversations.find(c =>
              c.id === activeDmId && (c.other_username === user.username || c.other_user_id === user.id)
            );
            return (
              <button
                key={user.id}
                onClick={() => handleUserClick(user)}
                style={{
                  width: '100%', padding: '7px 8px', display: 'flex', alignItems: 'center', gap: '9px',
                  background: active ? 'rgba(168,85,247,0.15)' : 'transparent',
                  border: 'none', borderRadius: '8px', cursor: 'pointer',
                  color: active ? '#e9d8fd' : '#9d8abf',
                  fontSize: '13.5px', textAlign: 'left',
                  transition: 'background 0.12s, color 0.12s',
                }}
                onMouseEnter={e => { if (!active) { e.currentTarget.style.background = 'rgba(124,58,237,0.1)'; e.currentTarget.style.color = '#f0e9ff'; } }}
                onMouseLeave={e => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#9d8abf'; } }}
              >
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <MiniAvatar name={user.username} />
                  <div style={{
                    position: 'absolute', bottom: '-1px', right: '-1px',
                    width: '8px', height: '8px', borderRadius: '50%',
                    background: isOnline ? '#22c55e' : '#3d3060',
                    border: '1.5px solid #130e22',
                  }} />
                </div>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                  {user.username}
                </span>
                {isOnline && (
                  <span style={{ fontSize: '10px', color: '#22c55e', flexShrink: 0 }}>●</span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function NavItem({ active, onClick, icon, label }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%', padding: '7px 8px', display: 'flex', alignItems: 'center', gap: '8px',
        background: active ? 'rgba(168,85,247,0.15)' : 'transparent',
        border: 'none', borderRadius: '8px', cursor: 'pointer',
        color: active ? '#e9d8fd' : '#9d8abf',
        fontSize: '13.5px', textAlign: 'left',
        fontWeight: active ? '600' : '400',
        transition: 'background 0.12s, color 0.12s',
      }}
      onMouseEnter={e => { if (!active) { e.currentTarget.style.background = 'rgba(124,58,237,0.1)'; e.currentTarget.style.color = '#f0e9ff'; } }}
      onMouseLeave={e => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#9d8abf'; } }}
    >
      <span style={{ color: active ? '#a855f7' : '#6d5aad', width: '18px', textAlign: 'center' }}>{icon}</span>
      {label}
    </button>
  );
}
