import {useRouter} from 'expo-router';
import type {JSX} from 'react';
import {useState} from 'react';
import {searchHref} from '@/core/navigation/hrefs';
import {SearchField} from '@/core/ui/components/SearchField';

export function HeaderSearch(): JSX.Element {
  const router = useRouter();
  const [q, setQ] = useState('');
  const submit = (text: string) => {
    router.navigate(searchHref({q: text}));
  };
  return <SearchField variant="header" value={q} onChangeText={setQ} onSubmit={submit}/>;
}
