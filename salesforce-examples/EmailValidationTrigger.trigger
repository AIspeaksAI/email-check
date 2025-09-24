/**
 * @description Trigger to automatically validate email addresses
 * @author Your Name
 * @date 2024
 */
trigger EmailValidationTrigger on Contact (before insert, before update) {
    
    // Only process if email validation is enabled
    if (!EmailValidationSettings__c.getInstance().Enable_Email_Validation__c) {
        return;
    }
    
    List<Contact> contactsToValidate = new List<Contact>();
    
    for (Contact contact : Trigger.new) {
        // Check if email has changed and is not empty
        if (String.isNotBlank(contact.Email)) {
            if (Trigger.isInsert || 
                (Trigger.isUpdate && contact.Email != Trigger.oldMap.get(contact.Id).Email)) {
                contactsToValidate.add(contact);
            }
        }
    }
    
    if (!contactsToValidate.isEmpty()) {
        validateEmails(contactsToValidate);
    }
}

/**
 * @description Helper method to validate emails
 * @param contacts List of contacts to validate
 */
private static void validateEmails(List<Contact> contacts) {
    List<Contact> contactsToUpdate = new List<Contact>();
    
    for (Contact contact : contacts) {
        try {
            EmailValidatorService.EmailValidationResult result = 
                EmailValidatorService.validateEmail(contact.Email);
            
            // Update contact with validation results
            contact.Email_Validation_Status__c = result.success ? 'Valid' : 'Invalid';
            contact.Email_Validation_Message__c = result.message;
            contact.Email_Validation_Stage__c = result.stage;
            contact.Email_Validation_Date__c = DateTime.now();
            
            // Add custom field for validation details if needed
            if (result.details != null) {
                contact.Email_Validation_Details__c = JSON.serialize(result.details);
            }
            
            contactsToUpdate.add(contact);
            
        } catch (Exception e) {
            // Log error and mark as validation error
            contact.Email_Validation_Status__c = 'Error';
            contact.Email_Validation_Message__c = 'Validation failed: ' + e.getMessage();
            contact.Email_Validation_Date__c = DateTime.now();
            contactsToUpdate.add(contact);
            
            System.debug('Email validation error for contact ' + contact.Id + ': ' + e.getMessage());
        }
    }
    
    // Note: In a trigger, you can't perform DML operations on the same object
    // This would typically be handled by a future method or queueable
    if (!contactsToUpdate.isEmpty()) {
        // For demonstration - in practice, you'd use a future method
        System.debug('Validated ' + contactsToUpdate.size() + ' email addresses');
    }
}
