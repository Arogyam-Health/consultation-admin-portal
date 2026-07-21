import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const allowedOrigins = [
  'http://127.0.0.1:9292',
  'http://localhost:9292',
  'http://127.0.0.1:5173',
  'http://localhost:5173',
  'http://127.0.0.1:3000',
  'http://localhost:3000',
  'https://theobesitykiller.com',
  'https://www.theobesitykiller.com',
  'https://obesitykiller.myshopify.com',
];

function isAllowedShopifyOrigin(origin: string) {
  if (origin === 'null') return true;
  try {
    const { protocol, hostname } = new URL(origin);
    return protocol === 'https:' && (hostname === 'admin.shopify.com' || hostname.endsWith('.myshopify.com'));
  } catch {
    return false;
  }
}

const corsOptions = {
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
};

export function proxy(request: NextRequest) {
  const origin = request.headers.get('origin') ?? '';
  const isAllowedOrigin = allowedOrigins.includes(origin) || isAllowedShopifyOrigin(origin);

  const isPreflight = request.method === 'OPTIONS';

  if (isPreflight) {
    const preflightHeaders: Record<string, string> = {
      ...(isAllowedOrigin && { 'Access-Control-Allow-Origin': origin }),
      ...corsOptions,
    };
    return NextResponse.json({}, { headers: preflightHeaders });
  }

  const response = NextResponse.next();

  if (isAllowedOrigin) {
    response.headers.set('Access-Control-Allow-Origin', origin);
  }

  Object.entries(corsOptions).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  return response;
}

export const config = {
  matcher: ['/api/:path*', '/admin/api/:path*'],
};
