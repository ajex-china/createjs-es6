/**
 * @license ColorMatrix
 * Visit http://createjs.com/ for documentation, updates and examples.
 *
 * Copyright (c) 2017 gskinner.com, inc.
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

/**
 * Provides helper functions for assembling a matrix for use with the {@link easeljs.ColorMatrixFilter}.
 * Most methods return the instance to facilitate chained calls.
 *
 * @memberof easeljs
 * @example
 * colorMatrix.adjustHue(20).adjustBrightness(50);
 *
 * @param {Number} brightness
 * @param {Number} contrast
 * @param {Number} saturation
 * @param {Number} hue
 */
export default class ColorMatrix {

	constructor (brightness, contrast, saturation, hue) {
		this.setColor(brightness, contrast, saturation, hue);
	}

	/**
	 * Create an instance of ColorMatrix using the Sepia preset
	 * @returns {easeljs.ColorMatrix}
	 */
	static createSepiaPreset() {
		return new ColorMatrix().copy([
			0.4977, 0.9828, 0.1322, 0.0000, 14,
			0.4977, 0.9828, 0.1322, 0.0000, -14,
			0.4977, 0.9828, 0.1322, 0.0000, -47,
			0.0000, 0.0000, 0.0000, 1.0000, 0,
			0, 0, 0, 0, 1
		]);
	};

 	/**
	 * Create an instance of ColorMatrix using an invert color preset
	 * @returns {easeljs.ColorMatrix}
	 */
	static createInvertPreset() {
		return new ColorMatrix().copy([
			-1.0000, 0.0000, 0.0000, 0.0000, 255,
			0.0000, -1.0000, 0.0000, 0.0000, 255,
			0.0000, 0.0000, -1.0000, 0.0000, 255,
			0.0000, 0.0000, 0.0000, 1.0000, 0,
			0, 0, 0, 0, 1
		]);
	};

 	/**
	 * Create an instance of ColorMatrix using the Greyscale preset.
	 * Note: -100 saturation accounts for perceived brightness, the greyscale preset treats all channels equally.
	 * @returns {easeljs.ColorMatrix}
	 */
	static createGreyscalePreset() {
		return new ColorMatrix().copy([
			0.3333, 0.3334, 0.3333, 0.0000, 0,
			0.3333, 0.3334, 0.3333, 0.0000, 0,
			0.3333, 0.3334, 0.3333, 0.0000, 0,
			0.0000, 0.0000, 0.0000, 1.0000, 0,
			0, 0, 0, 0, 1
		]);
	};

	/**
	 * Resets the instance with the specified values.
	 * @param {Number} brightness
	 * @param {Number} contrast
	 * @param {Number} saturation
	 * @param {Number} hue
	 * @return {easeljs.ColorMatrix} The ColorMatrix instance the method is called on (useful for chaining calls.)
	 * @chainable
	 */
	setColor (brightness, contrast, saturation, hue) {
		return this.reset().adjustColor(brightness, contrast, saturation, hue);
	}

	/**
	 * Resets the matrix to identity values.
	 * @return {easeljs.ColorMatrix} The ColorMatrix instance the method is called on (useful for chaining calls.)
	 * @chainable
	 */
	reset () {
		return this.copy(ColorMatrix.IDENTITY_MATRIX);
	}

	/**
	 * Shortcut method to adjust brightness, contrast, saturation and hue. Equivalent to calling adjustHue(hue), adjustContrast(contrast),
	 * adjustBrightness(brightness), adjustSaturation(saturation), in that order.
	 * @param {Number} brightness
	 * @param {Number} contrast
	 * @param {Number} saturation
	 * @param {Number} hue
	 * @return {easeljs.ColorMatrix} The ColorMatrix instance the method is called on (useful for chaining calls.)
	 * @chainable
	 */
	adjustColor (brightness, contrast, saturation, hue) {
		return this.adjustBrightness(brightness).adjustContrast(contrast).adjustSaturation(saturation).adjustHue(hue);
	}

	/**
	 * Adjusts the brightness of pixel color by adding the specified value to the red, green and blue channels.
	 * Positive values will make the image brighter, negative values will make it darker.
	 * @param {Number} value A value between -255 & 255 that will be added to the RGB channels.
	 * @return {easeljs.ColorMatrix} The ColorMatrix instance the method is called on (useful for chaining calls.)
	 * @chainable
	 */
	adjustBrightness (value) {
		if (value === 0 || isNaN(value)) { return this; }
		value = this._cleanValue(value, 255);
		this._multiplyMatrix([
			1,0,0,0,value,
			0,1,0,0,value,
			0,0,1,0,value,
			0,0,0,1,0,
			0,0,0,0,1
		]);
		return this;
	}

