import {QueryClientProvider} from '@tanstack/react-query';
import {type ReactNode, useState} from 'react';
import {createQueryClient} from './client';

export function QueryProvider({children}: {children: ReactNode}) {
  const [client] = useState(createQueryClient);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
