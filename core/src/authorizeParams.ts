export interface AuthorizeParams {
    codeVerifier: string;
    authorizeUrl: string;
    silentRefreshAuthorizeUrl: string;
}