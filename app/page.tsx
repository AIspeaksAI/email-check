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
  records?: string[];
};

export default function HomePage() {
  const [email, setEmail] = useState('');
  const [result, setResult] = useState<ValidationResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleValidation = async () => {
    // Validation logic will go here in Phase 4
    toast.info("Validation logic not yet implemented.");
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
              <p>{result.message}</p>
              {result.records && (
                <div className="mt-4">
                  <h4 className="font-semibold">MX Records Found:</h4>
                  <ul className="list-disc pl-5 text-sm text-gray-600">
                    {result.records.map((record) => <li key={record}>{record}</li>)}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}