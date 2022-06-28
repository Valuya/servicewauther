/// <reference lib="dom" />

import {FrontendOidcEndpointConfig} from './frontendOidcEndpointConfig';

const KEEPALIVE_INTERVAL_MS = 10000;

export const registerServiceWorker = async () => {
    if ('serviceWorker' in navigator) {
        try {
            const registration = await navigator.serviceWorker.register('/serviceworker.js');
            navigator.serviceWorker.ready.then(() => {
                setupKeepalive();
                setupFrontendOidcEndpoints();
            });
            return registration;
        } catch (error) {
            console.error(`Registration failed with ${error}`);
        }
    }
};

const setupKeepalive = () => {
    console.log('Service worker ready');
    setInterval(() => sendKeepalive(), KEEPALIVE_INTERVAL_MS);
};

const sendKeepalive = () => {
    if (!navigator.serviceWorker.controller) {
        return;
    }
    navigator.serviceWorker.controller.postMessage({
        type: 'SW_KEEPALIVE'
    });
};

async function setupFrontendOidcEndpoints() {
    getFrontendOidcEndpointConfig$().then(frontendOidcEndpointConfig => {
        console.log('authorizeUrl = ', frontendOidcEndpointConfig.authorizeUrl);
        console.log('silentRefreshAuthorizeUrl = ', frontendOidcEndpointConfig.silentRefreshAuthorizeUrl);
    });
}

const getFrontendOidcEndpointConfig$ = (): Promise<FrontendOidcEndpointConfig> => {
    return fetch("/oidc-setup")
        .then(response => response.json());
};