	/**
	 * Adjusts the colour offset of pixel color by adding the specified value to the red, green and blue channels.
	 * Positive values will make the image brighter, negative values will make it darker.
	 * @param {Number} r A value between -255 & 255 that will be added to the Red channel.
	 * @param {Number} g A value between -255 & 255 that will be added to the Green channel.
	 * @param {Number} b A value between -255 & 255 that will be added to the Blue channel.
	 * @return {easeljs.ColorMatrix} The ColorMatrix instance the method is called on (useful for chaining calls.)
	 * @chainable
	 */
	adjustOffset(r, g, b) {
		if (isNaN(r) || isNaN(g) || isNaN(b)) { return this; }
		this[4] = this._cleanValue(this[4] + r, 255);
		this[9] = this._cleanValue(this[9] + g, 255);
		this[14] = this._cleanValue(this[14] + b, 255);
		return this;
	}

	/**
	 * Adjusts the contrast of pixel color.
	 * Positive values will increase contrast, negative values will decrease contrast.
	 * @param {Number} value A value between -100 & 100.
	 * @return {easeljs.ColorMatrix} The ColorMatrix instance the method is called on (useful for chaining calls.)
	 * @chainable
	 */
	adjustContrast (value) {
		if (value === 0 || isNaN(value)) { return this; }
		value = this._cleanValue(value, 100);
		let x;
		if (value<0) {
			x = 127+value/100*127;
		} else {
			x = value%1;
			if (x === 0) {
				x = ColorMatrix.DELTA_INDEX[value];
			} else {
				x = ColorMatrix.DELTA_INDEX[(value<<0)]*(1-x)+ColorMatrix.DELTA_INDEX[(value<<0)+1]*x; // use linear interpolation for more granularity.
			}
			x = x*127+127;
		}
		this._multiplyMatrix([
			x/127,0,0,0,0.5*(127-x),
			0,x/127,0,0,0.5*(127-x),
			0,0,x/127,0,0.5*(127-x),
			0,0,0,1,0,
			0,0,0,0,1
		]);
		return this;
	}

	/**
	 * Adjusts the color saturation of the pixel.
	 * Positive values will increase saturation, negative values will decrease saturation (trend towards greyscale).
	 * @param {Number} value A value between -100 & 100.
	 * @return {easeljs.ColorMatrix} The ColorMatrix instance the method is called on (useful for chaining calls.)
	 * @chainable
	 */
	adjustSaturation (value) {
		if (value === 0 || isNaN(value)) { return this; }
		value = this._cleanValue(value, 100);
		let x = 1+((value > 0) ? 3*value/100 : value/100);
		let lumR = 0.3086;
		let lumG = 0.6094;
		let lumB = 0.0820;
		this._multiplyMatrix([
			lumR*(1-x)+x,lumG*(1-x),lumB*(1-x),0,0,
			lumR*(1-x),lumG*(1-x)+x,lumB*(1-x),0,0,
			lumR*(1-x),lumG*(1-x),lumB*(1-x)+x,0,0,
			0,0,0,1,0,
			0,0,0,0,1
		]);
		return this;
	}


	/**
	 * Adjusts the hue of the pixel color.
	 * @param {Number} value A value between -180 & 180.
	 * @return {easeljs.ColorMatrix} The ColorMatrix instance the method is called on (useful for chaining calls.)
	 * @chainable
	 */
	adjustHue (value) {
		if (value === 0 || isNaN(value)) { return this; }
		value = this._cleanValue(value, 180)/180*Math.PI;
		let cosVal = Math.cos(value);
		let sinVal = Math.sin(value);
		let lumR = 0.213;
		let lumG = 0.715;
		let lumB = 0.072;
		this._multiplyMatrix([
			lumR+cosVal*(1-lumR)+sinVal*(-lumR),lumG+cosVal*(-lumG)+sinVal*(-lumG),lumB+cosVal*(-lumB)+sinVal*(1-lumB),0,0,
			lumR+cosVal*(-lumR)+sinVal*(0.143),lumG+cosVal*(1-lumG)+sinVal*(0.140),lumB+cosVal*(-lumB)+sinVal*(-0.283),0,0,
			lumR+cosVal*(-lumR)+sinVal*(-(1-lumR)),lumG+cosVal*(-lumG)+sinVal*(lumG),lumB+cosVal*(1-lumB)+sinVal*(lumB),0,0,
			0,0,0,1,0,
			0,0,0,0,1
		]);
		return this;
	}

	/**
	 * Concatenates (multiplies) the specified matrix with this one.
	 * @param {Array} matrix An array or ColorMatrix instance.
	 * @return {easeljs.ColorMatrix} The ColorMatrix instance the method is called on (useful for chaining calls.)
	 * @chainable
	 */
	concat (matrix) {
		matrix = this._fixMatrix(matrix);
		if (matrix.length != ColorMatrix.LENGTH) { return this; }
		this._multiplyMatrix(matrix);
		return this;
	}

	/**
	 * @return {easeljs.ColorMatrix} A clone of this ColorMatrix.
	 */
	clone () {
		return (new ColorMatrix()).copy(this);
	}

	/**
	 * Return a length 25 (5x5) array instance containing this matrix's values.
	 * @return {Array} An array holding this matrix's values.
	 */
	toArray () {
		const arr = [];
		const l = ColorMatrix.LENGTH;
		for (let i=0; i<l; i++) {
			arr[i] = this[i];
		}
		return arr;
	}

