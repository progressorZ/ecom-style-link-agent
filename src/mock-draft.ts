// Independent in-memory form storage. This is not a browser or platform readback.
export class MockDraft<T> {
  private fields = new Map<string, string>()
  write(value: T) {
    this.fields.clear()
    for (const [key, field] of Object.entries(value as object)) this.fields.set(key, JSON.stringify(field))
  }
  read(): T {
    return Object.fromEntries([...this.fields].map(([key, value]) => [key, JSON.parse(value)])) as T
  }
  setField(key: string, value: unknown) { this.fields.set(key, JSON.stringify(value)) }
}

export function differences(expected: unknown, observed: unknown, path = ''): string[] {
  if (Object.is(expected, observed)) return []
  if (expected === null || observed === null || typeof expected !== 'object' || typeof observed !== 'object') return [path || '/']
  if (Array.isArray(expected) !== Array.isArray(observed)) return [path || '/']
  const a = expected as Record<string, unknown>, b = observed as Record<string, unknown>
  return [...new Set([...Object.keys(a), ...Object.keys(b)])].flatMap((key) => differences(a[key], b[key], `${path}/${key}`))
}
