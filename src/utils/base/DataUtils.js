export default class DataUtils{
  /**
   * Parse XML using the DOM. This is required when preloading XML or SVG.
   * @method parseXML
   * @param {String} text The raw text or XML that is loaded by XHR.
   * @return {XML} An XML document
   * @static
   */
  static parseXML = function (text) {
    let xml = null;
    // CocoonJS does not support XML parsing with either method.

    // Most browsers will use DOMParser
    // IE fails on certain SVG files, so we have a fallback below.
    try {
      if (window.DOMParser) {
        let parser = new DOMParser();
        xml = parser.parseFromString(text, "text/xml");
      }
    } catch (e) {
    }

    // Fallback for IE support.
    if (!xml) {
      try {
        xml = new ActiveXObject("Microsoft.XMLDOM");
        xml.async = false;
        xml.loadXML(text);
      } catch (e) {
        xml = null;
      }
    }

    return xml;
  };

  /**
   * Parse a string into an Object.
   * @method parseJSON
   * @param {String} value The loaded JSON string
   * @returns {Object} A JavaScript object.
   */
  static parseJSON = function (value) {
    if (value == null) {
      return null;
    }

    try {
      return JSON.parse(value);
    } catch (e) {
      // TODO; Handle this with a custom error?
      throw e;
    }
  };

}