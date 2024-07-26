import AbstractLoader from "@/utils/preloadJS/loaders/AbstractLoader.js";
import Types from "@/utils/base/Types.js";
import DomUtils from "@/utils/base/DomUtils.js";
import Elements from "@/utils/base/Elements.js";

export default class VideoLoader extends AbstractLoader {
  constructor(loadItem, preferXHR) {
    super(loadItem, preferXHR, Types.VIDEO);

    if (DomUtils.isVideoTag(loadItem) || DomUtils.isVideoTag(loadItem.src)) {
      this.setTag(DomUtils.isVideoTag(loadItem)?loadItem:loadItem.src);

      // We can't use XHR for a tag that's passed in.
      this._preferXHR = false;
    } else {
      this.setTag(this._createTag());
    }
  }
  /**
   * Create a new video tag
   *
   * @returns {HTMLElement}
   * @private
   */
  _createTag = function () {
    return Elements.video();
  };

  // static methods
  /**
   * Determines if the loader can load a specific item. This loader can only load items that are of type
   * {{#crossLink "Types/VIDEO:property"}}{{/crossLink}}.
   * @method canLoadItem
   * @param {LoadItem|Object} item The LoadItem that a LoadQueue is trying to load.
   * @returns {Boolean} Whether the loader can load the item.
   * @static
   */
  static canLoadItem = function (item) {
    return item.type == Types.VIDEO;
  };
}