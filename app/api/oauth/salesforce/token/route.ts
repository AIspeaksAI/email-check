import { NextRequest, NextResponse } from 'next/server';
import { OAuth2Server } from '@/lib/oauth2';
import jwt from 'jsonwebtoken';

export async function POST(request: NextRequest) {
  const contentType = request.headers.get('content-type');
  
  let body: Record<string, unknown>;
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

      // Check if this is a Salesforce client
      const client = OAuth2Server.getClient(clientId as string);
      if (client?.type === 'salesforce_connected_app') {
        // Handle Salesforce OAuth flow
        const salesforceTokens = await OAuth2Server.exchangeSalesforceCodeForTokens(
          code as string,
          clientId as string,
          clientSecret as string,
          redirectUri as string
        );

        // Get Salesforce user info
        const salesforceUser = await OAuth2Server.getSalesforceUserInfo(
          salesforceTokens.access_token,
          salesforceTokens.instance_url
        );

        // Create internal access token
        const internalTokens = OAuth2Server.createInternalTokenFromSalesforceUser(
          salesforceUser,
          clientId as string,
          ['email:validate', 'api']
        );

        return NextResponse.json({
          ...internalTokens,
          salesforce_user: {
            id: salesforceUser.user_id,
            email: salesforceUser.email,
            name: salesforceUser.name,
            organization_id: salesforceUser.organization_id
          }
        });
      } else {
        // Handle regular OAuth flow
        const tokenResponse = await OAuth2Server.exchangeCodeForTokens(
          code as string,
          clientId as string,
          clientSecret as string,
          redirectUri as string
        );

        return NextResponse.json(tokenResponse);
      }

    } else if (grantType === 'refresh_token') {
      const refreshToken = body.refresh_token;

      if (!refreshToken) {
        return NextResponse.json(
          { error: 'invalid_request', error_description: 'Refresh token required' },
          { status: 400 }
        );
      }

      const tokenResponse = await OAuth2Server.refreshAccessToken(refreshToken as string);
      return NextResponse.json(tokenResponse);

    } else if (grantType === 'urn:ietf:params:oauth:grant-type:jwt-bearer') {
      // Salesforce JWT Bearer Token flow for server-to-server authentication
      const assertion = body.assertion as string;

      if (!assertion) {
        return NextResponse.json(
          { error: 'invalid_request', error_description: 'JWT assertion required' },
          { status: 400 }
        );
      }

      // Validate the JWT assertion
      const jwtValidation = await OAuth2Server.validateSalesforceJWT(assertion);
      
      if (!jwtValidation.valid) {
        return NextResponse.json(
          { error: 'invalid_grant', error_description: jwtValidation.error },
          { status: 400 }
        );
      }

      // Create internal access token for the Salesforce user
      const accessToken = jwt.sign(
        {
          sub: jwtValidation.userId,
          client_id: `${process.env.SALESFORCE_CLIENT_ID}_jwt`,
          scope: 'email:validate api',
          type: 'access',
          salesforce_user_id: jwtValidation.userId,
          salesforce_org_id: jwtValidation.organizationId,
          is_salesforce_jwt: true
        },
        process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production',
        { expiresIn: '15m' }
      );

      return NextResponse.json({
        access_token: accessToken,
        token_type: 'Bearer',
        expires_in: 15 * 60, // 15 minutes in seconds
        scope: 'email:validate api'
      });

    } else {
      return NextResponse.json(
        { error: 'unsupported_grant_type', error_description: 'Unsupported grant type' },
        { status: 400 }
      );
    }
  } catch (error: unknown) {
    console.error('Token endpoint error:', error);
    return NextResponse.json(
      { error: 'invalid_request', error_description: error instanceof Error ? error.message : 'Unknown error' },
      { status: 400 }
    );
  }
}
