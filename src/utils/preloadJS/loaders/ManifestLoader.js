import AbstractLoader from "@/utils/preloadJS/loaders/AbstractLoader.js";
import Types from "@/utils/base/Types.js";
import JSONLoader from "@/utils/preloadJS/loaders/JSONLoader.js";
import JSONPLoader from "@/utils/preloadJS/loaders/JSONPLoader.js";
import LoadQueue from "@/utils/preloadJS/LoadQueue.js";
import {Event} from "@createjs/core";

export default class ManifestLoader extends AbstractLoader {
  constructor(loadItem, preferXHR) {
    super(loadItem, preferXHR, Types.MANIFEST);
    // Public Properties
    /**
     * An array of the plugins registered using {{#crossLink "LoadQueue/installPlugin"}}{{/crossLink}},
     * used to pass plugins to new LoadQueues that may be created.
     * @property _plugins
     * @type {Array}
     * @private
     * @since 0.6.1
     */
    this.plugins = null;


    // Protected Properties
    /**
     * An internal {{#crossLink "LoadQueue"}}{{/crossLink}} that loads the contents of the manifest.
     * @property _manifestQueue
     * @type {LoadQueue}
     * @private
     */
    this._manifestQueue = null;
  }
  // static properties
  /**
   * The amount of progress that the manifest itself takes up.
   * @property MANIFEST_PROGRESS
   * @type {number}
   * @default 0.25 (25%)
   * @private
   * @static
   */
  static MANIFEST_PROGRESS = 0.25;

  // static methods
  /**
   * Determines if the loader can load a specific item. This loader can only load items that are of type
   * {{#crossLink "Types/MANIFEST:property"}}{{/crossLink}}
   * @method canLoadItem
   * @param {LoadItem|Object} item The LoadItem that a LoadQueue is trying to load.
   * @returns {Boolean} Whether the loader can load the item.
   * @static
   */
  static canLoadItem = function (item) {
    return item.type == Types.MANIFEST;
  };
// public methods
  load = function () {
    super.load();
  };

  // protected methods
  _createRequest = function() {
    let callback = this._item.callback;
    if (callback != null) {
      this._request = new JSONPLoader(this._item);
    } else {
      this._request = new JSONLoader(this._item);
    }
  };

  handleEvent = function (event) {
    switch (event.type) {
      case "complete":
        this._rawResult = event.target.getResult(true);
        this._result = event.target.getResult();
        this._sendProgress(ManifestLoader.MANIFEST_PROGRESS);
        this._loadManifest(this._result);
        return;
      case "progress":
        event.loaded *= ManifestLoader.MANIFEST_PROGRESS;
        this.progress = event.loaded / event.total;
        if (isNaN(this.progress) || this.progress == Infinity) { this.progress = 0; }
        this._sendProgress(event);
        return;
    }
    super.handleEvent(event);
  };

  destroy = function() {
    super.destroy();
    this._manifestQueue.close();
  };

  /**
   * Create and load the manifest items once the actual manifest has been loaded.
   * @method _loadManifest
   * @param {Object} json
   * @private
   */
  _loadManifest = function (json) {
    if (json && json.manifest) {
      let queue = this._manifestQueue = new LoadQueue(this._preferXHR);
      queue.on("fileload", this._handleManifestFileLoad, this);
      queue.on("progress", this._handleManifestProgress, this);
      queue.on("complete", this._handleManifestComplete, this, true);
      queue.on("error", this._handleManifestError, this, true);
      for(let i = 0, l = this.plugins.length; i < l; i++) {	// conserve order of plugins
        queue.installPlugin(this.plugins[i]);
      }
      queue.loadManifest(json);
    } else {
      this._sendComplete();
    }
  };

  /**
   * An item from the {{#crossLink "_manifestQueue:property"}}{{/crossLink}} has completed.
   * @method _handleManifestFileLoad
   * @param {Event} event
   * @private
   */
  _handleManifestFileLoad = function (event) {
    event.target = null;
    this.dispatchEvent(event);
  };

  /**
   * The manifest has completed loading. This triggers the {{#crossLink "AbstractLoader/complete:event"}}{{/crossLink}}
   * {{#crossLink "Event"}}{{/crossLink}} from the ManifestLoader.
   * @method _handleManifestComplete
   * @param {Event} event
   * @private
   */
  _handleManifestComplete = function (event) {
    this._loadedItems = this._manifestQueue.getItems(true);
    this._sendComplete();
  };

  /**
   * The manifest has reported progress.
   * @method _handleManifestProgress
   * @param {ProgressEvent} event
   * @private
   */
  _handleManifestProgress = function (event) {
    this.progress = event.progress * (1 - ManifestLoader.MANIFEST_PROGRESS) + ManifestLoader.MANIFEST_PROGRESS;
    this._sendProgress(this.progress);
  };

  /**
   * The manifest has reported an error with one of the files.
   * @method _handleManifestError
   * @param {ErrorEvent} event
   * @private
   */
  _handleManifestError = function (event) {
    let newEvent = new Event("fileerror");
    newEvent.item = event.data;
    this.dispatchEvent(newEvent);
  };
}