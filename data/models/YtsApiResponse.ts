import type {YtsMetaDto} from './YtsMetaDto';

export interface YtsApiResponse<TData> {
  status: 'ok' | 'error';
  status_message: string;
  data: TData;
  '@meta'?: YtsMetaDto;
}
