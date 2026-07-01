'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { getFirebaseServices, isFirebaseConfigured, signInWithGoogle, upsertUserProfile } from '@/lib/firebaseClient';

export default function TopAuthControls() {
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const firebaseReady = isFirebaseConfigured();

  useEffect(() => {
    const firebase = getFirebaseServices();
    if (!firebase) return;

    return onAuthStateChanged(firebase.auth, (user) => {
      setUserEmail(user?.email ?? null);
      setUserName(user?.displayName ?? null);
      if (user) {
        void upsertUserProfile(user);
        setIsOpen(false);
      }
    });
  }, []);

  const handleGoogleSignIn = async () => {
    try {
      setSubmitting(true);
      setMessage('');
      await signInWithGoogle();
    } catch {
      setMessage('Google 로그인에 실패했습니다. 팝업 허용과 Firebase Auth 설정을 확인해주세요.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSignOut = async () => {
    const firebase = getFirebaseServices();
    if (!firebase) return;
    await signOut(firebase.auth);
    setUserEmail(null);
    setUserName(null);
  };

  if (!firebaseReady) {
    return null;
  }

  if (userEmail) {
    return (
      <div className="top-auth">
        <span className="top-auth-user">{userName || userEmail}</span>
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
      onMouseLeave={() => setIsOpen(false)}
    >
      <button
        className="top-auth-button"
        type="button"
        onClick={() => {
          setIsOpen((prev) => !prev);
        }}
      >
        로그인
      </button>

      {isOpen && (
        <div className="top-auth-menu">
          <strong>Google 계정으로 시작하기</strong>
          <p className="top-auth-help">수영 기록과 목표가 로그인한 계정의 Firestore에 저장됩니다.</p>
          <button
            className="top-auth-submit"
            type="button"
            onClick={handleGoogleSignIn}
            disabled={submitting}
          >
            {submitting ? 'Google 로그인 중...' : 'Google로 로그인'}
          </button>
          {message && <p>{message}</p>}
        </div>
      )}
    </div>
  );
}
