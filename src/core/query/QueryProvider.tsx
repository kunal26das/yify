import {QueryClientProvider} from '@tanstack/react-query';
import type {ReactNode} from 'react';
import {useState} from 'react';
import {getQueryClient} from './client';

export function QueryProvider({children}: {children: ReactNode}) {
  const [client] = useState(getQueryClient);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
