import { LightningElement, wire } from 'lwc';
import { refreshApex } from '@salesforce/apex';
import getRecentAccounts from '@salesforce/apex/AccountListController.getRecentAccounts';

export const SIZE = 10;
const FALLBACK_ERROR = "Accounts didn't load. Check your connection, then try again.";

/**
 * States: loading (nothing back yet), failed (an error and no list), empty, loaded, and
 * stale (a refresh failed, so the last good list stays on screen with a note).
 */
export default class AccountList extends LightningElement {
    accounts; // the last list that loaded
    error;
    refreshing = false;
    wiredResult; // kept for refreshApex

    @wire(getRecentAccounts, { size: SIZE })
    receive(result) {
        this.wiredResult = result;
        if (result.data) {
            this.accounts = result.data;
            this.error = undefined;
        } else if (result.error) {
            this.error = result.error;
        }
    }

    get isLoading() {
        return this.accounts === undefined && this.error === undefined;
    }
    get isFailed() {
        return this.accounts === undefined && this.error !== undefined;
    }
    get isEmpty() {
        return this.accounts !== undefined && this.accounts.length === 0;
    }
    get isStale() {
        return this.accounts !== undefined && this.error !== undefined;
    }

    get errorText() {
        // The Apex boundary turns every failure into a sentence for the user (AuraHandledException).
        // An error with no message (offline, a timeout) gets the fallback.
        const message = this.error?.body?.message;
        return typeof message === 'string' && message.length > 0 ? message : FALLBACK_ERROR;
    }

    get rows() {
        return (this.accounts ?? []).map((account) => ({
            id: account.Id,
            name: account.Name,
            url: `/lightning/r/Account/${account.Id}/view`,
            industry: account.Industry ?? 'Industry not set',
            industryClass: account.Industry ? 'meta' : 'meta unknown'
        }));
    }

    async handleRefresh() {
        this.refreshing = true;
        try {
            await refreshApex(this.wiredResult);
        } catch (error) {
            this.error = error;
        } finally {
            this.refreshing = false;
        }
    }
}
