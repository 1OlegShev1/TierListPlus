export function jsonRequest(
  method: string,
  url: string,
  body?: unknown,
  headers?: HeadersInit,
): Request {
  return new Request(url, {
    method,
    headers: {
      ...(body === undefined ? {} : { "content-type": "application/json" }),
      ...(headers ?? {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

export function routeCtx(params: Record<string, string>) {
  return { params: Promise.resolve(params) };
}
