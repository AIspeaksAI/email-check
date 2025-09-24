import { NextRequest, NextResponse } from 'next/server';
import { OAuth2Server } from '@/lib/oauth2';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  
  const clientId = searchParams.get('client_id');
  const redirectUri = searchParams.get('redirect_uri');
  const responseType = searchParams.get('response_type');
  const scope = searchParams.get('scope');
  const state = searchParams.get('state');

  // Validate required parameters
  if (!clientId || !redirectUri || !responseType || !scope) {
    return NextResponse.json(
      { error: 'invalid_request', error_description: 'Missing required parameters' },
      { status: 400 }
    );
  }

  if (responseType !== 'code') {
    return NextResponse.json(
      { error: 'unsupported_response_type', error_description: 'Only authorization code flow is supported' },
      { status: 400 }
    );
  }

  // Validate client
  const client = OAuth2Server.getClient(clientId);
  if (!client) {
    return NextResponse.json(
      { error: 'invalid_client', error_description: 'Invalid client ID' },
      { status: 400 }
    );
  }

  if (!client.redirectUris.includes(redirectUri)) {
    return NextResponse.json(
      { error: 'invalid_request', error_description: 'Invalid redirect URI' },
      { status: 400 }
    );
  }

  const scopes = scope.split(' ').filter(s => s.trim());
  const validScopes = scopes.filter(s => client.scopes.includes(s));
  
  if (validScopes.length === 0) {
    return NextResponse.json(
      { error: 'invalid_scope', error_description: 'Invalid scope requested' },
      { status: 400 }
    );
  }

  // For demo purposes, we'll show a simple login form
  // In production, this would redirect to your login page
  const loginHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>OAuth 2.0 Authorization</title>
      <style>
        body { font-family: Arial, sans-serif; max-width: 400px; margin: 50px auto; padding: 20px; }
        .form-group { margin-bottom: 15px; }
        label { display: block; margin-bottom: 5px; }
        input { width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; }
        button { background: #007bff; color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer; }
        .info { background: #f8f9fa; padding: 15px; border-radius: 4px; margin-bottom: 20px; }
      </style>
    </head>
    <body>
      <h2>Authorize Application</h2>
      <div class="info">
        <strong>Application:</strong> ${client.name}<br>
        <strong>Scopes:</strong> ${validScopes.join(', ')}<br>
        <strong>Redirect URI:</strong> ${redirectUri}
      </div>
      <form method="POST">
        <div class="form-group">
          <label for="username">Username:</label>
          <input type="text" id="username" name="username" value="demo@example.com" required>
        </div>
        <div class="form-group">
          <label for="password">Password:</label>
          <input type="password" id="password" name="password" value="demo123" required>
        </div>
        <input type="hidden" name="client_id" value="${clientId}">
        <input type="hidden" name="redirect_uri" value="${redirectUri}">
        <input type="hidden" name="scope" value="${validScopes.join(' ')}">
        <input type="hidden" name="state" value="${state || ''}">
        <button type="submit">Authorize</button>
      </form>
    </body>
    </html>
  `;

  return new NextResponse(loginHtml, {
    headers: { 'Content-Type': 'text/html' }
  });
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  
  const username = formData.get('username') as string;
  const password = formData.get('password') as string;
  const clientId = formData.get('client_id') as string;
  const redirectUri = formData.get('redirect_uri') as string;
  const scope = formData.get('scope') as string;
  const state = formData.get('state') as string;

  // Authenticate user
  const authResult = await OAuth2Server.authenticateUser(username, password);
  
  if (!authResult.success) {
    return NextResponse.json(
      { error: 'access_denied', error_description: authResult.error },
      { status: 400 }
    );
  }

  // Generate authorization code
  const scopes = scope.split(' ').filter(s => s.trim());
  const authCode = OAuth2Server.generateAuthorizationCode(
    clientId,
    redirectUri,
    authResult.userId!,
    scopes
  );

  // Redirect back to client with authorization code
  const redirectUrl = new URL(redirectUri);
  redirectUrl.searchParams.set('code', authCode);
  if (state) {
    redirectUrl.searchParams.set('state', state);
  }

  return NextResponse.redirect(redirectUrl.toString());
}
