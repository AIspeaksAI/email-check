import { NextRequest, NextResponse } from 'next/server';
import { OAuth2Server } from '@/lib/oauth2';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const token = body.token;
  const tokenTypeHint = body.token_type_hint; // 'access_token' or 'refresh_token'

  if (!token) {
    return NextResponse.json(
      { error: 'invalid_request', error_description: 'Token required' },
      { status: 400 }
    );
  }

  const revoked = OAuth2Server.revokeToken(token);
  
  if (revoked) {
    return NextResponse.json({ message: 'Token revoked successfully' });
  } else {
    return NextResponse.json(
      { error: 'invalid_request', error_description: 'Token not found' },
      { status: 400 }
    );
  }
}
