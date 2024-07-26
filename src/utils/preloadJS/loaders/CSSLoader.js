import AbstractLoader from "@/utils/preloadJS/loaders/AbstractLoader.js";
import Types from "@/utils/base/Types.js";
import Elements from "@/utils/base/Elements.js";
import DomUtils from "@/utils/base/DomUtils.js";

export default class CSSLoader extends AbstractLoader {
  constructor (loadItem, preferXHR) {
    super(loadItem, preferXHR, Types.CSS);
    // public properties
    this.resultFormatter = this._formatResult;

    // protected properties
    this._tagSrcAttribute = "href";

    if (preferXHR) {
      this._tag = Elements.style();
    } else {
      this._tag = Elements.link();
    }

    this._tag.rel = "stylesheet";
    this._tag.type = "text/css";
  }
  /**
   * Determines if the loader can load a specific item. This loader can only load items that are of type
   * {{#crossLink "Types/CSS:property"}}{{/crossLink}}.
   * @method canLoadItem
   * @param {LoadItem|Object} item The LoadItem that a LoadQueue is trying to load.
   * @returns {Boolean} Whether the loader can load the item.
   * @static
   */
  static canLoadItem = function (item) {
    return item.type == Types.CSS;
  };
  /**
   * The result formatter for CSS files.
   * @method _formatResult
   * @param {AbstractLoader} loader
   * @returns {HTMLLinkElement|HTMLStyleElement}
   * @private
   */
  _formatResult = function (loader) {
    let tag;
    if (this._preferXHR) {
      tag = loader.getTag();

      if (tag.styleSheet) { // IE
        tag.styleSheet.cssText = loader.getResult(true);
      } else {
        let textNode = Elements.text(loader.getResult(true));
        tag.appendChild(textNode);
      }
    } else {
      tag = this._tag;
    }

    DomUtils.appendToHead(tag);

    return tag;
  };
}