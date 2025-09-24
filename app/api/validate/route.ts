import { NextResponse } from 'next/server';
import { z } from 'zod';
import { promises as dns } from 'dns';
import { SMTPClient } from 'smtp-client';

const emailSchema = z.string().email({ message: "Invalid email format (RFC 5322)" });

export async function POST(request: Request) {
  // API Key check will be added in Phase 4

  const body = await request.json();
  const email = body.email;

  // Initialize validation results
  const validationResults = {
    syntax: { passed: false, message: '' },
    mxRecord: { passed: false, message: '', records: [] },
    smtp: { passed: false, message: '' }
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

    // 3. SMTP Mailbox Verification
    try {
      const client = new SMTPClient({
        host: sortedRecords[0].exchange,
        port: 25,
        secure: false,
        timeout: 10000, // 10 second timeout
      });
      
      await client.connect();
      await client.helo('email-validator.local');
      await client.mail('validator@email-validator.local');
      const rcptResponse = await client.rcpt(email);
      await client.quit();

      if (rcptResponse.code === 250) {
        validationResults.smtp = {
          passed: true,
          message: 'Mailbox exists and accepts mail'
        };
        return NextResponse.json({
          success: true,
          stage: 'smtp',
          message: 'Email address is valid and exists.',
          validationResults
        });
      } else {
        validationResults.smtp = {
          passed: false,
          message: `Mailbox does not exist (SMTP RCPT TO failed with code ${rcptResponse.code})`
        };
        return NextResponse.json({ 
          success: false, 
          stage: 'smtp', 
          message: `Mailbox does not exist (SMTP RCPT TO failed with code ${rcptResponse.code}).`,
          validationResults
        }, { status: 400 });
      }
    } catch (smtpError) {
      console.error('SMTP Error:', smtpError);
      
      // For Gmail and other major providers, we'll be more lenient
      const isGmail = domain.includes('gmail.com');
      const isOutlook = domain.includes('outlook.com') || domain.includes('hotmail.com');
      const isYahoo = domain.includes('yahoo.com');
      
      if (isGmail || isOutlook || isYahoo) {
        // For major providers, if we have MX records, assume the email is valid
        // since they often block SMTP verification attempts
        validationResults.smtp = {
          passed: true,
          message: 'SMTP verification skipped (blocked by major email provider)'
        };
        return NextResponse.json({
          success: true,
          stage: 'mx_record',
          message: `Email domain (${domain}) has valid MX records. SMTP verification blocked by provider (common for major email providers).`,
          validationResults
        });
      }
      
      validationResults.smtp = {
        passed: false,
        message: 'SMTP server connection failed or rejected the request'
      };
      return NextResponse.json({ 
        success: false, 
        stage: 'smtp', 
        message: 'SMTP server connection failed or rejected the request. This may be due to server restrictions or network issues.',
        validationResults
      }, { status: 400 });
    }
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
