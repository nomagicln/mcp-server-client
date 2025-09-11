export default class ResourceIdentifier {
  static parse(uri) {
    const match = uri.match(/^([^:]+):\/\/([^/]+)\/([^/]+)\/(.+)$/);
    if (!match) {
      throw new Error(`Invalid resource identifier: ${uri}`);
    }
    return {
      resourceType: match[1],
      loaderType: match[2],
      loaderId: match[3],
      resourceId: match[4],
    };
  }

  static toString(parts) {
    return `${parts.resourceType}://${parts.loaderType}/${parts.loaderId}/${parts.resourceId}`;
  }
}
