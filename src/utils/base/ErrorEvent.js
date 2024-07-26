import {Event} from "@createjs/core";
export default class ErrorEvent extends Event{
  constructor(title, message, data) {
    super("error");

    /**
     * The short error title, which indicates the type of error that occurred.
     * @property title
     * @type String
     */
    this.title = title;

    /**
     * The verbose error message, containing details about the error.
     * @property message
     * @type String
     */
    this.message = message;

    /**
     * Additional data attached to an error.
     * @property data
     * @type {Object}
     */
    this.data = data;
  }
  static clone = function() {
    return new ErrorEvent(this.title, this.message, this.data);
  };
}