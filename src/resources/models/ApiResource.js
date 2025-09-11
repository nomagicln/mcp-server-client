import Resource from './Resource.js';

export default class ApiResource extends Resource {
  constructor(props = {}) {
    super({ ...props, type: 'api' });
  }
}
