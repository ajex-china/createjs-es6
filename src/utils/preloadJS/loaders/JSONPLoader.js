import AbstractLoader from "@/utils/preloadJS/loaders/AbstractLoader.js";
import Types from "@/utils/base/Types.js";
import Elements from "@/utils/base/Elements.js";
import Base from "@/utils/base/Base.js";
import DomUtils from "@/utils/base/DomUtils.js";
import ErrorEvent from "@/utils/base/ErrorEvent.js";

export default class JSONPLoader extends AbstractLoader {
  constructor(loadItem) {
    super(loadItem, false, Types.JSONP);

    this.setTag(Elements.script());
    this.getTag().type = "text/javascript";
  }
  /**
   * Determines if the loader can load a specific item. This loader can only load items that are of type
   * {{#crossLink "Types/JSONP:property"}}{{/crossLink}}.
   * @method canLoadItem
   * @param {LoadItem|Object} item The LoadItem that a LoadQueue is trying to load.
   * @returns {Boolean} Whether the loader can load the item.
   * @static
   */
  static canLoadItem = function (item) {
    return item.type == Types.JSONP;
  };

  cancel = function () {
    super.cancel();
    this._dispose();
  };

  /**
   * Loads the JSONp file.  Because of the unique loading needs of JSONp
   * we don't use the AbstractLoader.load() method.
   *
   * @method load
   *
   */
  load = function () {
    if (this._item.callback == null) {
      throw new Error('callback is required for loading JSONP requests.');
    }

    // TODO: Look into creating our own iFrame to handle the load
    // In the first attempt, FF did not get the result
    //   result instanceof Object did not work either
    //   so we would need to clone the result.
    if (window[this._item.callback] != null) {
      throw new Error(
        "JSONP callback '" +
        this._item.callback +
        "' already exists on window. You need to specify a different callback or re-name the current one.");
    }

    window[this._item.callback] = Base.proxy(this._handleLoad, this);
    DomUtils.appendToBody(this._tag);

    this._loadTimeout = setTimeout(Base.proxy(this._handleTimeout, this), this._item.loadTimeout);

    // Load the tag
    this._tag.src = this._item.src;
  };

  // private methods
  /**
   * Handle the JSONP callback, which is a public method defined on `window`.
   * @method _handleLoad
   * @param {Object} data The formatted JSON data.
   * @private
   */
  _handleLoad = function (data) {
    this._result = this._rawResult = data;
    this._sendComplete();

    this._dispose();
  };

  /**
   * The tag request has not loaded within the time specfied in loadTimeout.
   * @method _handleError
   * @param {Object} event The XHR error event.
   * @private
   */
  _handleTimeout = function () {
    this._dispose();
    this.dispatchEvent(new ErrorEvent("timeout"));
  };

  /**
   * Clean up the JSONP load. This clears out the callback and script tag that this loader creates.
   * @method _dispose
   * @private
   */
  _dispose = function () {
    DomUtils.removeChild(this._tag);
    delete window[this._item.callback];

    clearTimeout(this._loadTimeout);
  };
}