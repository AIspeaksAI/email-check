import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

// OAuth 2.0 Configuration
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
const JWT_EXPIRES_IN = '15m'; // Access token expires in 15 minutes
const REFRESH_TOKEN_EXPIRES_IN = '7d'; // Refresh token expires in 7 days

// Client registry (in production, this would be in a database)
interface OAuthClient {
  clientId: string;
  clientSecret: string;
  redirectUris: string[];
  scopes: string[];
  name: string;
}

// Initialize clients with hashed secrets
const clients: OAuthClient[] = [];
const initializeClients = async () => {
  clients.push({
    clientId: 'email-validator-web',
    clientSecret: await bcrypt.hash('web-client-secret', 10),
    redirectUris: ['http://localhost:3001'],
    scopes: ['email:validate'],
    name: 'Email Validator Web App'
  });
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
      const decoded = jwt.verify(refreshToken, JWT_SECRET) as any;
      
      if (decoded.type !== 'refresh') {
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
          sub: decoded.sub,
          client_id: decoded.client_id,
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
    } catch (error) {
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
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      
      if (decoded.type !== 'access') {
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
        userId: decoded.sub,
        clientId: decoded.client_id,
        scopes: decoded.scope.split(' ')
      };
    } catch (error) {
      return { valid: false, error: 'Invalid token' };
    }
  }

  // Revoke token
  static revokeToken(token: string): boolean {
    const tokenEntry = Array.from(tokenStore.entries())
      .find(([_, tokenData]) => 
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
}
