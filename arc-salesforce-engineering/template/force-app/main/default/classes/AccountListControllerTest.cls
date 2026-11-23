@IsTest
private class AccountListControllerTest {
    private class DeniedSelector extends AccountSelector {
        public override List<Account> recent(Integer size) {
            throw new QueryException('No access to entity Account');
        }
    }

    private class BrokenSelector extends AccountSelector {
        public override List<Account> recent(Integer size) {
            throw new NullPointerException();
        }
    }

    @TestSetup
    static void makeAccounts() {
        List<Account> accounts = new List<Account>();
        for (Integer i = 0; i < 60; i++) {
            accounts.add(new Account(Name = 'Test account ' + i));
        }
        insert accounts;
    }

    @IsTest
    static void returnsTheRequestedNumber() {
        Test.startTest();
        List<Account> result = AccountListController.getRecentAccounts(5);
        Test.stopTest();
        Assert.areEqual(5, result.size(), 'asked for 5 accounts');
    }

    @IsTest
    static void outOfRangeSizeFallsBackToTheDefault() {
        Assert.areEqual(
            AccountListController.DEFAULT_SIZE,
            AccountListController.getRecentAccounts(null).size(),
            'null size'
        );
        Assert.areEqual(
            AccountListController.DEFAULT_SIZE,
            AccountListController.getRecentAccounts(0).size(),
            'zero size'
        );
        Assert.areEqual(
            AccountListController.DEFAULT_SIZE,
            AccountListController.getRecentAccounts(500).size(),
            'size above the maximum'
        );
    }

    @IsTest
    static void newestFirst() {
        List<Account> result = AccountListController.getRecentAccounts(AccountListController.MAX_SIZE);
        for (Integer i = 1; i < result.size(); i++) {
            Assert.isTrue(result[i - 1].LastModifiedDate >= result[i].LastModifiedDate, 'sorted newest first at ' + i);
        }
    }

    @IsTest
    static void noAccessBecomesAPlainSentence() {
        AccountListController.selector = new DeniedSelector();
        try {
            AccountListController.getRecentAccounts(5);
            Assert.fail('expected an AuraHandledException');
        } catch (AuraHandledException e) {
            Assert.isTrue(e.getMessage().startsWith('You do not have access to accounts.'), e.getMessage());
        }
    }

    @IsTest
    static void anyOtherFailureBecomesAPlainSentence() {
        AccountListController.selector = new BrokenSelector();
        try {
            AccountListController.getRecentAccounts(5);
            Assert.fail('expected an AuraHandledException');
        } catch (AuraHandledException e) {
            Assert.isTrue(e.getMessage().startsWith('Accounts didn\'t load.'), e.getMessage());
        }
    }
}
