import { useMemo, useState, type FormEvent } from 'react';

import styles from './LoginScreen.module.css';

interface LoginScreenProps {
  error?: string | null;
  onLogin: (username: string, password: string) => Promise<void> | void;
}

export function LoginScreen({ error, onLogin }: LoginScreenProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = useMemo(() => username.trim().length > 0 && password.length > 0 && !submitting, [
    username,
    password,
    submitting,
  ]);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;

    void (async () => {
      setSubmitting(true);
      try {
        await onLogin(username.trim(), password);
      } finally {
        setSubmitting(false);
      }
    })();
  };

  return (
    <div className={styles.backdrop}>
      <div className={styles.card}>
        <h1 className={styles.title}>Sign in</h1>
        <p className={styles.subtitle}>Enter your username and password to open spreadsheets.</p>

        <form className={styles.form} onSubmit={handleSubmit}>
          <label className={styles.field}>
            <span className={styles.label}>Username</span>
            <input
              className={styles.input}
              value={username}
              autoCapitalize="none"
              autoComplete="username"
              onChange={(event) => setUsername(event.target.value)}
              placeholder="admin"
              disabled={submitting}
            />
          </label>

          <label className={styles.field}>
            <span className={styles.label}>Password</span>
            <input
              className={styles.input}
              value={password}
              type="password"
              autoComplete="current-password"
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••"
              disabled={submitting}
            />
          </label>

          {error ? <p className={styles.error}>{error}</p> : null}

          <div className={styles.actions}>
            <button className={styles.button} type="submit" disabled={!canSubmit}>
              {submitting ? 'Signing in…' : 'Sign in'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

