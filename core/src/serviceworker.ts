/// <reference lib="webworker" />

import {ServiceWautherConfig} from './serviceWautherConfig';
import {AuthorizeParams} from './authorizeParams';
import {FrontendOidcEndpointConfig} from './frontendOidcEndpointConfig';
import * as oauth from '@panva/oauth4webapi'
import {AuthorizationServer} from '@panva/oauth4webapi';

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

    let oidcTooling = await oidcToolingPromise;
    if (url.pathname === '/oidc-setup') {
        debugLog('OIDC setup request ', url);
        let frontendOidcEndpointConfig = await getFrontendOidcEndpointConfig();
        let oidcSetupResponse = new Response(JSON.stringify(frontendOidcEndpointConfig), {headers: {"Content-type": "application/json"}});
        event.respondWith(oidcSetupResponse);
    } else if (await isTokenUrl(url)) {
        debugLog('Token request ', url);
        fetchToken(request, event);
    } else if (isRedirectUrl(url)) {
        debugLog('AUTHORIZATION CODE: ', url.searchParams.get('code'));
        // (await authorizeParamsPromise)
        let client = {client_id: serviceWautherConfig.clientId};
        const params = oauth.validateAuthResponse(oidcTooling.authorizationServer, client, url, oauth.expectNoState)
        if (oauth.isOAuth2Error(params)) {
            console.log('error', params)
            throw new Error() // Handle OAuth 2.0 redirect error
        }

        let urlWithoutParams = getUrlWithoutParams(request.url);
        const response = await oauth.authorizationCodeGrantRequest(
            oidcTooling.authorizationServer,
            client,
            params,
            urlWithoutParams,
            oidcTooling.authorizeParams.codeVerifier,
        )

        let challenges: oauth.WWWAuthenticateChallenge[] | undefined
        if ((challenges = oauth.parseWwwAuthenticateChallenges(response))) {
            for (const challenge of challenges) {
                console.log('challenge', challenge)
            }
            throw new Error() // Handle www-authenticate challenges as needed
        }

        const result = await oauth.processAuthorizationCodeOpenIDResponse(oidcTooling.authorizationServer, client, response)
        if (oauth.isOAuth2Error(result)) {
            console.log('error', result)
            throw new Error() // Handle OAuth 2.0 response body error
        }
    } else if (isResourceUrl(url)) {
        debugLog("Intercepted request*** ", url);
        if (oidcTooling.accessToken) {
            debugLog('Adding token to request')
            await fetchWithBearer(event);
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
const fetchWithBearer = async (event: any) => {
    const request: Request = event.request;
    const modifiedHeaders = new Headers(request.headers);
    const accessToken = (await oidcToolingPromise).accessToken;
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
    return url.pathname === (await oidcToolingPromise).authorizationServer.token_endpoint;
};

const isRedirectUrl = (url: URL) => {
    return serviceWautherConfig.redirectUriRegexps.some(urlRegexp => urlRegexp.exec(url.pathname))
        && url.searchParams.has('code');
};

const initAuthorizationServer = async (): Promise<AuthorizationServer> => {
    const issuerUrl = new URL(serviceWautherConfig.issuerUrl);
    return oauth.discoveryRequest(issuerUrl)
        .then(response => oauth.processDiscoveryResponse(issuerUrl, response));
}

const initAuthorizeParams = async (): Promise<AuthorizeParams> => {
    const codeVerifier = oauth.generateRandomCodeVerifier()

    let authorizeUrl = await getAuthorizeUrl(codeVerifier, serviceWautherConfig.redirectUrl);
    let silentRefreshAuthorizeUrl = await getAuthorizeUrl(codeVerifier, serviceWautherConfig.silentRefreshRedirectUrl);

    return ({
            codeVerifier: codeVerifier,
            authorizeUrl: authorizeUrl,
            silentRefreshAuthorizeUrl: silentRefreshAuthorizeUrl
        }
    );
};

const getAuthorizeUrl = async (codeVerifier: string, redirectUrl: string): Promise<string> => {
    const codeChallenge = await oauth.calculatePKCECodeChallenge(codeVerifier)
    let oidcTooling = await oidcToolingPromise;

    const authorizationUrl = new URL(oidcTooling.authorizationServer.authorization_endpoint);
    authorizationUrl.searchParams.set('client_id', serviceWautherConfig.clientId);
    authorizationUrl.searchParams.set('code_challenge', codeChallenge);
    authorizationUrl.searchParams.set('code_challenge_method', 'S256');
    authorizationUrl.searchParams.set('redirect_uri', redirectUrl);
    authorizationUrl.searchParams.set('response_type', 'code');
    authorizationUrl.searchParams.set('scope', 'openid email');

    return authorizationUrl.toString();
};

const getFrontendOidcEndpointConfig = async (): Promise<FrontendOidcEndpointConfig> => {
    let oidcTooling = await oidcToolingPromise;
    return {
        authorizeUrl: oidcTooling.authorizeParams.authorizeUrl,
        silentRefreshAuthorizeUrl: oidcTooling.authorizeParams.silentRefreshAuthorizeUrl
    }
};

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

interface OidcTooling {
    accessToken?: string;
    authorizationServer: AuthorizationServer;
    authorizeParams: AuthorizeParams;
}

async function init(): Promise<OidcTooling> {
    return {
        authorizationServer: await initAuthorizationServer(),
        authorizeParams: await initAuthorizeParams()
    }
}
let oidcToolingPromise = init();

sw.addEventListener('install', handleInstall);
sw.addEventListener('activate', handleActivate);
sw.addEventListener('fetch', handleFetch);

sw.addEventListener('message', (event) => {
    debugLog('SW got a message: ', event, new Date().toISOString());
});
