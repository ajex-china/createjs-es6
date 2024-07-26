import AbstractLoader from "@/utils/preloadJS/loaders/AbstractLoader.js";
import Types from "@/utils/base/Types.js";
import JSONLoader from "@/utils/preloadJS/loaders/JSONLoader.js";
import JSONPLoader from "@/utils/preloadJS/loaders/JSONPLoader.js";
import LoadQueue from "@/utils/preloadJS/LoadQueue.js";
import {SpriteSheet} from "@createjs/easeljs";
import {Event} from "@createjs/core";

export default class SpriteSheetLoader extends AbstractLoader {
  constructor(loadItem, preferXHR) {
    super(loadItem, preferXHR, Types.SPRITESHEET);
    /**
     * An internal queue which loads the SpriteSheet's images.
     * @method _manifestQueue
     * @type {LoadQueue}
     * @private
     */
    this._manifestQueue = null;
  }
  /**
   * The amount of progress that the manifest itself takes up.
   * @property SPRITESHEET_PROGRESS
   * @type {number}
   * @default 0.25 (25%)
   * @private
   * @static
   */
  static SPRITESHEET_PROGRESS = 0.25;

  // static methods
  /**
   * Determines if the loader can load a specific item. This loader can only load items that are of type
   * {{#crossLink "Types/SPRITESHEET:property"}}{{/crossLink}}
   * @method canLoadItem
   * @param {LoadItem|Object} item The LoadItem that a LoadQueue is trying to load.
   * @returns {Boolean} Whether the loader can load the item.
   * @static
   */
  static canLoadItem = function (item) {
    return item.type == Types.SPRITESHEET;
  };

  destroy = function() {
    super.destroy();
    this._manifestQueue.close();
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
        this._sendProgress(SpriteSheetLoader.SPRITESHEET_PROGRESS);
        this._loadManifest(this._result);
        return;
      case "progress":
        event.loaded *= SpriteSheetLoader.SPRITESHEET_PROGRESS;
        this.progress = event.loaded / event.total;
        if (isNaN(this.progress) || this.progress == Infinity) { this.progress = 0; }
        this._sendProgress(event);
        return;
    }
    super.handleEvent(event);
  };

  /**
   * Create and load the images once the SpriteSheet JSON has been loaded.
   * @method _loadManifest
   * @param {Object} json
   * @private
   */
  _loadManifest = function (json) {
    if (json && json.images) {
      let queue = this._manifestQueue = new LoadQueue(this._preferXHR, this._item.path, this._item.crossOrigin);
      queue.on("complete", this._handleManifestComplete, this, true);
      queue.on("fileload", this._handleManifestFileLoad, this);
      queue.on("progress", this._handleManifestProgress, this);
      queue.on("error", this._handleManifestError, this, true);
      queue.loadManifest(json.images);
    }
  };

  /**
   * An item from the {{#crossLink "_manifestQueue:property"}}{{/crossLink}} has completed.
   * @method _handleManifestFileLoad
   * @param {Event} event
   * @private
   */
  _handleManifestFileLoad = function (event) {
    let image = event.result;
    if (image != null) {
      let images = this.getResult().images;
      let pos = images.indexOf(event.item.src);
      images[pos] = image;
    }
  };

  /**
   * The images have completed loading. This triggers the {{#crossLink "AbstractLoader/complete:event"}}{{/crossLink}}
   * {{#crossLink "Event"}}{{/crossLink}} from the SpriteSheetLoader.
   * @method _handleManifestComplete
   * @param {Event} event
   * @private
   */
  _handleManifestComplete = function (event) {
    this._result = new SpriteSheet(this._result);
    this._loadedItems = this._manifestQueue.getItems(true);
    this._sendComplete();
  };

  /**
   * The images {{#crossLink "LoadQueue"}}{{/crossLink}} has reported progress.
   * @method _handleManifestProgress
   * @param {ProgressEvent} event
   * @private
   */
  _handleManifestProgress = function (event) {
    this.progress = event.progress * (1 - SpriteSheetLoader.SPRITESHEET_PROGRESS) + SpriteSheetLoader.SPRITESHEET_PROGRESS;
    this._sendProgress(this.progress);
  };

  /**
   * An image has reported an error.
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