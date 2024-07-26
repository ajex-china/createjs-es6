import AbstractLoader from "@/utils/preloadJS/loaders/AbstractLoader.js";
import Types from "@/utils/base/Types.js";

export default class BinaryLoader extends AbstractLoader {
  constructor (loadItem) {
    super(loadItem, true, Types.BINARY);
    this.on("initialize", this._updateXHR, this);
  }
  // static methods
  /**
   * Determines if the loader can load a specific item. This loader can only load items that are of type
   * {{#crossLink "Types/BINARY:property"}}{{/crossLink}}
   * @method canLoadItem
   * @param {LoadItem|Object} item The LoadItem that a LoadQueue is trying to load.
   * @returns {Boolean} Whether the loader can load the item.
   * @static
   */
  static canLoadItem = function (item) {
    return item.type == Types.BINARY;
  };
  // private methods
  /**
   * Before the item loads, set the response type to "arraybuffer"
   * @property _updateXHR
   * @param {Event} event
   * @private
   */
  _updateXHR = function (event) {
    event.loader.setResponseType("arraybuffer");
  };
}