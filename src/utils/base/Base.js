export default class Base{
  static proxy = function (method, scope) {
    let aArgs = Array.prototype.slice.call(arguments, 2);
    return function () {
      return method.apply(scope, Array.prototype.slice.call(arguments, 0).concat(aArgs));
    };
  }
  static indexOf = function (array, searchElement){
    "use strict";
    for (let i = 0,l=array.length; i < l; i++) {
      if (searchElement === array[i]) {
        return i;
      }
    }
    return -1;
  };
}
