'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Toaster, toast } from 'sonner';
import { Loader2, LogIn, LogOut, Users } from 'lucide-react';
import { useOAuth } from '@/components/oauth-provider';

// Define a type for the API response
type ValidationResult = {
  success: boolean;
  stage: 'syntax' | 'mx_record';
  message: string;
  validationResults?: {
    syntax: { passed: boolean; message: string };
    mxRecord: { passed: boolean; message: string; records: string[] };
  };
};

export default function HomePage() {
  const [email, setEmail] = useState('');
  const [result, setResult] = useState<ValidationResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { accessToken, isAuthenticated, isLoading: oauthLoading, login, loginWithSalesforce, logout, userInfo } = useOAuth();

  const handleValidation = async () => {
    if (!email.trim()) {
      toast.error("Please enter an email address");
      return;
    }

    if (!isAuthenticated) {
      toast.error("Please log in to validate emails");
      return;
    }

    setIsLoading(true);
    setResult(null);

    try {
      const response = await fetch('/api/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({ email }),
      });

      const data: ValidationResult = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          toast.error('Session expired. Please log in again.');
          logout();
        } else if (response.status === 403) {
          toast.error('Insufficient permissions to validate emails.');
        } else {
          toast.error(data.message || 'An unknown error occurred.');
        }
      } else {
        toast.success('Validation complete!');
      }
      setResult(data);
    } catch (error) {
      console.error('Validation failed:', error);
      toast.error('Failed to connect to the server. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (oauthLoading) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-gray-50">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-gray-500">Loading...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-gray-50">
      <Toaster richColors />
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight">Email Check</h1>
          <p className="text-gray-500 mt-2">
            {isAuthenticated 
              ? `Welcome${userInfo?.name ? `, ${userInfo.name}` : ''}! Enter an email address to validate it.` 
              : 'Please log in to validate email addresses.'
            }
          </p>
          {isAuthenticated && userInfo?.isSalesforceUser && (
            <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-700">
                <Users className="h-4 w-4 inline mr-1" />
                Authenticated via Salesforce
                {userInfo.organizationId && (
                  <span className="block text-xs text-blue-600 mt-1">
                    Org ID: {userInfo.organizationId}
                  </span>
                )}
              </p>
            </div>
          )}
          <div className="mt-4 space-y-2">
            {isAuthenticated ? (
              <Button onClick={logout} variant="outline" size="sm">
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </Button>
            ) : (
              <div className="space-y-2">
                <Button onClick={login} size="sm" className="w-full">
                  <LogIn className="h-4 w-4 mr-2" />
                  Login with OAuth 2.0
                </Button>
                <Button onClick={loginWithSalesforce} variant="outline" size="sm" className="w-full">
                  <Users className="h-4 w-4 mr-2" />
                  Login with Salesforce
                </Button>
              </div>
            )}
          </div>
        </div>
        <Card>
          <CardContent className="pt-6">
            <div className="flex w-full items-center space-x-2">
              <Input
                type="email"
                placeholder="test@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
              />
              <Button onClick={handleValidation} disabled={isLoading || !isAuthenticated}>
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Validate'}
              </Button>
            </div>
          </CardContent>
        </Card>
        {result && (
          <Card>
            <CardHeader>
              <CardTitle className={result.success ? 'text-green-600' : 'text-red-600'}>
                Validation {result.success ? 'Successful' : 'Failed'} at {result.stage} stage
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-4">{result.message}</p>
              
              {result.validationResults && (
                <div className="space-y-4">
                  <h4 className="font-semibold text-lg">Validation Details:</h4>
                  
                  {/* Syntax Validation */}
                  <div className="flex items-center space-x-3 p-3 rounded-lg border">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                      result.validationResults.syntax.passed ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
                    }`}>
                      {result.validationResults.syntax.passed ? '✓' : '✗'}
                    </div>
                    <div className="flex-1">
                      <h5 className="font-medium">Syntax Validation</h5>
                      <p className="text-sm text-gray-600">{result.validationResults.syntax.message}</p>
                    </div>
                  </div>

                  {/* MX Record Validation */}
                  <div className="flex items-center space-x-3 p-3 rounded-lg border">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                      result.validationResults.mxRecord.passed ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
                    }`}>
                      {result.validationResults.mxRecord.passed ? '✓' : '✗'}
                    </div>
                    <div className="flex-1">
                      <h5 className="font-medium">MX Record Validation</h5>
                      <p className="text-sm text-gray-600">{result.validationResults.mxRecord.message}</p>
                      {result.validationResults.mxRecord.records.length > 0 && (
                        <div className="mt-2">
                          <h6 className="font-medium text-sm">MX Records:</h6>
                          <ul className="list-disc pl-5 text-xs text-gray-500 mt-1">
                            {result.validationResults.mxRecord.records.map((record, index) => (
                              <li key={index}>{record}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>

                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}