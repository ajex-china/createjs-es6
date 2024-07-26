import AbstractLoader from "@/utils/preloadJS/loaders/AbstractLoader.js";
import Types from "@/utils/base/Types.js";
import DomUtils from "@/utils/base/DomUtils.js";
import Elements from "@/utils/base/Elements.js";

export default class SoundLoader extends AbstractLoader {
  constructor(loadItem, preferXHR) {
    super(loadItem, preferXHR, Types.SOUND);
    if (DomUtils.isAudioTag(loadItem)) {
      this._tag = loadItem;
    } else if (DomUtils.isAudioTag(loadItem.src)) {
      this._tag = loadItem;
    } else if (DomUtils.isAudioTag(loadItem.tag)) {
      this._tag = DomUtils.isAudioTag(loadItem) ? loadItem : loadItem.src;
    }

    if (this._tag != null) {
      this._preferXHR = false;
    }
  }
  /**
   * Determines if the loader can load a specific item. This loader can only load items that are of type
   * {{#crossLink "Types/SOUND:property"}}{{/crossLink}}.
   * @method canLoadItem
   * @param {LoadItem|Object} item The LoadItem that a LoadQueue is trying to load.
   * @returns {Boolean} Whether the loader can load the item.
   * @static
   */
  static canLoadItem = function (item) {
    return item.type == Types.SOUND;
  };

  _createTag = function (src) {
    let tag = Elements.audio();
    tag.autoplay = false;
    tag.preload = "none";

    //LM: Firefox fails when this the preload="none" for other tags, but it needs to be "none" to ensure PreloadJS works.
    tag.src = src;
    return tag;
  };
}