'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

interface OAuthContextType {
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: () => void;
  logout: () => void;
  refreshAccessToken: () => Promise<boolean>;
}

const OAuthContext = createContext<OAuthContextType | undefined>(undefined);

interface OAuthProviderProps {
  children: ReactNode;
}

const CLIENT_ID = 'email-validator-web';
const CLIENT_SECRET = 'web-client-secret';
const REDIRECT_URI = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3001';
const SCOPE = 'email:validate';

export function OAuthProvider({ children }: OAuthProviderProps) {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const isAuthenticated = !!accessToken;

  // Initialize OAuth flow on component mount
  useEffect(() => {
    initializeOAuth();
  }, []);

  const initializeOAuth = async () => {
    try {
      // Check for stored tokens
      const storedAccessToken = localStorage.getItem('oauth_access_token');
      const storedRefreshToken = localStorage.getItem('oauth_refresh_token');

      if (storedAccessToken && storedRefreshToken) {
        // Verify if access token is still valid
        const isValid = await validateAccessToken(storedAccessToken);
        
        if (isValid) {
          setAccessToken(storedAccessToken);
          setRefreshToken(storedRefreshToken);
        } else {
          // Try to refresh the token
          const refreshed = await refreshAccessToken(storedRefreshToken);
          if (!refreshed) {
            // Both tokens are invalid, clear storage
            localStorage.removeItem('oauth_access_token');
            localStorage.removeItem('oauth_refresh_token');
          }
        }
      } else {
        // Check for authorization code in URL
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        const state = urlParams.get('state');

        if (code) {
          await exchangeCodeForTokens(code);
          // Clean up URL
          window.history.replaceState({}, document.title, window.location.pathname);
        }
      }
    } catch (error) {
      console.error('OAuth initialization error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const validateAccessToken = async (token: string): Promise<boolean> => {
    try {
      const response = await fetch('/api/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ email: 'test@example.com' })
      });

      return response.status !== 401;
    } catch {
      return false;
    }
  };

  const exchangeCodeForTokens = async (code: string) => {
    try {
      const response = await fetch('/api/oauth/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          grant_type: 'authorization_code',
          code,
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
          redirect_uri: REDIRECT_URI
        })
      });

      if (!response.ok) {
        throw new Error('Token exchange failed');
      }

      const tokenData = await response.json();
      
      setAccessToken(tokenData.access_token);
      setRefreshToken(tokenData.refresh_token);
      
      // Store tokens
      localStorage.setItem('oauth_access_token', tokenData.access_token);
      localStorage.setItem('oauth_refresh_token', tokenData.refresh_token);
    } catch (error) {
      console.error('Token exchange error:', error);
      throw error;
    }
  };

  const refreshAccessToken = async (refreshTokenToUse?: string): Promise<boolean> => {
    try {
      const tokenToUse = refreshTokenToUse || refreshToken;
      if (!tokenToUse) return false;

      const response = await fetch('/api/oauth/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          grant_type: 'refresh_token',
          refresh_token: tokenToUse,
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET
        })
      });

      if (!response.ok) {
        throw new Error('Token refresh failed');
      }

      const tokenData = await response.json();
      
      setAccessToken(tokenData.access_token);
      setRefreshToken(tokenData.refresh_token);
      
      // Update stored tokens
      localStorage.setItem('oauth_access_token', tokenData.access_token);
      localStorage.setItem('oauth_refresh_token', tokenData.refresh_token);
      
      return true;
    } catch (error) {
      console.error('Token refresh error:', error);
      return false;
    }
  };

  const login = () => {
    const authUrl = `/api/oauth/authorize?${new URLSearchParams({
      response_type: 'code',
      client_id: CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      scope: SCOPE,
      state: Math.random().toString(36).substring(7)
    })}`;
    
    window.location.href = authUrl;
  };

  const logout = async () => {
    try {
      // Revoke tokens
      if (accessToken) {
        await fetch('/api/oauth/revoke', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            token: accessToken,
            token_type_hint: 'access_token'
          })
        });
      }

      if (refreshToken) {
        await fetch('/api/oauth/revoke', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            token: refreshToken,
            token_type_hint: 'refresh_token'
          })
        });
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Clear local state and storage
      setAccessToken(null);
      setRefreshToken(null);
      localStorage.removeItem('oauth_access_token');
      localStorage.removeItem('oauth_refresh_token');
    }
  };

  const value: OAuthContextType = {
    accessToken,
    refreshToken,
    isAuthenticated,
    isLoading,
    login,
    logout,
    refreshAccessToken: () => refreshAccessToken()
  };

  return (
    <OAuthContext.Provider value={value}>
      {children}
    </OAuthContext.Provider>
  );
}

export function useOAuth() {
  const context = useContext(OAuthContext);
  if (context === undefined) {
    throw new Error('useOAuth must be used within an OAuthProvider');
  }
  return context;
}
