import { NextResponse } from 'next/server';
import { z } from 'zod';
import { promises as dns } from 'dns';
import { OAuth2Server } from '@/lib/oauth2';

const emailSchema = z.string().email({ message: "Invalid email format (RFC 5322)" });

export async function POST(request: Request) {
  // OAuth 2.0 Token Validation
  const authHeader = request.headers.get('Authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json(
      { 
        error: 'invalid_token',
        error_description: 'Bearer token required' 
      }, 
      { status: 401 }
    );
  }

  const token = authHeader.substring(7); // Remove 'Bearer ' prefix
  const tokenValidation = await OAuth2Server.validateAccessTokenEnhanced(token);

  if (!tokenValidation.valid) {
    return NextResponse.json(
      { 
        error: 'invalid_token',
        error_description: tokenValidation.error || 'Invalid token' 
      }, 
      { status: 401 }
    );
  }

  // Check if user has required scope
  if (!tokenValidation.scopes?.includes('email:validate')) {
    return NextResponse.json(
      { 
        error: 'insufficient_scope',
        error_description: 'email:validate scope required' 
      }, 
      { status: 403 }
    );
  }

  const body = await request.json();
  const email = body.email;

  // Initialize validation results
  const validationResults = {
    syntax: { passed: false, message: '' },
    mxRecord: { passed: false, message: '', records: [] as string[] }
  };

  // 1. Syntax Validation
  const syntaxCheck = emailSchema.safeParse(email);
  if (!syntaxCheck.success) {
    validationResults.syntax = {
      passed: false,
      message: syntaxCheck.error.issues[0].message
    };
    return NextResponse.json({ 
      success: false, 
      stage: 'syntax', 
      message: syntaxCheck.error.issues[0].message,
      validationResults
    }, { status: 400 });
  }

  validationResults.syntax = {
    passed: true,
    message: 'Email format is valid (RFC 5322)'
  };

  const domain = email.split('@')[1];

  // 2. Domain & MX Record Validation
  try {
    const mxRecords = await dns.resolveMx(domain);
    if (mxRecords.length === 0) {
      validationResults.mxRecord = {
        passed: false,
        message: 'No MX records found for the domain',
        records: []
      };
      return NextResponse.json({ 
        success: false, 
        stage: 'mx_record', 
        message: 'No MX records found for the domain.',
        validationResults
      }, { status: 400 });
    }
    
    // const sortedRecords = mxRecords.sort((a, b) => a.priority - b.priority);
    validationResults.mxRecord = {
      passed: true,
      message: `Found ${mxRecords.length} MX record(s) for domain`,
      records: mxRecords.map(r => r.exchange)
    };

    // Email validation successful - syntax and MX records are valid
    return NextResponse.json({
      success: true,
      stage: 'mx_record',
      message: 'Email address is valid (syntax and domain checks passed).',
      validationResults,
      authInfo: {
        userId: tokenValidation.userId,
        clientId: tokenValidation.clientId,
        isSalesforceJWT: tokenValidation.isSalesforceJWT,
        salesforceUserId: tokenValidation.salesforceUserId,
        salesforceOrgId: tokenValidation.salesforceOrgId
      }
    });
  } catch {
    validationResults.mxRecord = {
      passed: false,
      message: 'Domain is invalid or could not be resolved',
      records: []
    };
    return NextResponse.json({ 
      success: false, 
      stage: 'mx_record', 
      message: 'Domain is invalid or could not be resolved.',
      validationResults
    }, { status: 400 });
  }
}
