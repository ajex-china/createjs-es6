import AbstractLoader from "@/utils/preloadJS/loaders/AbstractLoader.js";
import Types from "@/utils/base/Types.js";
import Elements from "@/utils/base/Elements.js";

export default class JavaScriptLoader extends AbstractLoader {
  constructor(loadItem, preferXHR) {
    super(loadItem, preferXHR, Types.JAVASCRIPT);
    // public properties
    this.resultFormatter = this._formatResult;

    // protected properties
    this._tagSrcAttribute = "src";
    this.setTag(Elements.script());
  }
  /**
   * Determines if the loader can load a specific item. This loader can only load items that are of type
   * {{#crossLink "Types/JAVASCRIPT:property"}}{{/crossLink}}
   * @method canLoadItem
   * @param {LoadItem|Object} item The LoadItem that a LoadQueue is trying to load.
   * @returns {Boolean} Whether the loader can load the item.
   * @static
   */
  static canLoadItem = function (item) {
    return item.type == Types.JAVASCRIPT;
  };
  /**
   * The result formatter for JavaScript files.
   * @method _formatResult
   * @param {AbstractLoader} loader
   * @returns {HTMLLinkElement|HTMLStyleElement}
   * @private
   */
  _formatResult = function (loader) {
    let tag = loader.getTag();
    if (this._preferXHR) {
      tag.text = loader.getResult(true);
    }
    return tag;
  };

}