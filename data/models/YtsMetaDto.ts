/** Metadata appended to every YTS response under the `@meta` key. */
export interface YtsMetaDto {
    server_time?: number;
    server_timezone?: string;
    api_version: number;
    execution_time: string;
}
