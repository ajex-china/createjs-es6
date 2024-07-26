import AbstractLoader from "@/utils/preloadJS/loaders/AbstractLoader.js";
import Types from "@/utils/base/Types.js";
import DataUtils from "@/utils/base/DataUtils.js";

export default class XMLLoader extends AbstractLoader {
  constructor(loadItem) {
    super(loadItem, true, Types.XML);
    this.resultFormatter = this._formatResult;
  }
  /**
   * Determines if the loader can load a specific item. This loader can only load items that are of type
   * {{#crossLink "Types/XML:property"}}{{/crossLink}}.
   * @method canLoadItem
   * @param {LoadItem|Object} item The LoadItem that a LoadQueue is trying to load.
   * @returns {Boolean} Whether the loader can load the item.
   * @static
   */
  static canLoadItem = function (item) {
    return item.type == Types.XML;
  };
  /**
   * The result formatter for XML files.
   * @method _formatResult
   * @param {AbstractLoader} loader
   * @returns {XMLDocument}
   * @private
   */
  _formatResult = function (loader) {
    return DataUtils.parseXML(loader.getResult(true));
  };

}