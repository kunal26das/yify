import {useQueryClient} from '@tanstack/react-query';
import {useRouter} from 'expo-router';
import {useCallback} from 'react';
import type {MediaCardItem} from '@/core/navigation/hrefs';
import {mediaTarget, searchHref, titleHref} from '@/core/navigation/hrefs';
import type {CardSurface} from '@/core/ui/components/MediaCard';
import {openTitle} from '@/features/monetization/public/openTitle';
import {useEffectiveRegion} from '@/features/settings/public/region';
import {titleQueryOptions} from './titleQuery';

export function useOpenMedia(surface: CardSurface): (item: MediaCardItem) => void {
  const router = useRouter();
  const queryClient = useQueryClient();
  const region = useEffectiveRegion();
  return useCallback((item: MediaCardItem) => {
    const target = mediaTarget(item);
    if (target.kind === 'legacy') {
      router.push(searchHref({q: target.title}));
      return;
    }
    void queryClient.prefetchQuery(titleQueryOptions(target.key, region));
    openTitle(() => router.push(titleHref(target.key, target.slug)), {
      source: 'tap',
      surface,
      contentType: target.type,
      contentId: target.id,
      title: target.title,
      posterPath: target.posterPath,
    });
  }, [router, queryClient, region, surface]);
}
