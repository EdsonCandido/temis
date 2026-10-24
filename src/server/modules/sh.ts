export function shQuote(value: string) {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

export function fail(message: string, statusCode: number): never {
  throw Object.assign(new Error(message), { statusCode });
}
