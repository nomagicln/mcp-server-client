// Abstract base class for resource loaders
export default class ResourceLoader {
  constructor() {
    if (new.target === ResourceLoader) {
      throw new Error(
        'ResourceLoader is abstract and cannot be instantiated directly',
      );
    }
  }

  // Load resources from the configured source
  // eslint-disable-next-line class-methods-use-this
  async loadResources(/* options */) {
    throw new Error('Not implemented: loadResources');
  }

  // Validate a resource object
  // eslint-disable-next-line class-methods-use-this
  validateResource(/* resource */) {
    throw new Error('Not implemented: validateResource');
  }

  // Return a list of capabilities supported by this loader
  // eslint-disable-next-line class-methods-use-this
  getCapabilities() {
    throw new Error('Not implemented: getCapabilities');
  }
}
