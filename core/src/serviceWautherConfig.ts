/// <reference no-default-lib="true"/>
/// <reference lib="es2020" />

import {ClientSettings} from '@badgateway/oauth2-client/dist/client';

export interface ServiceWautherConfig {
    debug: boolean;
    redirectUriRegexps: RegExp[];
    resourceUrlIncludeRegexps: RegExp[];
    resourceUrlExcludeRegexps: RegExp[];
    oidcSettings: ClientSettings;
    redirectUri: string,
    silentRefreshRedirectUri?: string;
}