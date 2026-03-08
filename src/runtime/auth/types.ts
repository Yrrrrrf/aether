export interface AuthProvider {
  /**
   * Returns the current access token, or null if unauthenticated.
   * Called automatically by Aether before every request.
   */
  getAccessToken(): string | null | Promise<string | null>;

  /**
   * Optional. If provided, Aether will call this when a request fails with 401 Unauthorized.
   * Once this promise resolves, Aether will retry the failed request once.
   */
  onTokenRefresh?: (
    newTokenCallback: (token: string | null) => void,
  ) => Promise<void> | void;
}
