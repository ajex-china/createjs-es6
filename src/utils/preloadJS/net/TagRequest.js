import AbstractLoader from "@/utils/preloadJS/loaders/AbstractLoader.js";
import Base from "@/utils/base/Base.js";
import DomUtils from "@/utils/base/DomUtils.js";
import {Event} from "@createjs/core";

export default class TagRequest extends AbstractLoader {
  constructor(loadItem, tag, srcAttribute)
  {
    super(loadItem);
    // protected properties
    /**
     * The HTML tag instance that is used to load.
     * @property _tag
     * @type {HTMLElement}
     * @protected
     */
    this._tag = tag;

    /**
     * The tag attribute that specifies the source, such as "src", "href", etc.
     * @property _tagSrcAttribute
     * @type {String}
     * @protected
     */
    this._tagSrcAttribute = srcAttribute;

    /**
     * A method closure used for handling the tag load event.
     * @property _loadedHandler
     * @type {Function}
     * @private
     */

    this._loadedHandler = Base.proxy(this._handleTagComplete, this);

    /**
     * Determines if the element was added to the DOM automatically by PreloadJS, so it can be cleaned up after.
     * @property _addedToDOM
     * @type {Boolean}
     * @private
     */
    this._addedToDOM = false;
  }
  load = function () {
    this._tag.onload = Base.proxy(this._handleTagComplete, this);
    this._tag.onreadystatechange = Base.proxy(this._handleReadyStateChange, this);
    this._tag.onerror = Base.proxy(this._handleError, this);

    let evt = new Event("initialize");
    evt.loader = this._tag;

    this.dispatchEvent(evt);

    this._loadTimeout = setTimeout(Base.proxy(this._handleTimeout, this), this._item.loadTimeout);

    this._tag[this._tagSrcAttribute] = this._item.src;

    // wdg:: Append the tag AFTER setting the src, or SVG loading on iOS will fail.
    if (this._tag.parentNode == null) {
      DomUtils.appendToBody(this._tag);
      this._addedToDOM = true;
    }
  };

  destroy = function() {
    this._clean();
    this._tag = null;

    super.destroy();
  };

  // private methods
  /**
   * Handle the readyStateChange event from a tag. We need this in place of the `onload` callback (mainly SCRIPT
   * and LINK tags), but other cases may exist.
   * @method _handleReadyStateChange
   * @private
   */
  _handleReadyStateChange = function () {
    clearTimeout(this._loadTimeout);
    // This is strictly for tags in browsers that do not support onload.
    let tag = this._tag;

    // Complete is for old IE support.
    if (tag.readyState == "loaded" || tag.readyState == "complete") {
      this._handleTagComplete();
    }
  };

  /**
   * Handle any error events from the tag.
   * @method _handleError
   * @protected
   */
  _handleError = function() {
    this._clean();
    this.dispatchEvent("error");
  };

  /**
   * Handle the tag's onload callback.
   * @method _handleTagComplete
   * @private
   */
  _handleTagComplete = function () {
    this._rawResult = this._tag;
    this._result = this.resultFormatter && this.resultFormatter(this) || this._rawResult;

    this._clean();

    this.dispatchEvent("complete");
  };

  /**
   * The tag request has not loaded within the time specified in loadTimeout.
   * @method _handleError
   * @param {Object} event The XHR error event.
   * @private
   */
  _handleTimeout = function () {
    this._clean();
    this.dispatchEvent(new Event("timeout"));
  };

  /**
   * Remove event listeners, but don't destroy the request object
   * @method _clean
   * @private
   */
  _clean = function() {
    this._tag.onload = null;
    this._tag.onreadystatechange = null;
    this._tag.onerror = null;
    if (this._addedToDOM && this._tag.parentNode != null) {
      this._tag.parentNode.removeChild(this._tag);
    }
    clearTimeout(this._loadTimeout);
  };

  /**
   * Handle a stalled audio event. The main place this happens is with HTMLAudio in Chrome when playing back audio
   * that is already in a load, but not complete.
   * @method _handleStalled
   * @private
   */
  _handleStalled = function () {
    //Ignore, let the timeout take care of it. Sometimes its not really stopped.
  };
}