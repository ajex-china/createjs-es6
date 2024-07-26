/**
 * @license VideoBuffer
 * Visit http://createjs.com/ for documentation, updates and examples.
 *
 * Copyright (c) 2010 gskinner.com, inc.
 *
 * Permission is hereby granted, free of charge, to any person
 * obtaining a copy of this software and associated documentation
 * files (the "Software"), to deal in the Software without
 * restriction, including without limitation the rights to use,
 * copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the
 * Software is furnished to do so, subject to the following
 * conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
 * OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
 * NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
 * HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
 * WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
 * OTHER DEALINGS IN THE SOFTWARE.
 */

import createCanvas from "./Canvas";

/**
 * When an HTML video seeks, including when looping, there is an indeterminate period before a new frame is available.
 * This can result in the video blinking or flashing when it is drawn to a canvas. The VideoBuffer class resolves
 * this issue by drawing each frame to an off-screen canvas and preserving the prior frame during a seek.
 *
 * @example
 * let buffer = new VideoBuffer(video);
 * let bitmap = new Bitmap(buffer);
 *
 * @param {HTMLVideoElement} video The HTML video element to buffer.
 */
export default class VideoBuffer {

  constructor (video) {

  	/**
  	 * Used by Bitmap to determine when the video buffer is ready to be drawn. Not intended for general use.
  	 * @protected
  	 * @type {Number}
  	 */
  	this.readyState = video.readyState;

  	/**
  	 * @protected
  	 * @type {HTMLVideoElement}
  	 */
  	this._video = video;

  	/**
  	 * @protected
  	 * @type {HTMLCanvasElement}
  	 */
  	this._canvas = null;

  	/**
  	 * @protected
  	 * @type {Number}
  	 * @default -1
  	 */
  	this._lastTime = -1;

  	if (this.readyState < 2) {
      video.addEventListener("canplaythrough", this._videoReady.bind(this));
    }
    // {once: true} isn't supported everywhere, but its a non-critical optimization here.
  }

  /**
   * Gets an HTML canvas element showing the current video frame, or the previous frame if in a seek / loop.
   * Primarily for use by {@link easeljs.Bitmap}.
   */
  getImage () {
  	if (this.readyState < 2) { return; }
  	let canvas = this._canvas, video = this._video;
  	if (!canvas) {
			canvas = this._canvas = createCanvas();
  		canvas.width = video.videoWidth;
  		canvas.height = video.videoHeight;
  	}
  	if (video.readyState >= 2 && video.currentTime !== this._lastTime) {
  		const ctx = canvas.getContext("2d");
  		ctx.clearRect(0, 0, canvas.width, canvas.height);
  		ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  		this._lastTime = video.currentTime;
  	}
  	return canvas;
  }

  /**
   * @protected
   */
  _videoReady () {
  	this.readyState = 2;
  }

}
