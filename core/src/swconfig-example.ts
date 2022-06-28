import {ServiceWautherConfig} from './serviceWautherConfig';

let serviceWautherConfig: ServiceWautherConfig = {
    debug: false,
    redirectUriRegexps: [/^\/myapp\/silent-refresh.html/],
    resourceUrlIncludeRegexps: [/^\/myapp\/api\//],
    resourceUrlExcludeRegexps: [/^\/myapp\/api\//],
    settings: {
        authority: 'https://auth.mycompany.com',
        client_id: 'myclientid',
        redirect_uri: 'https://myapp.mycompany.com/start'
    }
};
