import { NextResponse } from 'next/server';
import { z } from 'zod';
import { promises as dns } from 'dns';

const emailSchema = z.string().email({ message: "Invalid email format (RFC 5322)" });

export async function POST(request: Request) {
  // API Key check will be added in Phase 4

  const body = await request.json();
  const email = body.email;

  // Initialize validation results
  const validationResults = {
    syntax: { passed: false, message: '' },
    mxRecord: { passed: false, message: '', records: [] }
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
    
    const sortedRecords = mxRecords.sort((a, b) => a.priority - b.priority);
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
      validationResults
    });
  } catch (dnsError) {
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
