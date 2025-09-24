/**
 * @description Test class for EmailValidatorService
 * @author Your Name
 * @date 2024
 */
@IsTest
private class EmailValidatorServiceTest {
    
    @TestSetup
    static void setupTestData() {
        // Setup any test data if needed
    }
    
    @IsTest
    static void testValidateEmail_Success() {
        // Mock the HTTP callout
        Test.setMock(HttpCalloutMock.class, new EmailValidatorMockResponse());
        
        Test.startTest();
        EmailValidatorService.EmailValidationResult result = EmailValidatorService.validateEmail('test@example.com');
        Test.stopTest();
        
        // Assertions
        System.assertNotEquals(null, result, 'Result should not be null');
        System.assertEquals(true, result.success, 'Validation should succeed');
        System.assertNotEquals(null, result.message, 'Message should not be null');
    }
    
    @IsTest
    static void testValidateEmail_InvalidEmail() {
        // Mock the HTTP callout for invalid email
        Test.setMock(HttpCalloutMock.class, new EmailValidatorMockResponse(false, 'Invalid email format', 'syntax'));
        
        Test.startTest();
        EmailValidatorService.EmailValidationResult result = EmailValidatorService.validateEmail('invalid-email');
        Test.stopTest();
        
        // Assertions
        System.assertNotEquals(null, result, 'Result should not be null');
        System.assertEquals(false, result.success, 'Validation should fail');
        System.assertEquals('syntax', result.stage, 'Should fail at syntax stage');
    }
    
    @IsTest
    static void testValidateEmail_NetworkError() {
        // Mock network error
        Test.setMock(HttpCalloutMock.class, new EmailValidatorMockResponse(true, 'Network Error', 'network'));
        
        Test.startTest();
        EmailValidatorService.EmailValidationResult result = EmailValidatorService.validateEmail('test@example.com');
        Test.stopTest();
        
        // Assertions
        System.assertNotEquals(null, result, 'Result should not be null');
        // The result will depend on how you handle network errors in your service
    }
    
    /**
     * @description Mock HTTP response for testing
     */
    private class EmailValidatorMockResponse implements HttpCalloutMock {
        private Boolean success;
        private String message;
        private String stage;
        
        public EmailValidatorMockResponse() {
            this.success = true;
            this.message = 'Email address is valid';
            this.stage = 'mx_record';
        }
        
        public EmailValidatorMockResponse(Boolean success, String message, String stage) {
            this.success = success;
            this.message = message;
            this.stage = stage;
        }
        
        public HttpResponse respond(HttpRequest req) {
            HttpResponse res = new HttpResponse();
            res.setHeader('Content-Type', 'application/json');
            
            if (req.getEndpoint().contains('/validate')) {
                // Mock validation response
                Map<String, Object> responseData = new Map<String, Object>{
                    'success' => success,
                    'message' => message,
                    'stage' => stage,
                    'validationResults' => new Map<String, Object>{
                        'syntax' => new Map<String, Object>{
                            'passed' => success,
                            'message' => message
                        },
                        'mxRecord' => new Map<String, Object>{
                            'passed' => success,
                            'message' => message,
                            'records' => new List<String>{'mx1.example.com', 'mx2.example.com'}
                        }
                    },
                    'authInfo' => new Map<String, Object>{
                        'userId' => UserInfo.getUserId(),
                        'clientId' => 'test-client',
                        'isSalesforceJWT' => true,
                        'salesforceUserId' => UserInfo.getUserId(),
                        'salesforceOrgId' => UserInfo.getOrganizationId()
                    }
                };
                
                res.setBody(JSON.serialize(responseData));
                res.setStatusCode(200);
            } else if (req.getEndpoint().contains('/oauth/salesforce/token')) {
                // Mock token response
                Map<String, Object> tokenData = new Map<String, Object>{
                    'access_token' => 'mock-access-token',
                    'token_type' => 'Bearer',
                    'expires_in' => 900,
                    'scope' => 'email:validate api'
                };
                
                res.setBody(JSON.serialize(tokenData));
                res.setStatusCode(200);
            } else {
                res.setStatusCode(404);
                res.setBody('Not Found');
            }
            
            return res;
        }
    }
}
