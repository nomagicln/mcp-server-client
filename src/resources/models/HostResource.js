import Resource from './Resource.js';

export default class HostResource extends Resource {
  constructor(props = {}) {
    super({ ...props, type: 'host' });
  }
}
