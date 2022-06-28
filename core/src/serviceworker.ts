/// <reference lib="webworker" />

import {ServiceWautherConfig} from './serviceWautherConfig';
import {OAuth2Client, OAuth2Token} from '@badgateway/oauth2-client';
import {AuthorizeParams} from './authorizeParams';
import {FrontendOidcEndpointConfig} from './frontendOidcEndpointConfig';

const sw = self as unknown as ServiceWorkerGlobalScope

// defaults
declare var serviceWautherConfig: ServiceWautherConfig;
importScripts('swconfig.js');

const handleInstall = async () => {
    console.log('ServiceWauther installed');

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

    if (url.pathname === '/oidc-setup') {
        debugLog('OIDC setup request ', url);
        let frontendOidcEndpointConfig = getFrontendOidcEndpointConfig(await authorizeParamsPromise);
        let oidcSetupResponse = new Response(JSON.stringify(frontendOidcEndpointConfig), {headers: {"Content-type": "application/json"}});
        event.respondWith(oidcSetupResponse);
    } else if (await isTokenUrl(url)) {
        debugLog('Token request ', url);
        fetchToken(request, event);
    } else if (isRedirectUrl(url)) {
        debugLog('AUTHORIZATION CODE: ', url.searchParams.get('code'));
        // (await authorizeParamsPromise)
        oAuth2Token = await oidcClient.authorizationCode.getTokenFromCodeRedirect(request.url, {
            codeVerifier: (await authorizeParamsPromise).codeVerifier,
            redirectUri: getUrlWithoutParams(request.url)
        });
    } else if (isResourceUrl(url)) {
        debugLog("Intercepted request*** ", url);
        if (oAuth2Token) {
            debugLog('Adding token to request')
            fetchWithBearer(event);
        } else {
            debugLog("no token holder :-(")
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
    const accessToken = oAuth2Token.accessToken;
    modifiedHeaders.set('Authorization', 'Bearer ' + accessToken);

    const modifiedRequestInit: RequestInit = {headers: modifiedHeaders};
    const modifiedRequest: RequestInfo = new Request(request, modifiedRequestInit);

    event.respondWith((async () => fetch(modifiedRequest))());
}

const isResourceUrl = (url: URL) => {
    return serviceWautherConfig.resourceUrlIncludeRegexps.some(urlRegexp => urlRegexp.exec(url.pathname))
        && !serviceWautherConfig.resourceUrlExcludeRegexps.some(urlRegexp => urlRegexp.exec(url.pathname));
};

const isTokenUrl = async (url: URL) => {
    return url.pathname === await oidcClient.getEndpoint('tokenEndpoint');
};

const isRedirectUrl = (url: URL) => {
    return serviceWautherConfig.redirectUriRegexps.some(urlRegexp => urlRegexp.exec(url.pathname))
        && url.searchParams.has('code');
};

const initOAuth2Client = () => {
    const clientSettings = Object.assign({}, serviceWautherConfig.oidcSettings);
    clientSettings.discoveryEndpoint = clientSettings.discoveryEndpoint || clientSettings.server + '/.well-known/openid-configuration';
    return new OAuth2Client(clientSettings);
};

const initAuthorizeParams = async (): Promise<AuthorizeParams> => {
    const codeVerifier = generateCodeVerifier();

    // let endSessionEndpointUrl = oidcClient.getEndpoint('end_session_endpoint');

    const authorizeParams = {
        redirectUri: serviceWautherConfig.redirectUri,
        codeVerifier: codeVerifier
    };
    const silentRefreshAuthorizeParams = {
        redirectUri: serviceWautherConfig.silentRefreshRedirectUri,
        codeVerifier: codeVerifier
    };
    const silentRefreshAuthorizeUriPromise = oidcClient.authorizationCode.getAuthorizeUri(silentRefreshAuthorizeParams);
    const authorizeUriPromise = oidcClient.authorizationCode.getAuthorizeUri(authorizeParams);
    const [silentRefreshAuthorizeUri, authorizeUri] = await Promise.all([silentRefreshAuthorizeUriPromise, authorizeUriPromise]);

    return ({
            codeVerifier: codeVerifier,
            authorizeUri: authorizeUri,
            silentRefreshAuthorizeUri: silentRefreshAuthorizeUri
        }
    );
};

const getFrontendOidcEndpointConfig = (authorizeParams: AuthorizeParams): FrontendOidcEndpointConfig => ({
    authorizeUrl: authorizeParams.authorizeUri,
    silentRefreshAuthorizeUrl: authorizeParams.silentRefreshAuthorizeUri
});

function generateCodeVerifier() {
    const emptyCodeVerifierArray = new Uint8Array(32);
    const codeVerifierArray = crypto.getRandomValues(emptyCodeVerifierArray);
    return btoa(String.fromCharCode(...codeVerifierArray));
}

function getUrlWithoutParams(url: string) {
    if (url.indexOf("?") < 0) {
        return url;
    }
    return url.substring(0, url.indexOf("?"));
}

function debugLog(message?: any, ...optionalParams: any[]): void {
    if (serviceWautherConfig.debug) {
        console.warn("***** ", message, optionalParams);
    }
}

let oidcClient = initOAuth2Client();
let authorizeParamsPromise = initAuthorizeParams();
let oAuth2Token: OAuth2Token;

sw.addEventListener('install', handleInstall);
sw.addEventListener('activate', handleActivate);
sw.addEventListener('fetch', handleFetch);

sw.addEventListener('message', (event) => {
    debugLog('SW got a message: ', event, new Date().toISOString());
});
