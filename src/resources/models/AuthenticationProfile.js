export default class AuthenticationProfile {
  constructor(props = {}) {
    this.methods = props.methods || [];
    this.credentialRef = props.credentialRef;
    this.scopes = props.scopes || [];
  }
}
