import type {ReactNode} from 'react';
import {WebDocument} from '@/core/ui/document/WebDocument';

export default function Root({children}: {children: ReactNode}) {
  return <WebDocument>{children}</WebDocument>;
}
