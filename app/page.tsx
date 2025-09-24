'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Toaster, toast } from 'sonner';
import { Loader2 } from 'lucide-react';

// Define a type for the API response
type ValidationResult = {
  success: boolean;
  stage: 'syntax' | 'mx_record' | 'smtp';
  message: string;
  validationResults?: {
    syntax: { passed: boolean; message: string };
    mxRecord: { passed: boolean; message: string; records: string[] };
    smtp: { passed: boolean; message: string };
  };
};

export default function HomePage() {
  const [email, setEmail] = useState('');
  const [result, setResult] = useState<ValidationResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleValidation = async () => {
    if (!email.trim()) {
      toast.error("Please enter an email address");
      return;
    }

    setIsLoading(true);
    setResult(null);

    try {
      const response = await fetch('/api/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();
      setResult(data);

      if (data.success) {
        toast.success("Email validation successful!");
      } else {
        toast.error(`Validation failed: ${data.message}`);
      }
    } catch (error) {
      console.error('Validation error:', error);
      toast.error("An error occurred during validation");
      setResult({
        success: false,
        stage: 'syntax',
        message: 'Network error occurred during validation'
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-gray-50">
      <Toaster richColors />
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight">Email Check</h1>
          <p className="text-gray-500 mt-2">Enter an email address to validate it.</p>
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
              <Button onClick={handleValidation} disabled={isLoading}>
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

                  {/* SMTP Validation */}
                  <div className="flex items-center space-x-3 p-3 rounded-lg border">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                      result.validationResults.smtp.passed ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
                    }`}>
                      {result.validationResults.smtp.passed ? '✓' : '✗'}
                    </div>
                    <div className="flex-1">
                      <h5 className="font-medium">SMTP Validation</h5>
                      <p className="text-sm text-gray-600">{result.validationResults.smtp.message}</p>
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