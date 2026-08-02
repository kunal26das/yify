import { getApps, initializeApp, type FirebaseApp } from 'firebase/app';

const FALLBACK_CONFIG = {
  apiKey: 'AIzaSyAUkRQgxGR8bg9wDhBgXFxEPTyZEUub3Pc',
  authDomain: 'yify-2da67.firebaseapp.com',
  projectId: 'yify-2da67',
  storageBucket: 'yify-2da67.firebasestorage.app',
  messagingSenderId: '325235052319',
  appId: '1:325235052319:web:30153cf442d116972d2a2a',
  measurementId: 'G-ZJMYLR7FLW',
};

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || FALLBACK_CONFIG.apiKey,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || FALLBACK_CONFIG.authDomain,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || FALLBACK_CONFIG.projectId,
  storageBucket:
    process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || FALLBACK_CONFIG.storageBucket,
  messagingSenderId:
    process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || FALLBACK_CONFIG.messagingSenderId,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || FALLBACK_CONFIG.appId,
  measurementId:
    process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID || FALLBACK_CONFIG.measurementId,
};

let app: FirebaseApp | null = null;

export function getFirebaseApp(): FirebaseApp | null {
  if (app != null) return app;
  const hasConfig =
    firebaseConfig.apiKey &&
    firebaseConfig.projectId &&
    firebaseConfig.appId;
  if (!hasConfig) return null;
  if (getApps().length > 0) {
    app = getApps()[0] as FirebaseApp;
    return app;
  }
  app = initializeApp(firebaseConfig);
  return app;
}
