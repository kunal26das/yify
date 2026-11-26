import {openBrowserAsync} from 'expo-web-browser';
import {Linking} from 'react-native';
import {brand} from '@/core/config/brand';
import {mailtoUrl, safeExternalUrl, safeMailtoUrl} from './externalUrl';

export {mailtoUrl, safeExternalUrl, safeMailtoUrl};

export interface OpenUrlOptions {
  toolbarColor?: string;
  external?: boolean;
}

async function openWithSystem(url: string): Promise<boolean> {
  try {
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
}

export async function openUrl(value: string, options: OpenUrlOptions = {}): Promise<boolean> {
  const mail = safeMailtoUrl(value);
  if (mail !== undefined) return openWithSystem(mail);
  const url = safeExternalUrl(value);
  if (url === undefined) return false;
  if (options.external) return openWithSystem(url);
  try {
    await openBrowserAsync(url, {
      toolbarColor: options.toolbarColor ?? brand.colors.dark.surface,
      enableBarCollapsing: true,
      showTitle: true,
    });
    return true;
  } catch {
    return openWithSystem(url);
  }
}
