interface CredentialResponse {
  credential: string;
  select_by: string;
  clientId?: string;
}

interface GsiButtonConfig {
  type?: 'standard' | 'icon';
  theme?: 'outline' | 'filled_blue' | 'filled_black';
  size?: 'large' | 'medium' | 'small';
  text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
  width?: number;
}

declare namespace google.accounts.id {
  function initialize(config: {
    client_id: string;
    callback: (response: CredentialResponse) => void;
    auto_select?: boolean;
    itp_support?: boolean;
  }): void;
  function prompt(callback?: (notification: { isNotDisplayed: () => boolean; isSkippedMoment: () => boolean }) => void): void;
  function renderButton(parent: HTMLElement, config: GsiButtonConfig): void;
  function revoke(hint: string, callback?: (response: { successful: boolean; error?: string }) => void): void;
  function disableAutoSelect(): void;
}
