import {contentId, track} from '@/core/platform/telemetry/events';
import type {OpenTitle} from '../public/types';

export const openTitle: OpenTitle = (navigate, input) => {
  track({
    name: 'select_content',
    params: {content_type: input.contentType, content_id: contentId(input.contentType, input.contentId), surface: input.surface},
  });
  navigate();
};
