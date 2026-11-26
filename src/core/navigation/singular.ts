export function singularById(name: string, params: Record<string, string | string[] | undefined>): string {
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  return `${name}:${String(id).split('-')[0]}`;
}
