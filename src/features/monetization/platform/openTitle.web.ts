import {contentId, track} from '@/core/platform/telemetry/events';
import type {OpenTitleInput} from '../public/types';

export function openTitle(navigate: () => void, input: OpenTitleInput): void {
  track({
    name: 'select_content',
    params: {content_type: input.contentType, content_id: contentId(input.contentType, input.contentId), surface: input.surface},
  });
  navigate();
}
