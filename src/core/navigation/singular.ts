export function singularById(name: string, params: Record<string, unknown>): string {
  return `${name}:${String(params.id).split('-')[0]}`;
}
