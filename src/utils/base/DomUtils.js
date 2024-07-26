export default class DomUtils{
  static appendToHead = function (el) {
    DomUtils.getHead().appendChild(el);
  }

  static appendToBody = function (el) {
    if (DomUtils.container == null) {
      DomUtils.container = document.createElement("div");
      DomUtils.container.id = "preloadjs-container";
      let style = DomUtils.container.style;
      style.visibility = "hidden";
      style.position = "absolute";
      style.width = DomUtils.container.style.height = "10px";
      style.overflow = "hidden";
      style.transform = style.msTransform = style.webkitTransform = style.oTransform = "translate(-10px, -10px)"; //LM: Not working
      DomUtils.getBody().appendChild(DomUtils.container);
    }
    DomUtils.container.appendChild(el);
  }

  static getHead = function () {
    return document.head || document.getElementsByTagName("head")[0];
  }

  static getBody = function () {
    return document.body || document.getElementsByTagName("body")[0];
  }

  static removeChild = function(el) {
    if (el.parent) {
      el.parent.removeChild(el);
    }
  }

  /**
   * Check if item is a valid HTMLImageElement
   * @method isImageTag
   * @param {Object} item
   * @returns {Boolean}
   * @static
   */
  static isImageTag = function(item) {
    return item instanceof HTMLImageElement;
  };

  /**
   * Check if item is a valid HTMLAudioElement
   * @method isAudioTag
   * @param {Object} item
   * @returns {Boolean}
   * @static
   */
  static isAudioTag = function(item) {
    if (window.HTMLAudioElement) {
      return item instanceof HTMLAudioElement;
    } else {
      return false;
    }
  };

  /**
   * Check if item is a valid HTMLVideoElement
   * @method isVideoTag
   * @param {Object} item
   * @returns {Boolean}
   * @static
   */
  static isVideoTag = function(item) {
    if (window.HTMLVideoElement) {
      return item instanceof HTMLVideoElement;
    } else {
      return false;
    }
  };
}