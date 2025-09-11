// Base Resource model
export default class Resource {
  constructor(props = {}) {
    this.id = props.id;
    this.type = props.type;
    this.name = props.name;
    this.description = props.description;
    this.labels = props.labels || {};
    this.capabilities = props.capabilities || [];
    this.auth = props.auth || {};
    this.metadata = props.metadata || {};
  }
}
