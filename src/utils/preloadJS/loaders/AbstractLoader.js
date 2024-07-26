import {EventDispatcher,Event} from "@createjs/core";
import TagRequest from "@/utils/preloadJS/net/TagRequest.js";
import ErrorEvent from "@/utils/base/ErrorEvent.js";
import LoadItem from "@/utils/preloadJS/data/LoadItem.js";
import XHRRequest from "@/utils/preloadJS/net/XHRRequest.js";
import ProgressEvent from "@/utils/preloadJS/event/ProgressEvent.js";
import Base from "@/utils/base/Base.js";
export default class AbstractLoader extends EventDispatcher {
  constructor (loadItem, preferXHR, type) {
    super();
    this.loaded = false;

    /**
     * Determine if the loader was canceled. Canceled loads will not fire complete events. Note that this property
     * is readonly, so {{#crossLink "LoadQueue"}}{{/crossLink}} queues should be closed using {{#crossLink "LoadQueue/close"}}{{/crossLink}}
     * instead.
     * @property canceled
     * @type {Boolean}
     * @default false
     * @readonly
     */
    this.canceled = false;

    /**
     * The current load progress (percentage) for this item. This will be a number between 0 and 1.
     *
     * <h4>Example</h4>
     *
     *     var queue = new createjs.LoadQueue();
     *     queue.loadFile("largeImage.png");
     *     queue.on("progress", function() {
     *         console.log("Progress:", queue.progress, event.progress);
     *     });
     *
     * @property progress
     * @type {Number}
     * @default 0
     */
    this.progress = 0;

    /**
     * The type of item this loader will load. See {{#crossLink "AbstractLoader"}}{{/crossLink}} for a full list of
     * supported types.
     * @property type
     * @type {String}
     */
    this.type = type;

    /**
     * A formatter function that converts the loaded raw result into the final result. For example, the JSONLoader
     * converts a string of text into a JavaScript object. Not all loaders have a resultFormatter, and this property
     * can be overridden to provide custom formatting.
     *
     * Optionally, a resultFormatter can return a callback function in cases where the formatting needs to be
     * asynchronous, such as creating a new image. The callback function is passed 2 parameters, which are callbacks
     * to handle success and error conditions in the resultFormatter. Note that the resultFormatter method is
     * called in the current scope, as well as the success and error callbacks.
     *
     * <h4>Example asynchronous resultFormatter</h4>
     *
     * 	function _formatResult(loader) {
     * 		return function(success, error) {
     * 			if (errorCondition) { error(errorDetailEvent); }
     * 			success(result);
     * 		}
     * 	}
     * @property resultFormatter
     * @type {Function}
     * @default null
     */
    this.resultFormatter = null;

    // protected properties
    /**
     * The {{#crossLink "LoadItem"}}{{/crossLink}} this loader represents. Note that this is null in a {{#crossLink "LoadQueue"}}{{/crossLink}},
     * but will be available on loaders such as {{#crossLink "XMLLoader"}}{{/crossLink}} and {{#crossLink "ImageLoader"}}{{/crossLink}}.
     * @property _item
     * @type {LoadItem|Object}
     * @private
     */
    if (loadItem) {
      this._item = LoadItem.create(loadItem);
    } else {
      this._item = null;
    }

    /**
     * Whether the loader will try and load content using XHR (true) or HTML tags (false).
     * @property _preferXHR
     * @type {Boolean}
     * @private
     */
    this._preferXHR = preferXHR;

    /**
     * The loaded result after it is formatted by an optional {{#crossLink "resultFormatter"}}{{/crossLink}}. For
     * items that are not formatted, this will be the same as the {{#crossLink "_rawResult:property"}}{{/crossLink}}.
     * The result is accessed using the {{#crossLink "getResult"}}{{/crossLink}} method.
     * @property _result
     * @type {Object|String}
     * @private
     */
    this._result = null;

    /**
     * The loaded result before it is formatted. The rawResult is accessed using the {{#crossLink "getResult"}}{{/crossLink}}
     * method, and passing `true`.
     * @property _rawResult
     * @type {Object|String}
     * @private
     */
    this._rawResult = null;

    /**
     * A list of items that loaders load behind the scenes. This does not include the main item the loader is
     * responsible for loading. Examples of loaders that have sub-items include the {{#crossLink "SpriteSheetLoader"}}{{/crossLink}} and
     * {{#crossLink "ManifestLoader"}}{{/crossLink}}.
     * @property _loadItems
     * @type {null}
     * @protected
     */
    this._loadedItems = null;

    /**
     * The attribute the items loaded using tags use for the source.
     * @type {string}
     * @default null
     * @private
     */
    this._tagSrcAttribute = null;

    /**
     * An HTML tag (or similar) that a loader may use to load HTML content, such as images, scripts, etc.
     * @property _tag
     * @type {Object}
     * @private
     */
    this._tag = null;
  }
  getItem = function () {
    return this._item;
  };

