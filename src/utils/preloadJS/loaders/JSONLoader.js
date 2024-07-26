import AbstractLoader from "@/utils/preloadJS/loaders/AbstractLoader.js";
import Types from "@/utils/base/Types.js";
import ErrorEvent from "@/utils/base/ErrorEvent.js";
import DataUtils from "@/utils/base/DataUtils.js";

export default class JSONLoader extends AbstractLoader {
  constructor (loadItem) {
    super(loadItem, true, Types.JSON);

    this.resultFormatter = this._formatResult;
  }
  /**
   * Determines if the loader can load a specific item. This loader can only load items that are of type
   * {{#crossLink "Types/JSON:property"}}{{/crossLink}}.
   * @method canLoadItem
   * @param {LoadItem|Object} item The LoadItem that a LoadQueue is trying to load.
   * @returns {Boolean} Whether the loader can load the item.
   * @static
   */
  static canLoadItem = function (item) {
    return item.type == Types.JSON;
  };
  /**
   * The result formatter for JSON files.
   * @method _formatResult
   * @param {AbstractLoader} loader
   * @returns {HTMLLinkElement|HTMLStyleElement}
   * @private
   */
  _formatResult = function (loader) {
    let json = null;
    try {
      json = DataUtils.parseJSON(loader.getResult(true));
    } catch (e) {
      let event = new ErrorEvent("JSON_FORMAT", null, e);
      this._sendError(event);
      return e;
    }

    return json;
  };

}