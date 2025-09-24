# Salesforce Integration Examples

This directory contains example Salesforce code for integrating with the Email Validator API.

## Files Overview

### Core Service
- **EmailValidatorService.cls** - Main Apex service class for calling the API
- **EmailValidatorServiceTest.cls** - Test class with mock responses

### Automation
- **EmailValidationTrigger.trigger** - Trigger to automatically validate emails
- **EmailValidationSettings__c.object** - Custom object for configuration

## Setup Instructions

### 1. Create Salesforce Connected App

1. In Salesforce Setup, go to **App Manager**
2. Click **New Connected App**
3. Fill in the required fields:
   - **Connected App Name**: Email Validator API
   - **API Name**: Email_Validator_API
   - **Contact Email**: your-email@company.com
   - **Description**: Integration with Email Validator API

4. In **OAuth Settings**:
   - Check **Enable OAuth Settings**
   - **Callback URL**: `https://your-app-domain.com/oauth/salesforce/callback`
   - **Selected OAuth Scopes**: 
     - Access and manage your data (api)
     - Perform requests on your behalf at any time (refresh_token, offline_access)

5. Save and note down the **Consumer Key** and **Consumer Secret**

### 2. Deploy Custom Objects and Fields

1. Deploy the `EmailValidationSettings__c` custom object
2. Add custom fields to Contact object:
   - `Email_Validation_Status__c` (Text, 50)
   - `Email_Validation_Message__c` (Text, 255)
   - `Email_Validation_Stage__c` (Text, 50)
   - `Email_Validation_Date__c` (DateTime)
   - `Email_Validation_Details__c` (Long Text Area, 32768)

### 3. Configure Settings

1. Create a record in `EmailValidationSettings__c`:
   - **API Base URL**: `https://your-app-domain.com/api`
   - **Client ID**: Your Connected App Consumer Key
   - **Timeout (Seconds)**: 30
   - **Batch Size**: 10
   - **Retry Attempts**: 3

### 4. Deploy Apex Code

1. Deploy `EmailValidatorService.cls`
2. Deploy `EmailValidatorServiceTest.cls`
3. Run tests to ensure everything works

### 5. Set Up JWT Authentication (Optional)

For server-to-server authentication without user interaction:

1. Generate a private key for JWT signing
2. Store it securely in Salesforce (Custom Metadata or Protected Custom Settings)
3. Update the `createJWTAssertion()` method in `EmailValidatorService.cls`

## Usage Examples

### Basic Email Validation

```apex
// Validate a single email
EmailValidatorService.EmailValidationResult result = 
    EmailValidatorService.validateEmail('test@example.com');

if (result.success) {
    System.debug('Email is valid: ' + result.message);
} else {
    System.debug('Email validation failed: ' + result.message);
    System.debug('Failed at stage: ' + result.stage);
}
```

### Batch Email Validation

```apex
// Validate multiple emails
List<String> emails = new List<String>{
    'user1@example.com',
    'user2@invalid-domain.com',
    'user3@example.com'
};

for (String email : emails) {
    EmailValidatorService.EmailValidationResult result = 
        EmailValidatorService.validateEmail(email);
    
    System.debug('Email: ' + email + ' - Valid: ' + result.success);
}
```

### Using in Lightning Web Components

```javascript
// In your LWC JavaScript file
import { LightningElement, track } from 'lwc';
import validateEmail from '@salesforce/apex/EmailValidatorService.validateEmail';

export default class EmailValidator extends LightningElement {
    @track email = '';
    @track validationResult = null;
    @track isLoading = false;

    async handleValidate() {
        this.isLoading = true;
        try {
            this.validationResult = await validateEmail({ email: this.email });
        } catch (error) {
            console.error('Validation error:', error);
        } finally {
            this.isLoading = false;
        }
    }
}
```

## Security Considerations

1. **Store sensitive data securely**: Use Custom Metadata Types or Protected Custom Settings for API keys and secrets
2. **Implement proper error handling**: Always wrap API calls in try-catch blocks
3. **Use appropriate permissions**: Ensure users have necessary permissions to access the service
4. **Rate limiting**: Consider implementing rate limiting for API calls
5. **Logging**: Implement proper logging for debugging and monitoring

## Troubleshooting

### Common Issues

1. **Authentication failures**: Check that your Connected App is properly configured
2. **Timeout errors**: Increase the timeout value in settings
3. **Permission errors**: Ensure the running user has access to the service
4. **API endpoint errors**: Verify the API base URL is correct

### Debug Tips

1. Enable debug logs for the Apex class
2. Check the API response in the debug logs
3. Verify network connectivity from Salesforce
4. Test with a simple email first

## API Response Format

The API returns responses in this format:

```json
{
    "success": true,
    "stage": "mx_record",
    "message": "Email address is valid (syntax and domain checks passed).",
    "validationResults": {
        "syntax": {
            "passed": true,
            "message": "Email format is valid (RFC 5322)"
        },
        "mxRecord": {
            "passed": true,
            "message": "Found 2 MX record(s) for domain",
            "records": ["mx1.example.com", "mx2.example.com"]
        }
    },
    "authInfo": {
        "userId": "005...",
        "clientId": "your-client-id",
        "isSalesforceJWT": true,
        "salesforceUserId": "005...",
        "salesforceOrgId": "00D..."
    }
}
```

## Support

For issues or questions:
1. Check the debug logs
2. Verify your Connected App configuration
3. Test the API endpoint directly
4. Contact your system administrator
