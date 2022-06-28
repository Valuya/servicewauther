/// <reference lib="webworker" />

import {OidcClient, SigninResponse} from 'oidc-client-ts';
import {ServiceWautherConfig} from './serviceWautherConfig';

const sw = self as unknown as ServiceWorkerGlobalScope

// defaults
declare var serviceWautherConfig: ServiceWautherConfig;
importScripts('swconfig.js');

let oidcClientPromise = initOidcClient();
let signinResponse: SigninResponse;

const handleInstall = async () => {
    console.log('service worker installed');

    await sw.skipWaiting();
};

const handleActivate = () => {
    debugLog('service worker activated');

    return sw.clients.claim();
};

const handleFetch = async (event: FetchEvent) => {
    const request: Request = event.request;
    const url = new URL(request.url);

    debugLog("fetch ", url.pathname);

    if (await isTokenUrl(url)) {
        debugLog('Token request ', url);
        fetchToken(request, event);
    } else {
        if (isRedirectUrl(url)) {
            debugLog('AUTHORIZATION CODE: ', url.searchParams.get('code'));
            signinResponse = await (await oidcClientPromise).processSigninResponse(request.url);
        }
        if (isResourceUrl(url)) {
            debugLog("Intercepted request*** ", url);
            if (signinResponse) {
                debugLog('Adding token to request')
                fetchWithBearer(event);
            } else {
                debugLog("no token holder :-(")
            }
        }
    }

}
const fetchToken = (request: Request, event: any) => {
    const modifiedHeaders = new Headers(request.headers);
    const modifiedRequestInit: RequestInit = {headers: modifiedHeaders};
    const modifiedRequest: RequestInfo = new Request(request, modifiedRequestInit);

    event.respondWith((async () =>
        fetch(modifiedRequest))()
        .then(response => generateTokenResponse(response)
        ));
};

const generateTokenResponse = async (response: Response) => {
    const clonedResponse = response.clone();
    const content = await response.json();
    content['access_token'] = '<HIDDEN-BY-SERVICE-WORKER>';
    content['refresh_token'] = '<HIDDEN-BY-SERVICE-WORKER>';
    // const refreshToken: string = json['refresh_token'];
    debugLog(content);

    // return clonedResponse;
    const modifiedContentJson = JSON.stringify(content);
    return new Response(modifiedContentJson, {headers: new Headers(clonedResponse.headers)});
};
const fetchWithBearer = (event: any) => {
    const request: Request = event.request;
    const modifiedHeaders = new Headers(request.headers);
    const accessToken = signinResponse.access_token;
    modifiedHeaders.set('Authorization', 'Bearer ' + accessToken);

    const modifiedRequestInit: RequestInit = {headers: modifiedHeaders};
    const modifiedRequest: RequestInfo = new Request(request, modifiedRequestInit);

    event.respondWith((async () => fetch(modifiedRequest))());
}

function isResourceUrl(url: URL) {
    return serviceWautherConfig.resourceUrlIncludeRegexps.some(urlRegexp => urlRegexp.exec(url.pathname))
        && !serviceWautherConfig.resourceUrlExcludeRegexps.some(urlRegexp => urlRegexp.exec(url.pathname))
}

async function isTokenUrl(url: URL) {
    let metadata = await (await oidcClientPromise).metadataService.getMetadata();
    return url.pathname === metadata.token_endpoint;
}

function isRedirectUrl(url: URL) {
    return serviceWautherConfig.redirectUriRegexps.some(urlRegexp => urlRegexp.exec(url.pathname))
        && url.searchParams.has('code');
}

function initOidcClient(): Promise<OidcClient> {
    let oidcClient = new OidcClient(serviceWautherConfig.settings);
    let signinRequestParams = {};
    let signinRequestPromise = oidcClient.createSigninRequest(signinRequestParams);
    let signoutRequestParams = {};
    let signoutRequestPromise = oidcClient.createSignoutRequest(signoutRequestParams);
    return Promise.all([signinRequestPromise, signoutRequestPromise])
        .then(([signinRequest, signoutRequest]) => dispatchAuthReady(signinRequest.url, signoutRequest.url))
        .then(_ => oidcClient);
}

async function dispatchAuthReady(signinUrl: string, signoutUrl: string) {
    let clients = await sw.clients.matchAll();
    for (const client of clients) {
        client.postMessage({
            type: 'AUTH_READY',
            signinUrl: signinUrl,
            signoutUrl: signoutUrl
        });
    }
}

function debugLog(message?: any, ...optionalParams: any[]): void {
    if (serviceWautherConfig.debug) {
        console.warn("***** ", message, optionalParams);
    }
}

sw.addEventListener('install', handleInstall);
sw.addEventListener('activate', handleActivate);
sw.addEventListener('fetch', handleFetch);
sw.addEventListener('message', (event) => {
    debugLog('SW got a message: ', event, new Date().toISOString());
});

