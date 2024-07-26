import AbstractLoader from "@/utils/preloadJS/loaders/AbstractLoader.js";
import XHRRequest from "@/utils/preloadJS/net/XHRRequest.js";
import MediaTagRequest from "@/utils/preloadJS/net/MediaTagRequest.js";
import URLUtils from "@/utils/base/URLUtils.js";

export default class AbstractMediaLoader extends AbstractLoader {
  constructor (loadItem, preferXHR, type) {
    super(loadItem, preferXHR, type);
    this.resultFormatter = this._formatResult;

    // protected properties
    this._tagSrcAttribute = "src";

    this.on("initialize", this._updateXHR, this);
  }
  load = function () {
    // TagRequest will handle most of this, but Sound / Video need a few custom properties, so just handle them here.
    if (!this._tag) {
      this._tag = this._createTag(this._item.src);
    }

    let crossOrigin = this._item.crossOrigin;
    if (crossOrigin === true) { crossOrigin = "Anonymous"; }
    if (crossOrigin != null && !URLUtils.isLocal(this._item)) {
      this._tag.crossOrigin = crossOrigin;
    }

    this._tag.preload = "auto";
    this._tag.load();

    super.load();
  };

  // protected methods
  /**
   * Creates a new tag for loading if it doesn't exist yet.
   * @method _createTag
   * @private
   */
  _createTag = function () {};


  _createRequest = function() {
    if (!this._preferXHR) {
      this._request = new MediaTagRequest(this._item, this._tag || this._createTag(), this._tagSrcAttribute);
    } else {
      this._request = new XHRRequest(this._item);
    }
  };

  // protected methods
  /**
   * Before the item loads, set its mimeType and responseType.
   * @property _updateXHR
   * @param {Event} event
   * @private
   */
  _updateXHR = function (event) {
    // Only exists for XHR
    if (event.loader.setResponseType) {
      event.loader.setResponseType("blob");
    }
  };

  /**
   * The result formatter for media files.
   * @method _formatResult
   * @param {AbstractLoader} loader
   * @returns {HTMLVideoElement|HTMLAudioElement}
   * @private
   */
  _formatResult = function (loader) {
    this._tag.removeEventListener && this._tag.removeEventListener("canplaythrough", this._loadedHandler);
    this._tag.onstalled = null;
    if (this._preferXHR) {
      let URL = window.URL || window.webkitURL;
      let result = loader.getResult(true);

      loader.getTag().src = URL.createObjectURL(result);
    }
    return loader.getTag();
  };
}