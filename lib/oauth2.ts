import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
// import crypto from 'crypto';

// OAuth 2.0 Configuration
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
const JWT_EXPIRES_IN = '15m'; // Access token expires in 15 minutes
const REFRESH_TOKEN_EXPIRES_IN = '7d'; // Refresh token expires in 7 days

// Salesforce Configuration
const SALESFORCE_CLIENT_ID = process.env.SALESFORCE_CLIENT_ID;
const SALESFORCE_CLIENT_SECRET = process.env.SALESFORCE_CLIENT_SECRET;
const SALESFORCE_REDIRECT_URI = process.env.SALESFORCE_REDIRECT_URI;
const SALESFORCE_LOGIN_URL = process.env.SALESFORCE_LOGIN_URL || 'https://login.salesforce.com';
const SALESFORCE_API_VERSION = process.env.SALESFORCE_API_VERSION || 'v60.0';

// Client registry (in production, this would be in a database)
interface OAuthClient {
  clientId: string;
  clientSecret: string;
  redirectUris: string[];
  scopes: string[];
  name: string;
  type: 'web' | 'salesforce_connected_app' | 'salesforce_jwt';
  salesforceConfig?: {
    loginUrl: string;
    apiVersion: string;
  };
}

// Initialize clients with hashed secrets
const clients: OAuthClient[] = [];
const initializeClients = async () => {
  // Web client
  clients.push({
    clientId: 'email-validator-web',
    clientSecret: await bcrypt.hash('web-client-secret', 10),
    redirectUris: ['http://localhost:3001'],
    scopes: ['email:validate'],
    name: 'Email Validator Web App',
    type: 'web'
  });

  // Salesforce Connected App client
  if (SALESFORCE_CLIENT_ID && SALESFORCE_CLIENT_SECRET) {
    clients.push({
      clientId: SALESFORCE_CLIENT_ID,
      clientSecret: await bcrypt.hash(SALESFORCE_CLIENT_SECRET, 10),
      redirectUris: [SALESFORCE_REDIRECT_URI || 'http://localhost:3001/oauth/salesforce/callback'],
      scopes: ['email:validate', 'api'],
      name: 'Salesforce Connected App',
      type: 'salesforce_connected_app',
      salesforceConfig: {
        loginUrl: SALESFORCE_LOGIN_URL,
        apiVersion: SALESFORCE_API_VERSION
      }
    });
  }

  // Salesforce JWT Bearer client (for server-to-server)
  if (SALESFORCE_CLIENT_ID) {
    clients.push({
      clientId: `${SALESFORCE_CLIENT_ID}_jwt`,
      clientSecret: '', // JWT doesn't use client secret
      redirectUris: [],
      scopes: ['email:validate', 'api'],
      name: 'Salesforce JWT Bearer',
      type: 'salesforce_jwt',
      salesforceConfig: {
        loginUrl: SALESFORCE_LOGIN_URL,
        apiVersion: SALESFORCE_API_VERSION
      }
    });
  }
};

// Initialize clients
initializeClients();

// Token storage (in production, use Redis or database)
const tokenStore = new Map<string, {
  accessToken: string;
  refreshToken: string;
  clientId: string;
  userId: string;
  scopes: string[];
  expiresAt: number;
  createdAt: number;
}>();

// User storage (in production, use database)
const users = new Map<string, {
  id: string;
  username: string;
  password: string;
  scopes: string[];
}>();

// Initialize demo user
const initializeUsers = async () => {
  const demoUser = {
    id: 'user-1',
    username: 'demo@example.com',
    password: await bcrypt.hash('demo123', 10),
    scopes: ['email:validate']
  };
  users.set(demoUser.id, demoUser);
};

// Initialize users
initializeUsers();

export interface TokenResponse {
  access_token: string;
  token_type: 'Bearer';
  expires_in: number;
  refresh_token: string;
  scope: string;
}

export interface AuthorizationCodeData {
  code: string;
  clientId: string;
  redirectUri: string;
  userId: string;
  scopes: string[];
  expiresAt: number;
}

export interface SalesforceTokenResponse {
  access_token: string;
  instance_url: string;
  id: string;
  token_type: 'Bearer';
  issued_at: string;
  signature: string;
}

