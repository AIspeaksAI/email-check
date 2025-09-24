/**
 * @description Apex service class for calling the Email Validator API
 * @author Your Name
 * @date 2024
 */
public with sharing class EmailValidatorService {
    
    // Configuration - these should be stored in Custom Metadata or Custom Settings
    private static final String API_BASE_URL = 'https://your-app-domain.com/api';
    private static final String CLIENT_ID = 'your-salesforce-connected-app-client-id';
    private static final String CLIENT_SECRET = 'your-salesforce-connected-app-client-secret';
    private static final String JWT_PRIVATE_KEY = 'your-jwt-private-key'; // Store securely
    
    /**
     * @description Validates an email address using the external API
     * @param email The email address to validate
     * @return EmailValidationResult The validation result
     */
    public static EmailValidationResult validateEmail(String email) {
        try {
            // Get access token using JWT Bearer Token flow
            String accessToken = getAccessToken();
            
            if (String.isBlank(accessToken)) {
                return new EmailValidationResult(false, 'Failed to obtain access token', 'auth_error');
            }
            
            // Make API call
            HttpRequest req = new HttpRequest();
            req.setEndpoint(API_BASE_URL + '/validate');
            req.setMethod('POST');
            req.setHeader('Content-Type', 'application/json');
            req.setHeader('Authorization', 'Bearer ' + accessToken);
            req.setBody(JSON.serialize(new Map<String, String>{ 'email' => email }));
            req.setTimeout(30000); // 30 seconds timeout
            
            Http http = new Http();
            HttpResponse res = http.send(req);
            
            if (res.getStatusCode() == 200) {
                Map<String, Object> responseData = (Map<String, Object>) JSON.deserializeUntyped(res.getBody());
                return new EmailValidationResult(
                    (Boolean) responseData.get('success'),
                    (String) responseData.get('message'),
                    (String) responseData.get('stage'),
                    responseData
                );
            } else {
                Map<String, Object> errorData = (Map<String, Object>) JSON.deserializeUntyped(res.getBody());
                return new EmailValidationResult(
                    false,
                    (String) errorData.get('error_description'),
                    (String) errorData.get('error')
                );
            }
            
        } catch (Exception e) {
            System.debug('Email validation error: ' + e.getMessage());
            return new EmailValidationResult(false, 'Validation failed: ' + e.getMessage(), 'exception');
        }
    }
    
    /**
     * @description Gets access token using JWT Bearer Token flow
     * @return String The access token
     */
    private static String getAccessToken() {
        try {
            // Create JWT assertion
            String assertion = createJWTAssertion();
            
            // Request access token
            HttpRequest req = new HttpRequest();
            req.setEndpoint(API_BASE_URL + '/oauth/salesforce/token');
            req.setMethod('POST');
            req.setHeader('Content-Type', 'application/json');
            req.setBody(JSON.serialize(new Map<String, String>{
                'grant_type' => 'urn:ietf:params:oauth:grant-type:jwt-bearer',
                'assertion' => assertion
            }));
            req.setTimeout(30000);
            
            Http http = new Http();
            HttpResponse res = http.send(req);
            
            if (res.getStatusCode() == 200) {
                Map<String, Object> tokenData = (Map<String, Object>) JSON.deserializeUntyped(res.getBody());
                return (String) tokenData.get('access_token');
            } else {
                System.debug('Token request failed: ' + res.getBody());
                return null;
            }
            
        } catch (Exception e) {
            System.debug('Token request error: ' + e.getMessage());
            return null;
        }
    }
    
    /**
     * @description Creates JWT assertion for server-to-server authentication
     * @return String The JWT assertion
     */
    private static String createJWTAssertion() {
        // This is a simplified JWT creation - in production, use a proper JWT library
        // or Salesforce's built-in JWT functionality
        
        String header = JSON.serialize(new Map<String, String>{
            'alg' => 'RS256',
            'typ' => 'JWT'
        });
        
        String payload = JSON.serialize(new Map<String, Object>{
            'iss' => CLIENT_ID,
            'sub' => UserInfo.getUserId(),
            'aud' => API_BASE_URL + '/oauth/salesforce/token',
            'exp' => DateTime.now().addMinutes(5).getTime() / 1000,
            'iat' => DateTime.now().getTime() / 1000,
            'organization_id' => UserInfo.getOrganizationId()
        });
        
        // In production, you would sign this with your private key
        // For this example, we'll use a placeholder
        String signature = 'your-jwt-signature-here';
        
        return EncodingUtil.base64Encode(Blob.valueOf(header)) + '.' +
               EncodingUtil.base64Encode(Blob.valueOf(payload)) + '.' +
               signature;
    }
    
    /**
     * @description Inner class to represent validation results
     */
    public class EmailValidationResult {
        public Boolean success { get; set; }
        public String message { get; set; }
        public String stage { get; set; }
        public Map<String, Object> details { get; set; }
        
        public EmailValidationResult(Boolean success, String message, String stage) {
            this.success = success;
            this.message = message;
            this.stage = stage;
            this.details = new Map<String, Object>();
        }
        
        public EmailValidationResult(Boolean success, String message, String stage, Map<String, Object> details) {
            this.success = success;
            this.message = message;
            this.stage = stage;
            this.details = details;
        }
    }
}
