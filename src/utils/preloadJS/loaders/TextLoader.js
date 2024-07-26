import AbstractLoader from "@/utils/preloadJS/loaders/AbstractLoader.js";
import Types from "@/utils/base/Types.js";

export default class TextLoader extends AbstractLoader {
  constructor(loadItem) {
    super(loadItem, true, Types.TEXT);
  }
  /**
   * Determines if the loader can load a specific item. This loader loads items that are of type {{#crossLink "Types/TEXT:property"}}{{/crossLink}},
   * but is also the default loader if a file type can not be determined.
   * @method canLoadItem
   * @param {LoadItem|Object} item The LoadItem that a LoadQueue is trying to load.
   * @returns {Boolean} Whether the loader can load the item.
   * @static
   */
  static canLoadItem = function (item) {
    return item.type == Types.TEXT;
  };
}