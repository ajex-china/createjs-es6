import AbstractLoader from "@/utils/preloadJS/loaders/AbstractLoader.js";
import Types from "@/utils/base/Types.js";
import Elements from "@/utils/base/Elements.js";
import DataUtils from "@/utils/base/DataUtils.js";

export default class SVGLoader extends AbstractLoader {
  constructor(loadItem, preferXHR) {
    super(loadItem, preferXHR, Types.SVG);

    // public properties
    this.resultFormatter = this._formatResult;

    // protected properties
    this._tagSrcAttribute = "data";

    if (preferXHR) {
      this.setTag(Elements.svg());
    } else {
      this.setTag(Elements.object());
      this.getTag().type = "image/svg+xml";
    }
  }
  /**
   * Determines if the loader can load a specific item. This loader can only load items that are of type
   * {{#crossLink "Types/SVG:property"}}{{/crossLink}}
   * @method canLoadItem
   * @param {LoadItem|Object} item The LoadItem that a LoadQueue is trying to load.
   * @returns {Boolean} Whether the loader can load the item.
   * @static
   */
  static canLoadItem = function (item) {
    return item.type == Types.SVG;
  };
  /**
   * The result formatter for SVG files.
   * @method _formatResult
   * @param {AbstractLoader} loader
   * @returns {Object}
   * @private
   */
  _formatResult = function (loader) {
    // mime should be image/svg+xml, but Opera requires text/xml
    let xml = DataUtils.parseXML(loader.getResult(true));
    let tag = loader.getTag();

    if (!this._preferXHR && document.body.contains(tag)) {
      document.body.removeChild(tag);
    }

    if (xml.documentElement != null) {
      let element = xml.documentElement;
      // Support loading an SVG from a different domain in ID
      if (document.importNode) {
        element = document.importNode(element, true);
      }
      tag.appendChild(element);
      return tag;
    } else { // For browsers that don't support SVG, just give them the XML. (IE 9-8)
      return xml;
    }
  };
}