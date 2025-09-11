import chokidar from 'chokidar';

export default class ResourceWatcher {
  constructor(options = {}) {
    this.paths = options.paths || [];
    this._watcher = null;
  }

  watchFiles(callback) {
    this._watcher = chokidar.watch(this.paths, { ignoreInitial: true });
    if (callback) {
      this._watcher.on('all', (event, filePath) =>
        callback({ event, filePath }),
      );
    }
    return this._watcher;
  }
}
