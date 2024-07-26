export default class Elements{
  static a = function() {
    return Elements.el("a");
  }

  static svg = function() {
    return Elements.el("svg");
  }

  static object = function() {
    return Elements.el("object");
  }

  static image = function() {
    return Elements.el("image");
  }

  static img = function() {
    return Elements.el("img");
  }

  static style = function() {
    return Elements.el("style");
  }

  static link = function() {
    return Elements.el("link");
  }

  static script = function() {
    return Elements.el("script");
  }

  static audio = function() {
    return Elements.el("audio");
  }

  static video = function() {
    return Elements.el("video");
  }

  static text = function(value) {
    return document.createTextNode(value);
  }

  static el = function(name) {
    return document.createElement(name);
  }

}