  /**
   * Get a reference to the content that was loaded by the loader (only available after the {{#crossLink "complete:event"}}{{/crossLink}}
   * event is dispatched.
   * @method getResult
   * @param {Boolean} [raw=false] Determines if the returned result will be the formatted content, or the raw loaded
   * data (if it exists).
   * @return {Object}
   * @since 0.6.0
   */
  getResult = function (raw) {
    return raw ? this._rawResult : this._result;
  };

  /**
   * Return the `tag` this object creates or uses for loading.
   * @method getTag
   * @return {Object} The tag instance
   * @since 0.6.0
   */
  getTag = function () {
    return this._tag;
  };

  /**
   * Set the `tag` this item uses for loading.
   * @method setTag
   * @param {Object} tag The tag instance
   * @since 0.6.0
   */
  setTag = function(tag) {
    this._tag = tag;
  };

  /**
   * Begin loading the item. This method is required when using a loader by itself.
   *
   * <h4>Example</h4>
   *
   *      var queue = new createjs.LoadQueue();
   *      queue.on("complete", handleComplete);
   *      queue.loadManifest(fileArray, false); // Note the 2nd argument that tells the queue not to start loading yet
   *      queue.load();
   *
   * @method load
   */
  load = function () {
    this._createRequest();

    this._request.on("complete", this, this);
    this._request.on("progress", this, this);
    this._request.on("loadStart", this, this);
    this._request.on("abort", this, this);
    this._request.on("timeout", this, this);
    this._request.on("error", this, this);

    let evt = new Event("initialize");
    evt.loader = this._request;
    this.dispatchEvent(evt);

    this._request.load();
  };

  /**
   * Close the the item. This will stop any open requests (although downloads using HTML tags may still continue in
   * the background), but events will not longer be dispatched.
   * @method cancel
   */
  cancel = function () {
    this.canceled = true;
    this.destroy();
  };

  /**
   * Clean up the loader.
   * @method destroy
   */
  destroy = function() {
    if (this._request) {
      this._request.removeAllEventListeners();
      this._request.destroy();
    }

    this._request = null;

    this._item = null;
    this._rawResult = null;
    this._result = null;

    this._loadItems = null;

    this.removeAllEventListeners();
  };

  /**
   * Get any items loaded internally by the loader. The enables loaders such as {{#crossLink "ManifestLoader"}}{{/crossLink}}
   * to expose items it loads internally.
   * @method getLoadedItems
   * @return {Array} A list of the items loaded by the loader.
   * @since 0.6.0
   */
  getLoadedItems = function () {
    return this._loadedItems;
  };


  // Private methods
  /**
   * Create an internal request used for loading. By default, an {{#crossLink "XHRRequest"}}{{/crossLink}} or
   * {{#crossLink "TagRequest"}}{{/crossLink}} is created, depending on the value of {{#crossLink "preferXHR:property"}}{{/crossLink}}.
   * Other loaders may override this to use different request types, such as {{#crossLink "ManifestLoader"}}{{/crossLink}},
   * which uses {{#crossLink "JSONLoader"}}{{/crossLink}} or {{#crossLink "JSONPLoader"}}{{/crossLink}} under the hood.
   * @method _createRequest
   * @protected
   */
  _createRequest = function() {
    if (!this._preferXHR) {
      this._request = new TagRequest(this._item, this._tag || this._createTag(), this._tagSrcAttribute);
    } else {
      this._request = new XHRRequest(this._item);
    }
  };

  /**
   * Create the HTML tag used for loading. This method does nothing by default, and needs to be implemented
   * by loaders that require tag loading.
   * @method _createTag
   * @param {String} src The tag source
   * @return {HTMLElement} The tag that was created
   * @protected
   */
  _createTag = function(src) { return null; };

  /**
   * Dispatch a loadstart {{#crossLink "Event"}}{{/crossLink}}. Please see the {{#crossLink "AbstractLoader/loadstart:event"}}{{/crossLink}}
   * event for details on the event payload.
   * @method _sendLoadStart
   * @protected
   */
  _sendLoadStart = function () {
    if (this._isCanceled()) { return; }
    this.dispatchEvent("loadstart");
  };

