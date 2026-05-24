interface PasswordCredentialInit {
  id: string;
  password: string;
  name?: string;
}

declare class PasswordCredential implements Credential {
  readonly id: string;
  readonly type: string;
  constructor(init: PasswordCredentialInit);
}

interface Window {
  PasswordCredential?: typeof PasswordCredential;
}
