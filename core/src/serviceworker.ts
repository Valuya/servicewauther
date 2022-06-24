const sw = self as ServiceWorkerGlobalScope & typeof globalThis

// defaults
let debug = false;
let redirectUriRegexps = [/^\/myapp\/silent-refresh.html/];
let resourceUrlIncludeRegexps = [/^\/myapp\/api\//];
let resourceUrlExcludeRegexps = [/^\/myapp\/api\/config\//];
let tokenUrl = '/token';

const handleInstall = async () => {
    console.log('service worker installed');

    await sw.skipWaiting();
};

const handleActivate = () => {
    debugLog('service worker activated');

    return sw.clients.claim();
};

let accessToken: string;


const handleFetch = (event: FetchEvent) => {
    const request: Request = event.request;
    const url = new URL(request.url);

    debugLog("fetch ", url.pathname);

    if (isTokenUrl(url)) {
        fetchToken(request, event);
    } else {
        if (isRedirectUrl(url)) {
            console.log('AUTHORIZATION CODE: ', url.searchParams.get('code'));
        }
        if (isResourceUrl(url)) {
            debugLog("Intercepted request*** ", url);
            if (accessToken) {
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
    accessToken = content['access_token'];
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
    modifiedHeaders.set('Authorization', 'Bearer ' + accessToken);

    const modifiedRequestInit: RequestInit = {headers: modifiedHeaders};
    const modifiedRequest: RequestInfo = new Request(request, modifiedRequestInit);

    event.respondWith((async () => fetch(modifiedRequest))());
}

function isResourceUrl(url: URL) {
    return resourceUrlIncludeRegexps.some(urlRegexp => urlRegexp.exec(url.pathname))
        && !resourceUrlExcludeRegexps.some(urlRegexp => urlRegexp.exec(url.pathname))
}

function isTokenUrl(url: URL) {
    return url.pathname.endsWith(tokenUrl);
}

function isRedirectUrl(url: URL) {
    return redirectUriRegexps.some(urlRegexp => urlRegexp.exec(url.pathname))
        && url.searchParams.has('code');
}

function debugLog(message?: any, ...optionalParams: any[]): void {
    if (debug) {
        console.warn("***** ", message, optionalParams);
    }
}

sw.addEventListener('install', handleInstall);
sw.addEventListener('activate', handleActivate);
sw.addEventListener('fetch', handleFetch);
sw.addEventListener('message', (event) => {
    debugLog('SW got a message: ', event, accessToken, new Date().toISOString());
});

importScripts('swconfig.js');