  /**
   * Dispatch a {{#crossLink "ProgressEvent"}}{{/crossLink}}.
   * @method _sendProgress
   * @param {Number | Object} value The progress of the loaded item, or an object containing <code>loaded</code>
   * and <code>total</code> properties.
   * @protected
   */
  _sendProgress = function (value) {
    if (this._isCanceled()) { return; }
    let event = null;
    if (typeof(value) == "number") {
      this.progress = value;
      event = new ProgressEvent(this.progress);
    } else {
      event = value;
      this.progress = value.loaded / value.total;
      event.progress = this.progress;
      if (isNaN(this.progress) || this.progress == Infinity) { this.progress = 0; }
    }
    this.hasEventListener("progress") && this.dispatchEvent(event);
  };

  /**
   * Dispatch a complete {{#crossLink "Event"}}{{/crossLink}}. Please see the {{#crossLink "AbstractLoader/complete:event"}}{{/crossLink}} event
   * @method _sendComplete
   * @protected
   */
  _sendComplete = function () {
    if (this._isCanceled()) { return; }

    this.loaded = true;

    let event = new Event("complete");
    event.rawResult = this._rawResult;

    if (this._result != null) {
      event.result = this._result;
    }

    this.dispatchEvent(event);
  };

  /**
   * Dispatch an error {{#crossLink "Event"}}{{/crossLink}}. Please see the {{#crossLink "AbstractLoader/error:event"}}{{/crossLink}}
   * event for details on the event payload.
   * @method _sendError
   * @param {ErrorEvent} event The event object containing specific error properties.
   * @protected
   */
  _sendError = function (event) {
    if (this._isCanceled() || !this.hasEventListener("error")) { return; }
    if (event == null) {
      event = new ErrorEvent("PRELOAD_ERROR_EMPTY"); // TODO: Populate error
    }
    this.dispatchEvent(event);
  };

  /**
   * Determine if the load has been canceled. This is important to ensure that method calls or asynchronous events
   * do not cause issues after the queue has been cleaned up.
   * @method _isCanceled
   * @return {Boolean} If the loader has been canceled.
   * @protected
   */
  _isCanceled = function () {
    return this.canceled;
  };

  /**
   * A custom result formatter function, which is called just before a request dispatches its complete event. Most
   * loader types already have an internal formatter, but this can be user-overridden for custom formatting. The
   * formatted result will be available on Loaders using {{#crossLink "getResult"}}{{/crossLink}}, and passing `true`.
   * @property resultFormatter
   * @type Function
   * @return {Object} The formatted result
   * @since 0.6.0
   */
  resultFormatter = null;

  /**
   * Handle events from internal requests. By default, loaders will handle, and redispatch the necessary events, but
   * this method can be overridden for custom behaviours.
   * @method handleEvent
   * @param {Event} event The event that the internal request dispatches.
   * @protected
   * @since 0.6.0
   */
  handleEvent = function (event) {
    switch (event.type) {
      case "complete":
        this._rawResult = event.target._response;
        var result = this.resultFormatter && this.resultFormatter(this);
        // The resultFormatter is asynchronous
        if (result instanceof Function) {
          result.call(this,
            Base.proxy(this._resultFormatSuccess, this),
            Base.proxy(this._resultFormatFailed, this)
          );
          // The result formatter is synchronous
        } else {
          this._result =  result || this._rawResult;
          this._sendComplete();
        }
        break;
      case "progress":
        this._sendProgress(event);
        break;
      case "error":
        this._sendError(event);
        break;
      case "loadstart":
        this._sendLoadStart();
        break;
      case "abort":
      case "timeout":
        if (!this._isCanceled()) {
          this.dispatchEvent(new ErrorEvent("PRELOAD_" + event.type.toUpperCase() + "_ERROR"));
        }
        break;
    }
  };

  /**
   * The "success" callback passed to {{#crossLink "AbstractLoader/resultFormatter"}}{{/crossLink}} asynchronous
   * functions.
   * @method _resultFormatSuccess
   * @param {Object} result The formatted result
   * @private
   */
  _resultFormatSuccess = function (result) {
    this._result = result;
    this._sendComplete();
  };

  /**
   * The "error" callback passed to {{#crossLink "AbstractLoader/resultFormatter"}}{{/crossLink}} asynchronous
   * functions.
   * @method _resultFormatSuccess
   * @param {Object} error The error event
   * @private
   */
  _resultFormatFailed = function (event) {
    this._sendError(event);
  };

  /**
   * @method toString
   * @return {String} a string representation of the instance.
   */
  toString = function () {
    return "[PreloadJS AbstractLoader]";
  };
}