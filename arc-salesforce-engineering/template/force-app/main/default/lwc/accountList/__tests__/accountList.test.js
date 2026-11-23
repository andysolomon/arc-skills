import { createElement } from 'lwc';
import AccountList from 'c/accountList';
import getRecentAccounts from '@salesforce/apex/AccountListController.getRecentAccounts';
import { refreshApex } from '@salesforce/apex';

jest.mock(
    '@salesforce/apex/AccountListController.getRecentAccounts',
    () => {
        const { createApexTestWireAdapter } = require('@salesforce/sfdx-lwc-jest');
        return { default: createApexTestWireAdapter(jest.fn()) };
    },
    { virtual: true }
);
jest.mock('@salesforce/apex', () => ({ refreshApex: jest.fn(() => Promise.resolve()) }), { virtual: true });

const ACCOUNTS = [
    { Id: '001000000000001AAA', Name: 'Acme', Industry: 'Energy' },
    { Id: '001000000000002AAA', Name: 'Globex', Industry: null }
];

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const mount = () => {
    const element = createElement('c-account-list', { is: AccountList });
    document.body.appendChild(element);
    return element;
};
const $ = (element, selector) => element.shadowRoot.querySelector(selector);
const $$ = (element, selector) => [...element.shadowRoot.querySelectorAll(selector)];
const button = (element, label) => $$(element, 'lightning-button').find((b) => b.label === label);

afterEach(() => {
    document.body.replaceChildren();
    jest.clearAllMocks();
});

describe('c-account-list', () => {
    it('asks for ten accounts and shows loading until they arrive', () => {
        const element = mount();
        expect(getRecentAccounts.getLastConfig()).toEqual({ size: 10 });
        expect($(element, '[role="status"]').textContent).toBe('Loading accounts…');
        expect($$(element, 'li')).toHaveLength(0);
    });

    it('lists each account, linking to its record', async () => {
        const element = mount();
        getRecentAccounts.emit(ACCOUNTS);
        await flush();
        const links = $$(element, 'a.name');
        expect(links.map((a) => a.textContent)).toEqual(['Acme', 'Globex']);
        expect(links[0].getAttribute('href')).toBe('/lightning/r/Account/001000000000001AAA/view');
    });

    it('writes a missing industry as unknown, never invents one', async () => {
        const element = mount();
        getRecentAccounts.emit(ACCOUNTS);
        await flush();
        expect($$(element, '.meta').map((s) => s.textContent)).toEqual(['Energy', 'Industry not set']);
    });

    it('says how to add the first account when there are none', async () => {
        const element = mount();
        getRecentAccounts.emit([]);
        await flush();
        expect($(element, '.note').textContent).toContain('Create one from the Accounts tab');
    });

    it("shows the server's sentence on failure, with a Try again that asks again", async () => {
        const element = mount();
        getRecentAccounts.error({ message: 'You do not have access to accounts.' });
        await flush();
        expect($(element, '[role="alert"]').textContent).toBe('You do not have access to accounts.');
        button(element, 'Try again').click();
        expect(refreshApex).toHaveBeenCalledTimes(1);
    });

    it('falls back to a plain sentence when the error carries none (offline, timeout)', async () => {
        const element = mount();
        getRecentAccounts.error({});
        await flush();
        expect($(element, '[role="alert"]').textContent).toBe("Accounts didn't load. Check your connection, then try again.");
    });

    it('keeps the last good list on screen when a refresh fails', async () => {
        const element = mount();
        getRecentAccounts.emit(ACCOUNTS);
        await flush();
        getRecentAccounts.error();
        await flush();
        expect($$(element, 'li')).toHaveLength(2);
        expect($(element, '.warn').textContent).toBe("Couldn't refresh. This is the last list that loaded.");
    });

    it('disables Refresh while a refresh is in flight', async () => {
        let finish;
        refreshApex.mockImplementationOnce(() => new Promise((resolve) => (finish = resolve)));
        const element = mount();
        getRecentAccounts.emit(ACCOUNTS);
        await flush();
        button(element, 'Refresh').click();
        await flush();
        expect(button(element, 'Refresh').disabled).toBe(true);
        finish();
        await flush();
        expect(button(element, 'Refresh').disabled).toBe(false);
    });
});