export interface SalesforceUserInfo {
  id: string;
  sub: string;
  email: string;
  name: string;
  given_name: string;
  family_name: string;
  picture: string;
  organization_id: string;
  user_id: string;
  preferred_username: string;
  nickname: string;
  zoneinfo: string;
  locale: string;
  active: boolean;
  updated_at: string;
  urls: {
    enterprise: string;
    metadata: string;
    partner: string;
    rest: string;
    sobjects: string;
    search: string;
    query: string;
    recent: string;
    tooling_soap: string;
    tooling_rest: string;
    profile: string;
    feeds: string;
    groups: string;
    users: string;
    feed_items: string;
    feed_elements: string;
    custom_domain: string;
  };
}

const authCodes = new Map<string, AuthorizationCodeData>();

export class OAuth2Server {
  // Generate authorization URL
  static generateAuthUrl(clientId: string, redirectUri: string, scopes: string[], state?: string): string {
    const client = clients.find(c => c.clientId === clientId);
    if (!client) {
      throw new Error('Invalid client ID');
    }

    if (!client.redirectUris.includes(redirectUri)) {
      throw new Error('Invalid redirect URI');
    }

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: scopes.join(' '),
      ...(state && { state })
    });

    return `/oauth/authorize?${params.toString()}`;
  }

  // Handle authorization code generation
  static generateAuthorizationCode(clientId: string, redirectUri: string, userId: string, scopes: string[]): string {
    const code = uuidv4();
    const expiresAt = Date.now() + (10 * 60 * 1000); // 10 minutes

    authCodes.set(code, {
      code,
      clientId,
      redirectUri,
      userId,
      scopes,
      expiresAt
    });

    return code;
  }

  // Exchange authorization code for tokens
  static async exchangeCodeForTokens(
    code: string,
    clientId: string,
    clientSecret: string,
    redirectUri: string
  ): Promise<TokenResponse> {
    const authCode = authCodes.get(code);
    
    // Validate authorization code
    if (!authCode) {
      throw new Error('Invalid authorization code');
    }

    if (authCode.expiresAt < Date.now()) {
      authCodes.delete(code);
      throw new Error('Authorization code expired');
    }

    if (authCode.clientId !== clientId) {
      throw new Error('Invalid client ID');
    }

    if (authCode.redirectUri !== redirectUri) {
      throw new Error('Invalid redirect URI');
    }

    // Validate client credentials
    const client = clients.find(c => c.clientId === clientId);
    if (!client) {
      throw new Error('Invalid client');
    }

    const isValidSecret = await bcrypt.compare(clientSecret, client.clientSecret);
    if (!isValidSecret) {
      throw new Error('Invalid client secret');
    }

    // Clean up used authorization code
    authCodes.delete(code);

    // Generate tokens
    const accessToken = jwt.sign(
      {
        sub: authCode.userId,
        client_id: clientId,
        scope: authCode.scopes.join(' '),
        type: 'access'
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    const refreshToken = jwt.sign(
      {
        sub: authCode.userId,
        client_id: clientId,
        type: 'refresh'
      },
      JWT_SECRET,
      { expiresIn: REFRESH_TOKEN_EXPIRES_IN }
    );

    // Store tokens
    const tokenId = uuidv4();
    tokenStore.set(tokenId, {
      accessToken,
      refreshToken,
      clientId,
      userId: authCode.userId,
      scopes: authCode.scopes,
      expiresAt: Date.now() + (15 * 60 * 1000), // 15 minutes
      createdAt: Date.now()
    });

    return {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: 15 * 60, // 15 minutes in seconds
      refresh_token: refreshToken,
      scope: authCode.scopes.join(' ')
    };
  }

  // Refresh access token
  static async refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
    try {
      const decoded = jwt.verify(refreshToken, JWT_SECRET) as jwt.JwtPayload;
      
      if ((decoded as jwt.JwtPayload & { type?: string }).type !== 'refresh') {
        throw new Error('Invalid token type');
      }

      // Find stored token
      const storedToken = Array.from(tokenStore.values())
        .find(token => token.refreshToken === refreshToken);

      if (!storedToken) {
        throw new Error('Invalid refresh token');
      }

      // Generate new access token
      const newAccessToken = jwt.sign(
        {
          sub: (decoded as jwt.JwtPayload & { sub?: string }).sub,
          client_id: (decoded as jwt.JwtPayload & { client_id?: string }).client_id,
          scope: storedToken.scopes.join(' '),
          type: 'access'
        },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
      );

      // Update stored token
      storedToken.accessToken = newAccessToken;
      storedToken.expiresAt = Date.now() + (15 * 60 * 1000);

      return {
        access_token: newAccessToken,
        token_type: 'Bearer',
        expires_in: 15 * 60,
        refresh_token: refreshToken,
        scope: storedToken.scopes.join(' ')
      };
    } catch {
      throw new Error('Invalid refresh token');
    }
  }

  // Validate access token
  static async validateAccessToken(token: string): Promise<{
    valid: boolean;
    userId?: string;
    clientId?: string;
    scopes?: string[];
    error?: string;
  }> {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload;
      
      if ((decoded as jwt.JwtPayload & { type?: string }).type !== 'access') {
        return { valid: false, error: 'Invalid token type' };
      }

      // Check if token is in store (for revocation check)
      const storedToken = Array.from(tokenStore.values())
        .find(t => t.accessToken === token);

      if (!storedToken) {
        return { valid: false, error: 'Token not found or revoked' };
      }

      if (storedToken.expiresAt < Date.now()) {
        return { valid: false, error: 'Token expired' };
      }

      return {
        valid: true,
        userId: (decoded as jwt.JwtPayload & { sub?: string }).sub,
        clientId: (decoded as jwt.JwtPayload & { client_id?: string }).client_id,
        scopes: (decoded as jwt.JwtPayload & { scope?: string }).scope?.split(' ') || []
      };
    } catch {
      return { valid: false, error: 'Invalid token' };
    }
  }

  // Revoke token
  static revokeToken(token: string): boolean {
    const tokenEntry = Array.from(tokenStore.entries())
      .find(([, tokenData]) => 
        tokenData.accessToken === token || tokenData.refreshToken === token
      );

    if (tokenEntry) {
      tokenStore.delete(tokenEntry[0]);
      return true;
    }

    return false;
  }

  // Authenticate user
  static async authenticateUser(username: string, password: string): Promise<{ success: boolean; userId?: string; error?: string }> {
    const user = Array.from(users.values()).find(u => u.username === username);
    
    if (!user) {
      return { success: false, error: 'Invalid credentials' };
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return { success: false, error: 'Invalid credentials' };
    }

    return { success: true, userId: user.id };
  }

  // Get client by ID
  static getClient(clientId: string): OAuthClient | undefined {
    return clients.find(c => c.clientId === clientId);
  }

  // Salesforce-specific methods

  // Generate Salesforce authorization URL
  static generateSalesforceAuthUrl(clientId: string, redirectUri: string, scopes: string[], state?: string): string {
    const client = clients.find(c => c.clientId === clientId && c.type === 'salesforce_connected_app');
    if (!client || !client.salesforceConfig) {
      throw new Error('Invalid Salesforce client');
    }

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: scopes.join(' '),
      ...(state && { state })
    });

    return `${client.salesforceConfig.loginUrl}/services/oauth2/authorize?${params.toString()}`;
  }

  // Exchange Salesforce authorization code for tokens
  static async exchangeSalesforceCodeForTokens(
    code: string,
    clientId: string,
    clientSecret: string,
    redirectUri: string
  ): Promise<SalesforceTokenResponse> {
    const client = clients.find(c => c.clientId === clientId && c.type === 'salesforce_connected_app');
    if (!client || !client.salesforceConfig) {
      throw new Error('Invalid Salesforce client');
    }

    // Validate client secret
    const isValidSecret = await bcrypt.compare(clientSecret, client.clientSecret);
    if (!isValidSecret) {
      throw new Error('Invalid client secret');
    }

    const tokenUrl = `${client.salesforceConfig.loginUrl}/services/oauth2/token`;
    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      code: code
    });

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: params.toString()
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Salesforce token exchange failed: ${error}`);
    }

    return await response.json();
  }

  // Get Salesforce user info
  static async getSalesforceUserInfo(accessToken: string, instanceUrl: string): Promise<SalesforceUserInfo> {
    const userInfoUrl = `${instanceUrl}/services/oauth2/userinfo`;
    
    const response = await fetch(userInfoUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error('Failed to get Salesforce user info');
    }

    return await response.json();
  }

  // Validate Salesforce JWT Bearer token (for server-to-server calls from Apex)
  static async validateSalesforceJWT(token: string): Promise<{
    valid: boolean;
    userId?: string;
    organizationId?: string;
    error?: string;
  }> {
    try {
      // For JWT validation, we need to verify the signature
      // In a production environment, you would:
      // 1. Fetch the Salesforce public key from the JWKS endpoint
      // 2. Verify the JWT signature
      // 3. Validate the claims (iss, aud, exp, etc.)
      
      // For now, we'll do basic JWT parsing and validation
      const decoded = jwt.decode(token, { complete: true }) as jwt.JwtPayload;
      
      if (!decoded || !(decoded as jwt.JwtPayload & { header?: unknown }).header || !(decoded as jwt.JwtPayload & { payload?: unknown }).payload) {
        return { valid: false, error: 'Invalid JWT format' };
      }

      const payload = (decoded as jwt.JwtPayload & { payload?: Record<string, unknown> }).payload;
      
      if (!payload) {
        return { valid: false, error: 'Invalid JWT payload' };
      }
      
      // Check if it's a Salesforce JWT
      if (payload.iss !== SALESFORCE_LOGIN_URL) {
        return { valid: false, error: 'Invalid issuer' };
      }

      // Check if it's for our application
      if (payload.aud !== SALESFORCE_CLIENT_ID) {
        return { valid: false, error: 'Invalid audience' };
      }

      // Check expiration
      if (payload.exp && typeof payload.exp === 'number' && payload.exp < Math.floor(Date.now() / 1000)) {
        return { valid: false, error: 'Token expired' };
      }

      return {
        valid: true,
        userId: payload.sub as string,
        organizationId: payload.organization_id as string
      };
    } catch {
      return { valid: false, error: 'JWT validation failed' };
    }
  }

  // Create internal access token from Salesforce user info
  static createInternalTokenFromSalesforceUser(
    salesforceUser: SalesforceUserInfo,
    clientId: string,
    scopes: string[]
  ): TokenResponse {
    const accessToken = jwt.sign(
      {
        sub: salesforceUser.user_id,
        client_id: clientId,
        scope: scopes.join(' '),
        type: 'access',
        salesforce_user_id: salesforceUser.user_id,
        salesforce_org_id: salesforceUser.organization_id,
        salesforce_email: salesforceUser.email
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    const refreshToken = jwt.sign(
      {
        sub: salesforceUser.user_id,
        client_id: clientId,
        type: 'refresh',
        salesforce_user_id: salesforceUser.user_id
      },
      JWT_SECRET,
      { expiresIn: REFRESH_TOKEN_EXPIRES_IN }
    );

    // Store tokens
    const tokenId = uuidv4();
    tokenStore.set(tokenId, {
      accessToken,
      refreshToken,
      clientId,
      userId: salesforceUser.user_id,
      scopes,
      expiresAt: Date.now() + (15 * 60 * 1000), // 15 minutes
      createdAt: Date.now()
    });

    return {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: 15 * 60, // 15 minutes in seconds
      refresh_token: refreshToken,
      scope: scopes.join(' ')
    };
  }

  // Enhanced token validation that supports both internal and Salesforce JWT tokens
  static async validateAccessTokenEnhanced(token: string): Promise<{
    valid: boolean;
    userId?: string;
    clientId?: string;
    scopes?: string[];
    error?: string;
    isSalesforceJWT?: boolean;
    salesforceUserId?: string;
    salesforceOrgId?: string;
  }> {
    // First try internal token validation
    const internalValidation = await this.validateAccessToken(token);
    if (internalValidation.valid) {
      return internalValidation;
    }

    // If internal validation fails, try Salesforce JWT validation
    const salesforceValidation = await this.validateSalesforceJWT(token);
    if (salesforceValidation.valid) {
      return {
        valid: true,
        userId: salesforceValidation.userId,
        clientId: `${SALESFORCE_CLIENT_ID}_jwt`,
        scopes: ['email:validate', 'api'],
        isSalesforceJWT: true,
        salesforceUserId: salesforceValidation.userId,
        salesforceOrgId: salesforceValidation.organizationId
      };
    }

    return { valid: false, error: 'Invalid token' };
  }
}
