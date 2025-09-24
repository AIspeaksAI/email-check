import { NextRequest, NextResponse } from 'next/server';
import { OAuth2Server } from '@/lib/oauth2';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  
  const code = searchParams.get('code');
  // const state = searchParams.get('state');
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');

  // Handle Salesforce OAuth errors
  if (error) {
    return NextResponse.json(
      { 
        error: 'access_denied', 
        error_description: errorDescription || 'Salesforce authorization failed' 
      },
      { status: 400 }
    );
  }

  if (!code) {
    return NextResponse.json(
      { error: 'invalid_request', error_description: 'Authorization code not provided' },
      { status: 400 }
    );
  }

  // Get client ID from state or use default Salesforce client
  const clientId = process.env.SALESFORCE_CLIENT_ID;
  const clientSecret = process.env.SALESFORCE_CLIENT_SECRET;
  const redirectUri = process.env.SALESFORCE_REDIRECT_URI || 'http://localhost:3001/oauth/salesforce/callback';

  if (!clientId || !clientSecret) {
    return NextResponse.json(
      { error: 'server_error', error_description: 'Salesforce client not configured' },
      { status: 500 }
    );
  }

  try {
    // Exchange Salesforce authorization code for tokens
    const salesforceTokens = await OAuth2Server.exchangeSalesforceCodeForTokens(
      code,
      clientId,
      clientSecret,
      redirectUri
    );

    // Get Salesforce user info
    const salesforceUser = await OAuth2Server.getSalesforceUserInfo(
      salesforceTokens.access_token,
      salesforceTokens.instance_url
    );

    // Create internal access token
    const internalTokens = OAuth2Server.createInternalTokenFromSalesforceUser(
      salesforceUser,
      clientId,
      ['email:validate', 'api']
    );

    // Return tokens to the client
    return NextResponse.json({
      ...internalTokens,
      salesforce_user: {
        id: salesforceUser.user_id,
        email: salesforceUser.email,
        name: salesforceUser.name,
        organization_id: salesforceUser.organization_id
      }
    });

  } catch (error: unknown) {
    console.error('Salesforce OAuth callback error:', error);
    return NextResponse.json(
      { error: 'server_error', error_description: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
