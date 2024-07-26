import Base from "@/utils/base/Base.js";
import TagRequest from "@/utils/preloadJS/net/TagRequest.js";
import ProgressEvent from "@/utils/preloadJS/event/ProgressEvent.js";

export default class MediaTagRequest extends TagRequest {
  constructor(loadItem, tag, srcAttribute)
  {
    super(loadItem);
  }
  load = function () {
    let sc = Base.proxy(this._handleStalled, this);
    this._stalledCallback = sc;

    let pc = Base.proxy(this._handleProgress, this);
    this._handleProgress = pc;

    this._tag.addEventListener("stalled", sc);
    this._tag.addEventListener("progress", pc);

    // This will tell us when audio is buffered enough to play through, but not when its loaded.
    // The tag doesn't keep loading in Chrome once enough has buffered, and we have decided that behaviour is sufficient.
    this._tag.addEventListener && this._tag.addEventListener("canplaythrough", this._loadedHandler, false); // canplaythrough callback doesn't work in Chrome, so we use an event.

    super.load();
  };

  // private methods
  _handleReadyStateChange = function () {
    clearTimeout(this._loadTimeout);
    // This is strictly for tags in browsers that do not support onload.
    let tag = this._tag;

    // Complete is for old IE support.
    if (tag.readyState == "loaded" || tag.readyState == "complete") {
      this._handleTagComplete();
    }
  };

  _handleStalled = function () {
    //Ignore, let the timeout take care of it. Sometimes its not really stopped.
  };

  /**
   * An XHR request has reported progress.
   * @method _handleProgress
   * @param {Object} event The XHR progress event.
   * @private
   */
  _handleProgress = function (event) {
    if (!event || event.loaded > 0 && event.total == 0) {
      return; // Sometimes we get no "total", so just ignore the progress event.
    }

    let newEvent = new ProgressEvent(event.loaded, event.total);
    this.dispatchEvent(newEvent);
  };

  // protected methods
  _clean = function () {
    this._tag.removeEventListener && this._tag.removeEventListener("canplaythrough", this._loadedHandler);
    this._tag.removeEventListener("stalled", this._stalledCallback);
    this._tag.removeEventListener("progress", this._progressCallback);

    super._clean();
  };
}