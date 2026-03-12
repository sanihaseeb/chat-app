import { useState } from 'react';

const SERVER = 'http://localhost:3001';

const styles = {
  container: {
    background: '#1a1530',
    border: '1px solid #3d3060',
    borderRadius: '14px',
    padding: '40px',
    width: '100%',
    maxWidth: '400px',
    boxShadow: '0 8px 40px rgba(124,58,237,0.15)',
  },
  title: {
    fontSize: '24px',
    fontWeight: '700',
    marginBottom: '8px',
    color: '#ffffff',
  },
  subtitle: {
    fontSize: '14px',
    color: '#9d8abf',
    marginBottom: '28px',
  },
  field: {
    marginBottom: '16px',
  },
  label: {
    display: 'block',
    fontSize: '13px',
    color: '#c4b5fd',
    marginBottom: '6px',
    fontWeight: '500',
  },
  input: {
    width: '100%',
    padding: '10px 14px',
    background: '#0d0a17',
    border: '1px solid #3d3060',
    borderRadius: '8px',
    color: '#f0e9ff',
    fontSize: '15px',
    outline: 'none',
    transition: 'border-color 0.2s',
  },
  button: {
    width: '100%',
    padding: '11px',
    background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '15px',
    fontWeight: '600',
    cursor: 'pointer',
    marginTop: '8px',
    transition: 'opacity 0.2s',
    boxShadow: '0 4px 16px rgba(124,58,237,0.35)',
  },
  toggle: {
    marginTop: '20px',
    textAlign: 'center',
    fontSize: '14px',
    color: '#9d8abf',
  },
  toggleLink: {
    color: '#c084fc',
    cursor: 'pointer',
    fontWeight: '500',
    marginLeft: '4px',
  },
  error: {
    background: '#2d1a1a',
    border: '1px solid #6b2020',
    color: '#fca5a5',
    padding: '10px 14px',
    borderRadius: '8px',
    fontSize: '14px',
    marginBottom: '16px',
  },
};

export default function Auth({ onAuth }) {
  const [mode, setMode] = useState('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${SERVER}/api/${mode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Something went wrong');
      onAuth({ token: data.token, username: data.username });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.container}>
      <div style={{ marginBottom: '24px' }}>
        <div style={{
          width: '40px', height: '40px', borderRadius: '10px',
          background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '20px', marginBottom: '16px',
          boxShadow: '0 4px 16px rgba(124,58,237,0.4)',
        }}>
          💬
        </div>
        <div style={styles.title}>{mode === 'login' ? 'Welcome back' : 'Create account'}</div>
        <div style={styles.subtitle}>
          {mode === 'login' ? 'Sign in to join the chat' : 'Register to start chatting'}
        </div>
      </div>

      {error && <div style={styles.error}>{error}</div>}

      <form onSubmit={handleSubmit}>
        <div style={styles.field}>
          <label style={styles.label}>Username</label>
          <input
            style={styles.input}
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Enter username"
            autoFocus
            required
          />
        </div>
        <div style={styles.field}>
          <label style={styles.label}>Password</label>
          <input
            style={styles.input}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter password"
            required
          />
        </div>
        <button style={styles.button} type="submit" disabled={loading}>
          {loading ? 'Please wait...' : mode === 'login' ? 'Sign in' : 'Create account'}
        </button>
      </form>

      <div style={styles.toggle}>
        {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}
        <span
          style={styles.toggleLink}
          onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}
        >
          {mode === 'login' ? 'Register' : 'Sign in'}
        </span>
      </div>
    </div>
  );
}
