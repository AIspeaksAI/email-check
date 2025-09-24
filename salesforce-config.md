# Salesforce Integration Configuration

## Environment Variables

Create a `.env.local` file in your project root with the following variables:

```bash
# OAuth 2.0 Configuration
JWT_SECRET=your-super-secret-jwt-key-change-in-production

# Salesforce Connected App Configuration
SALESFORCE_CLIENT_ID=your-salesforce-connected-app-client-id
SALESFORCE_CLIENT_SECRET=your-salesforce-connected-app-client-secret
SALESFORCE_REDIRECT_URI=http://localhost:3001/oauth/salesforce/callback
SALESFORCE_LOGIN_URL=https://login.salesforce.com
SALESFORCE_API_VERSION=v60.0

# Frontend Configuration (for client-side)
NEXT_PUBLIC_SALESFORCE_CLIENT_ID=your-salesforce-connected-app-client-id
NEXT_PUBLIC_SALESFORCE_CLIENT_SECRET=your-salesforce-connected-app-client-secret

# Application Configuration
NEXT_PUBLIC_APP_URL=http://localhost:3001
```

## Salesforce Connected App Setup

### 1. Create Connected App in Salesforce

1. Go to **Setup** → **App Manager**
2. Click **New Connected App**
3. Fill in the basic information:
   - **Connected App Name**: Email Validator API
   - **API Name**: Email_Validator_API
   - **Contact Email**: your-email@company.com
   - **Description**: Integration with Email Validator API

### 2. Configure OAuth Settings

1. Check **Enable OAuth Settings**
2. **Callback URL**: `https://your-app-domain.com/oauth/salesforce/callback`
3. **Selected OAuth Scopes**:
   - Access and manage your data (api)
   - Perform requests on your behalf at any time (refresh_token, offline_access)
   - Access your basic information (id, profile, email, address, phone)

### 3. Configure CORS Settings

1. In the Connected App, go to **CORS** settings
2. Add your application domain: `https://your-app-domain.com`
3. Add localhost for development: `http://localhost:3001`

### 4. Get Credentials

After saving, note down:
- **Consumer Key** (use as `SALESFORCE_CLIENT_ID`)
- **Consumer Secret** (use as `SALESFORCE_CLIENT_SECRET`)

## JWT Bearer Token Setup (Optional)

For server-to-server authentication without user interaction:

### 1. Generate Certificate

```bash
# Generate private key
openssl genrsa -out private_key.pem 2048

# Generate certificate
openssl req -new -x509 -key private_key.pem -out certificate.crt -days 365

# Convert to PKCS#8 format
openssl pkcs8 -topk8 -inform PEM -outform PEM -nocrypt -in private_key.pem -out private_key_pkcs8.pem
```

### 2. Upload Certificate to Salesforce

1. Go to **Setup** → **Certificate and Key Management**
2. Click **Create Self-Signed Certificate**
3. Upload your certificate
4. Note the **Certificate Name**

### 3. Update Connected App

1. In your Connected App, go to **API (Enable OAuth Settings)**
2. Check **Use digital signatures**
3. Upload your certificate
4. Save the changes

## Testing the Integration

### 1. Test Frontend Authentication

1. Start your Next.js application
2. Navigate to the login page
3. Click "Login with Salesforce"
4. Complete the OAuth flow
5. Verify you can access protected resources

### 2. Test API from Salesforce

1. Deploy the Apex code to your Salesforce org
2. Run the test class: `EmailValidatorServiceTest`
3. Test the service in Anonymous Apex:

```apex
EmailValidatorService.EmailValidationResult result = 
    EmailValidatorService.validateEmail('test@example.com');
System.debug('Result: ' + result);
```

### 3. Test JWT Bearer Token Flow

1. Update the JWT creation logic in `EmailValidatorService.cls`
2. Test server-to-server authentication
3. Verify API calls work without user interaction

## Security Best Practices

1. **Store secrets securely**: Use environment variables, not hardcoded values
2. **Use HTTPS**: Always use HTTPS in production
3. **Validate tokens**: Implement proper JWT validation
4. **Rate limiting**: Implement rate limiting for API calls
5. **Logging**: Log authentication attempts and failures
6. **Error handling**: Don't expose sensitive information in error messages

## Troubleshooting

### Common Issues

1. **CORS errors**: Check CORS settings in Connected App
2. **Invalid client**: Verify client ID and secret
3. **Redirect URI mismatch**: Ensure redirect URI matches exactly
4. **JWT validation errors**: Check certificate and JWT format
5. **Network timeouts**: Increase timeout values

### Debug Steps

1. Check browser developer tools for CORS errors
2. Verify environment variables are loaded
3. Test API endpoints directly with Postman
4. Check Salesforce debug logs
5. Verify certificate is properly uploaded

## Production Deployment

### 1. Update Environment Variables

```bash
# Production environment variables
SALESFORCE_CLIENT_ID=your-production-client-id
SALESFORCE_CLIENT_SECRET=your-production-client-secret
SALESFORCE_REDIRECT_URI=https://your-production-domain.com/oauth/salesforce/callback
SALESFORCE_LOGIN_URL=https://login.salesforce.com
NEXT_PUBLIC_APP_URL=https://your-production-domain.com
```

### 2. Update Salesforce Connected App

1. Add production callback URL
2. Update CORS settings for production domain
3. Test the integration thoroughly

### 3. Monitor and Log

1. Set up monitoring for API calls
2. Log authentication events
3. Monitor error rates and performance
4. Set up alerts for failures
