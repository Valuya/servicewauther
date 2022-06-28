export interface FrontendOidcEndpointConfig {
    authorizeUrl: string;
    silentRefreshAuthorizeUrl: string;
    logoutUrl?: string;
}