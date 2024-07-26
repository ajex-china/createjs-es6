import AbstractLoader from "@/utils/preloadJS/loaders/AbstractLoader.js";
import Types from "@/utils/base/Types.js";
import DomUtils from "@/utils/base/DomUtils.js";
import Elements from "@/utils/base/Elements.js";
import URLUtils from "@/utils/base/URLUtils.js";
import Base from "@/utils/base/Base.js";
import ErrorEvent from "@/utils/base/ErrorEvent.js";

export default class ImageLoader extends AbstractLoader {
  constructor (loadItem, preferXHR) {
    super(loadItem, preferXHR, Types.IMAGE)
    // public properties
    this.resultFormatter = this._formatResult;

    // protected properties
    this._tagSrcAttribute = "src";

    // Check if the preload item is already a tag.
    if (DomUtils.isImageTag(loadItem)) {
      this._tag = loadItem;
    } else if (DomUtils.isImageTag(loadItem.src)) {
      this._tag = loadItem.src;
    } else if (DomUtils.isImageTag(loadItem.tag)) {
      this._tag = loadItem.tag;
    }

    if (this._tag != null) {
      this._preferXHR = false;
    } else {
      this._tag = Elements.img();
    }

    this.on("initialize", this._updateXHR, this);
  }
  static canLoadItem = function (item) {
    return item.type == Types.IMAGE;
  };

  load = function () {
    if (this._tag.src != "" && this._tag.complete) {
      this._request._handleTagComplete();
      this._sendComplete();
      return;
    }

    let crossOrigin = this._item.crossOrigin;
    if (crossOrigin === true) { crossOrigin = "Anonymous"; }
    if (crossOrigin != null && !URLUtils.isLocal(this._item)) {
      this._tag.crossOrigin = crossOrigin;
    }

    super.load();
  };

  // protected methods
  /**
   * Before the item loads, set its mimeType and responseType.
   * @property _updateXHR
   * @param {Event} event
   * @private
   */
  _updateXHR = function (event) {
    event.loader.mimeType = 'text/plain; charset=x-user-defined-binary';

    // Only exists for XHR
    if (event.loader.setResponseType) {
      event.loader.setResponseType("blob");
    }
  };

  /**
   * The result formatter for Image files.
   * @method _formatResult
   * @param {AbstractLoader} loader
   * @returns {HTMLImageElement}
   * @private
   */
  _formatResult = function (loader) {
    return this._formatImage;
  };

  /**
   * The asynchronous image formatter function. This is required because images have
   * a short delay before they are ready.
   * @method _formatImage
   * @param {Function} successCallback The method to call when the result has finished formatting
   * @param {Function} errorCallback The method to call if an error occurs during formatting
   * @private
   */
  _formatImage = function (successCallback, errorCallback) {
    let tag = this._tag;
    let URL = window.URL || window.webkitURL;

    if (!this._preferXHR) {

      //document.body.removeChild(tag);
    } else if (URL) {
      let objURL = URL.createObjectURL(this.getResult(true));
      tag.src = objURL;

      tag.addEventListener("load", this._cleanUpURL, false);
      tag.addEventListener("error", this._cleanUpURL, false);
    } else {
      tag.src = this._item.src;
    }

    if (tag.complete) {
      successCallback(tag);
    } else {
      tag.onload = Base.proxy(function() {
        successCallback(this._tag);
        tag.onload = tag.onerror = null;
      }, this);

      tag.onerror = Base.proxy(function(event) {
        errorCallback(new ErrorEvent('IMAGE_FORMAT', null, event));
        tag.onload = tag.onerror = null;
      }, this);
    }
  };

  /**
   * Clean up the ObjectURL, the tag is done with it. Note that this function is run
   * as an event listener without a proxy/closure, as it doesn't require it - so do not
   * include any functionality that requires scope without changing it.
   * @method _cleanUpURL
   * @param event
   * @private
   */
  _cleanUpURL = function (event) {
    let URL = window.URL || window.webkitURL;
    URL.revokeObjectURL(event.target.src);
  };

}