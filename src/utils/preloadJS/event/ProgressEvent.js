import {Event} from "@createjs/core";

export default class ProgressEvent extends Event{
  constructor(loaded, total) {
    super("progress");
    /**
     * The amount that has been loaded (out of a total amount)
     * @property loaded
     * @type {Number}
     */
    this.loaded = loaded;

    /**
     * The total "size" of the load.
     * @property total
     * @type {Number}
     * @default 1
     */
    this.total = (total == null) ? 1 : total;

    /**
     * The percentage (out of 1) that the load has been completed. This is calculated using `loaded/total`.
     * @property progress
     * @type {Number}
     * @default 0
     */
    this.progress = (total == 0) ? 0 : this.loaded / this.total;
  }
  static clone = function() {
    return new ProgressEvent(this.loaded, this.total);
  };
}