	/**
	 * Copy the specified matrix's values to this matrix.
	 * @param {Array | easeljs.ColorMatrix} matrix An array or ColorMatrix instance.
	 * @return {easeljs.ColorMatrix} The ColorMatrix instance the method is called on (useful for chaining calls.)
	 * @chainable
	 */
	copy (matrix) {
		const l = ColorMatrix.LENGTH;
		for (let i=0;i<l;i++) {
			this[i] = matrix[i];
		}
		return this;
	}

	/**
	 * Returns a string representation of this object.
	 * @return {String} a string representation of the instance.
	 */
	toString () {
		return `
			[ColorMatrix] {
				${this[0].toFixed(4)}, ${this[1].toFixed(4)}, ${this[2].toFixed(4)}, ${this[3].toFixed(4)}, ${(this[4]|0)},
				${this[5].toFixed(4)}, ${this[6].toFixed(4)}, ${this[7].toFixed(4)}, ${this[8].toFixed(4)}, ${(this[9]|0)},
				${this[10].toFixed(4)}, ${this[11].toFixed(4)}, ${this[12].toFixed(4)}, ${this[13].toFixed(4)}, ${(this[14]|0)},
				${this[15].toFixed(4)}, ${this[16].toFixed(4)}, ${this[17].toFixed(4)}, ${this[18].toFixed(4)}, ${(this[19]|0)},
				${this[20]|0}, ${this[21]|0}, ${this[22]|0}, ${this[23]|0}, ${this[24]|0}
			}
		`;
	}

	/**
	 * @param {Array} matrix
	 * @protected
	 */
	_multiplyMatrix (matrix) {
		let col = [];

		for (let i=0;i<5;i++) {
			for (let j=0;j<5;j++) {
				col[j] = this[j+i*5];
			}
			for (let j=0;j<5;j++) {
				let val=0;
				for (let k=0;k<5;k++) {
					val += matrix[j+k*5]*col[k];
				}
				this[j+i*5] = val;
			}
		}
	}

	/**
	 * Make sure values are within the specified range, hue has a limit of 180, brightness is 255, others are 100.
	 * @param {Number} value The raw number
	 * @param {Number} limit The maximum that the number can be. The minimum is the limit * -1.
	 * @protected
	 */
	_cleanValue (value, limit) {
		return Math.min(limit, Math.max(-limit, value));
	}

	/**
	 * Makes sure matrixes are 5x5 (25 long).
	 * @param {Array} matrix
	 * @protected
	 */
	_fixMatrix (matrix) {
		if (matrix instanceof ColorMatrix) { matrix = matrix.toArray(); }
		if (matrix.length < ColorMatrix.LENGTH) {
			matrix = matrix.slice(0, matrix.length).concat(ColorMatrix.IDENTITY_MATRIX.slice(matrix.length, ColorMatrix.LENGTH));
		} else if (matrix.length > ColorMatrix.LENGTH) {
			matrix = matrix.slice(0, ColorMatrix.LENGTH);
		}
		return matrix;
	}

}

/**
 * Array of delta values for contrast calculations.
 * @type {Array<Number>}
 * @protected
 * @readonly
 * @static
 */
ColorMatrix.DELTA_INDEX = Object.freeze([
 	0,    0.01, 0.02, 0.04, 0.05, 0.06, 0.07, 0.08, 0.1,  0.11,
 	0.12, 0.14, 0.15, 0.16, 0.17, 0.18, 0.20, 0.21, 0.22, 0.24,
 	0.25, 0.27, 0.28, 0.30, 0.32, 0.34, 0.36, 0.38, 0.40, 0.42,
 	0.44, 0.46, 0.48, 0.5,  0.53, 0.56, 0.59, 0.62, 0.65, 0.68,
 	0.71, 0.74, 0.77, 0.80, 0.83, 0.86, 0.89, 0.92, 0.95, 0.98,
 	1.0,  1.06, 1.12, 1.18, 1.24, 1.30, 1.36, 1.42, 1.48, 1.54,
 	1.60, 1.66, 1.72, 1.78, 1.84, 1.90, 1.96, 2.0,  2.12, 2.25,
 	2.37, 2.50, 2.62, 2.75, 2.87, 3.0,  3.2,  3.4,  3.6,  3.8,
 	4.0,  4.3,  4.7,  4.9,  5.0,  5.5,  6.0,  6.5,  6.8,  7.0,
 	7.3,  7.5,  7.8,  8.0,  8.4,  8.7,  9.0,  9.4,  9.6,  9.8,
 	10.0
]);
/**
 * Identity matrix values.
 * @type {Array<Number>}
 * @protected
 * @readonly
 * @static
 */
ColorMatrix.IDENTITY_MATRIX = Object.freeze([
 	1,0,0,0,0,
 	0,1,0,0,0,
 	0,0,1,0,0,
 	0,0,0,1,0,
 	0,0,0,0,1
]);
/**
 * The constant length of a color matrix.
 * @type {Number}
 * @protected
 * @readonly
 * @static
 */
ColorMatrix.LENGTH = 25;
