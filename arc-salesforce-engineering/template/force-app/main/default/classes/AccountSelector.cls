/**
 * Reads accounts as the running user: sharing rules, object access and field access all apply.
 * Virtual so a test can swap in a stub through AccountListController.selector.
 */
public with sharing virtual class AccountSelector {
    public virtual List<Account> recent(Integer size) {
        return [
            SELECT Id, Name, Industry, LastModifiedDate
            FROM Account
            WITH USER_MODE
            ORDER BY LastModifiedDate DESC, Id DESC
            LIMIT :size
        ];
    }
}
