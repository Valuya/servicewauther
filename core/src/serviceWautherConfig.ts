/// <reference no-default-lib="true"/>
/// <reference lib="es2020" />

import {OidcClientSettings} from 'oidc-client-ts';

export interface ServiceWautherConfig {
    debug: boolean;
    redirectUriRegexps: RegExp[];
    resourceUrlIncludeRegexps: RegExp[];
    resourceUrlExcludeRegexps: RegExp[];
    settings: OidcClientSettings;
}