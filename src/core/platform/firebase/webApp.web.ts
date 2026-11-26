import type {FirebaseApp, FirebaseOptions} from 'firebase/app';
import {AUTH_PROXY_HOSTS} from '@/core/config/app';

const FALLBACK_CONFIG = {
  apiKey: 'AIzaSyAUkRQgxGR8bg9wDhBgXFxEPTyZEUub3Pc',
  authDomain: 'yify-2da67.firebaseapp.com',
  projectId: 'yify-2da67',
  storageBucket: 'yify-2da67.firebasestorage.app',
  messagingSenderId: '325235052319',
  appId: '1:325235052319:web:30153cf442d116972d2a2a',
  measurementId: 'G-ZJMYLR7FLW',
};

let pending: Promise<FirebaseApp | null> | null = null;

export function firebaseAuthDomain(host: string | null | undefined): string {
  const current = host?.toLowerCase() ?? '';
  if (current && AUTH_PROXY_HOSTS.includes(current)) return current;
  return process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || FALLBACK_CONFIG.authDomain;
}

export function firebaseWebConfig(host: string | null | undefined): FirebaseOptions {
  return {
    apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || FALLBACK_CONFIG.apiKey,
    authDomain: firebaseAuthDomain(host),
    projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || FALLBACK_CONFIG.projectId,
    storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || FALLBACK_CONFIG.storageBucket,
    messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || FALLBACK_CONFIG.messagingSenderId,
    appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || FALLBACK_CONFIG.appId,
    measurementId: getFirebaseMeasurementId(),
  };
}

export function getFirebaseMeasurementId(): string {
  return process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID || FALLBACK_CONFIG.measurementId;
}

export function loadFirebaseApp(): Promise<FirebaseApp | null> {
  if (typeof window === 'undefined') return Promise.resolve(null);
  pending ??= import('firebase/app')
    .then(({getApps, initializeApp}) => getApps()[0] ?? initializeApp(firebaseWebConfig(window.location.host)))
    .catch(() => {
      pending = null;
      return null;
    });
  return pending;
}
