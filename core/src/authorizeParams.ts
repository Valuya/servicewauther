export interface AuthorizeParams {
    codeVerifier: string;
    authorizeUri: string;
    silentRefreshAuthorizeUri: string;
}