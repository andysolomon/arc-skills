/**
 * Apex behind the accountList component. One read, cacheable, so the component's @wire
 * keeps the last good list and refreshApex can ask again. Every failure leaves here as an
 * AuraHandledException carrying a sentence the user can act on.
 */
public with sharing class AccountListController {
    public static final Integer DEFAULT_SIZE = 10;
    public static final Integer MAX_SIZE = 50;

    @TestVisible
    private static AccountSelector selector = new AccountSelector();

    @AuraEnabled(cacheable=true)
    public static List<Account> getRecentAccounts(Integer size) {
        Integer bounded = (size == null || size < 1 || size > MAX_SIZE) ? DEFAULT_SIZE : size;
        try {
            return selector.recent(bounded);
        } catch (QueryException e) {
            // Missing object or field access. The cause goes to the debug log; the user gets a sentence.
            System.debug(LoggingLevel.ERROR, e.getMessage());
            throw newHandled(
                'You do not have access to accounts. Ask your Salesforce admin for the Account List User permission set.'
            );
        } catch (Exception e) {
            // Anything else would reach the user as "An internal server error has occurred".
            System.debug(LoggingLevel.ERROR, e.getMessage() + '\n' + e.getStackTraceString());
            throw newHandled('Accounts didn\'t load. Try again, and if it keeps failing, tell your Salesforce admin.');
        }
    }

    private static AuraHandledException newHandled(String message) {
        AuraHandledException e = new AuraHandledException(message);
        e.setMessage(message);
        return e;
    }
}
