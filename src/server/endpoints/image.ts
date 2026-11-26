import {imageFileParam, imageSizeParam, notFound, queryParams} from '@/server/http/params';
import {KB, withApi} from '@/server/http/respond';

export const imageRoute = withApi('img', {deadlineMs: 12_000, maxBytes: KB}, async ({url, params}) => {
  queryParams(url, []);
  imageSizeParam(params.size);
  imageFileParam(params.file);
  throw notFound('Image proxying is not available yet.');
});
