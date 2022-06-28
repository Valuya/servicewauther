import {ServiceWautherConfig} from './serviceWautherConfig';

let serviceWautherConfig: ServiceWautherConfig = {
    debug: false,
    redirectUriRegexps: [/^\/myapp\/silent-refresh.html/],
    resourceUrlIncludeRegexps: [/^\/myapp\/api\//],
    resourceUrlExcludeRegexps: [/^\/myapp\/api\//],
    oidcSettings: {
        server: 'https://auth.mycompany.com',
        clientId: 'myclientid'
    },
    redirectUrl: 'https://myapp.mycompany.com/start'
};
