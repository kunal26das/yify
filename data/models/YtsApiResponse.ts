import type {YtsMetaDto} from './YtsMetaDto';

/** Generic YTS response envelope shared by every endpoint. */
export interface YtsApiResponse<TData> {
  status: 'ok' | 'error';
  status_message: string;
  data: TData;
  '@meta'?: YtsMetaDto;
}
