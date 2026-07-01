'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { getFirebaseServices, isFirebaseConfigured } from '@/lib/firebaseClient';

type AuthMode = 'login' | 'signup';

export default function TopAuthControls() {
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const [mode, setMode] = useState<AuthMode>('login');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const firebaseReady = isFirebaseConfigured();

  useEffect(() => {
    const firebase = getFirebaseServices();
    if (!firebase) return;

    return onAuthStateChanged(firebase.auth, (user) => {
      setUserEmail(user?.email ?? null);
      if (user) {
        setIsOpen(false);
      }
    });
  }, []);

  const handleSubmit = async () => {
    const firebase = getFirebaseServices();
    if (!firebase || !email || !password) return;
    if (mode === 'signup' && password !== passwordConfirm) {
      setMessage('비밀번호가 서로 다릅니다.');
      return;
    }

    try {
      setSubmitting(true);
      setMessage('');
      if (mode === 'login') {
        await signInWithEmailAndPassword(firebase.auth, email, password);
      } else {
        const credential = await createUserWithEmailAndPassword(firebase.auth, email, password);
        if (displayName.trim()) {
          await updateProfile(credential.user, { displayName: displayName.trim() });
        }
        await setDoc(doc(firebase.db, 'users', credential.user.uid), {
          email,
          displayName: displayName.trim(),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }, { merge: true });
      }
      setDisplayName('');
      setPassword('');
      setPasswordConfirm('');
    } catch {
      setMessage(mode === 'login' ? '로그인에 실패했습니다.' : '회원가입에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSocialMock = (provider: string) => {
    setMessage(`${provider} 연동은 준비 중입니다. 지금은 이메일로 테스트해주세요.`);
  };

  const handleSignOut = async () => {
    const firebase = getFirebaseServices();
    if (!firebase) return;
    await signOut(firebase.auth);
    setUserEmail(null);
  };

  if (!firebaseReady) {
    return null;
  }

  if (userEmail) {
    return (
      <div className="top-auth">
        <span className="top-auth-user">{userEmail}</span>
        <Link className="top-auth-link" href="/app">앱으로</Link>
        <button className="top-auth-button secondary" type="button" onClick={handleSignOut}>
          로그아웃
        </button>
      </div>
    );
  }

  return (
    <div
      className="top-auth"
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => {
        if (!inputFocused) setIsOpen(false);
      }}
    >
      <button
        className="top-auth-button secondary"
        type="button"
        onClick={() => {
          setMode('login');
          setIsOpen((prev) => !prev);
        }}
      >
        로그인
      </button>
      <button
        className="top-auth-button"
        type="button"
        onClick={() => {
          setMode('signup');
          setIsOpen((prev) => !prev);
        }}
      >
        회원가입
      </button>

      {isOpen && (
        <div className="top-auth-menu">
          <strong>{mode === 'login' ? '로그인' : '회원가입'}</strong>
          <div className="top-auth-mode-switch">
            <button
              type="button"
              className={mode === 'login' ? 'active' : ''}
              onClick={() => {
                setMode('login');
                setMessage('');
              }}
            >
              로그인
            </button>
            <button
              type="button"
              className={mode === 'signup' ? 'active' : ''}
              onClick={() => {
                setMode('signup');
                setMessage('');
              }}
            >
              회원가입
            </button>
          </div>
          {mode === 'signup' && (
            <input
              type="text"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              onFocus={() => setInputFocused(true)}
              onBlur={() => setInputFocused(false)}
              placeholder="이름 또는 닉네임"
              autoComplete="name"
            />
          )}
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            onFocus={() => setInputFocused(true)}
            onBlur={() => setInputFocused(false)}
            placeholder="이메일"
            autoComplete="email"
          />
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            onFocus={() => setInputFocused(true)}
            onBlur={() => setInputFocused(false)}
            placeholder="비밀번호"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          />
          {mode === 'signup' && (
            <input
              type="password"
              value={passwordConfirm}
              onChange={(event) => setPasswordConfirm(event.target.value)}
              onFocus={() => setInputFocused(true)}
              onBlur={() => setInputFocused(false)}
              placeholder="비밀번호 확인"
              autoComplete="new-password"
            />
          )}
          <button
            className="top-auth-submit"
            type="button"
            onClick={handleSubmit}
            disabled={submitting || !email || !password || (mode === 'signup' && !passwordConfirm)}
          >
            {mode === 'login' ? '로그인하기' : '가입하기'}
          </button>
          <div className="top-auth-divider"><span>간편 계정 연동</span></div>
          <div className="top-auth-socials">
            <button type="button" onClick={() => handleSocialMock('Google')}>
              Google
            </button>
            <button type="button" onClick={() => handleSocialMock('Naver')}>
              Naver
            </button>
            <button type="button" onClick={() => handleSocialMock('Apple')}>
              Apple
            </button>
          </div>
          {message && <p>{message}</p>}
        </div>
      )}
    </div>
  );
}