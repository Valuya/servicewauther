/// <reference no-default-lib="true"/>
/// <reference lib="dom" />
/// <reference lib="es2020" />

const KEEPALIVE_INTERVAL_MS = 10000;

export const registerServiceWorker = async () => {
    if ('serviceWorker' in navigator) {
        try {
            const registration = await navigator.serviceWorker.register('/serviceworker.js');
            setupOidc();
            navigator.serviceWorker.ready.then(() => {
                setupKeepalive();
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

let signinUrl;
let signoutUrl;

function setupOidc() {
    navigator.serviceWorker.addEventListener('message', event => {
        if (event.type === 'AUTH_READY') {
            signinUrl = event.data.signinUrl;
            signoutUrl = event.data.signoutUrl;
            console.log('signinUrl = ', signinUrl);
        }
    })
}
