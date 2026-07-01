'use client';

import { useEffect } from 'react';
import { getFirebaseAnalytics } from '@/lib/firebaseClient';

export default function FirebaseAnalytics() {
  useEffect(() => {
    void getFirebaseAnalytics();
  }, []);

  return null;
}
