import { NextRequest, NextResponse } from 'next/server';
import { OAuth2Server } from '@/lib/oauth2';

export async function POST(request: NextRequest) {
  const contentType = request.headers.get('content-type');
  
  let body: any;
  if (contentType?.includes('application/json')) {
    body = await request.json();
  } else {
    const formData = await request.formData();
    body = Object.fromEntries(formData.entries());
  }

  const grantType = body.grant_type;
  const clientId = body.client_id;
  const clientSecret = body.client_secret;

  // Validate client credentials
  if (!clientId || !clientSecret) {
    return NextResponse.json(
      { error: 'invalid_client', error_description: 'Client credentials required' },
      { status: 401 }
    );
  }

  try {
    if (grantType === 'authorization_code') {
      const code = body.code;
      const redirectUri = body.redirect_uri;

      if (!code || !redirectUri) {
        return NextResponse.json(
          { error: 'invalid_request', error_description: 'Missing required parameters' },
          { status: 400 }
        );
      }

      const tokenResponse = await OAuth2Server.exchangeCodeForTokens(
        code,
        clientId,
        clientSecret,
        redirectUri
      );

      return NextResponse.json(tokenResponse);

    } else if (grantType === 'refresh_token') {
      const refreshToken = body.refresh_token;

      if (!refreshToken) {
        return NextResponse.json(
          { error: 'invalid_request', error_description: 'Refresh token required' },
          { status: 400 }
        );
      }

      const tokenResponse = await OAuth2Server.refreshAccessToken(refreshToken);
      return NextResponse.json(tokenResponse);

    } else {
      return NextResponse.json(
        { error: 'unsupported_grant_type', error_description: 'Unsupported grant type' },
        { status: 400 }
      );
    }
  } catch (error: any) {
    return NextResponse.json(
      { error: 'invalid_request', error_description: error.message },
      { status: 400 }
    );
  }
}
