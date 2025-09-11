export default class CapabilityValidator {
  // Validate that a resource has the required capability
  // eslint-disable-next-line class-methods-use-this
  validateCapability(resource, capability) {
    const caps = (resource && resource.capabilities) || [];
    if (!caps.includes(capability)) {
      throw new Error(`Resource missing capability: ${capability}`);
    }
    return true;
  }
}
