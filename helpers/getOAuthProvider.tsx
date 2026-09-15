import { OAuthProviderInterface, OAuthProviderType } from "./OAuthProvider";
import { FlootOAuthProvider } from "./FlootOAuthProvider";
import { GoogleOAuthProvider } from "./GoogleOAuthProvider";

export function getOAuthProvider(
  providerName: OAuthProviderType,
  redirectUri: string
): OAuthProviderInterface {
  switch (providerName) {
    case "floot":
      return new FlootOAuthProvider(redirectUri);
    case "google":
      return new GoogleOAuthProvider(redirectUri);
    default:
      throw new Error(`Unsupported OAuth provider: ${providerName}`);
  }
}
