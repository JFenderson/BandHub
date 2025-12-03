import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';

export function middleware(request: NextRequest) {
  const correlationId = request.headers.get('x-correlation-id') || randomUUID();
  const response = NextResponse.next();
  response.headers.set('x-correlation-id', correlationId);
  return response;
}
