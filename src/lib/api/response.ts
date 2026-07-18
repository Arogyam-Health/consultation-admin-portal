import { NextResponse } from 'next/server';

/** Standard API response envelope */
export function ok<T>(data: T, status = 200) {
  return NextResponse.json({ success: true, data }, { status });
}

export function created<T>(data: T) {
  return ok(data, 201);
}

export function noContent() {
  return new NextResponse(null, { status: 204 });
}

export function badRequest(message: string, details?: unknown) {
  return NextResponse.json({ success: false, error: message, details }, { status: 400 });
}

export function unauthorized(message = 'Unauthorized') {
  return NextResponse.json({ success: false, error: message }, { status: 401 });
}

export function forbidden(message = 'Forbidden') {
  return NextResponse.json({ success: false, error: message }, { status: 403 });
}

export function notFound(message = 'Not found') {
  return NextResponse.json({ success: false, error: message }, { status: 404 });
}

export function conflict(message: string) {
  return NextResponse.json({ success: false, error: message }, { status: 409 });
}

export function serverError(err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  console.error('[API Error]', message);
  if (message === 'UNAUTHORIZED') return unauthorized();
  return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
}
