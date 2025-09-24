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
  if (!client || client.type !== 'salesforce_connected_app') {
    return NextResponse.json(
      { error: 'invalid_client', error_description: 'Invalid Salesforce client ID' },
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

  try {
    // Generate Salesforce authorization URL
    const salesforceAuthUrl = OAuth2Server.generateSalesforceAuthUrl(
      clientId,
      redirectUri,
      validScopes,
      state || undefined
    );

    // Redirect to Salesforce for authentication
    return NextResponse.redirect(salesforceAuthUrl);
  } catch (error: unknown) {
    return NextResponse.json(
      { error: 'server_error', error_description: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
