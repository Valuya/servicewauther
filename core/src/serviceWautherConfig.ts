/// <reference no-default-lib="true"/>
/// <reference lib="es2020" />

export interface ServiceWautherConfig {
    debug: boolean;
    redirectUriRegexps: RegExp[];
    resourceUrlIncludeRegexps: RegExp[];
    resourceUrlExcludeRegexps: RegExp[];
    issuerUrl: string;
    clientId: string;
    redirectUrl: string,
    silentRefreshRedirectUrl?: string;
}