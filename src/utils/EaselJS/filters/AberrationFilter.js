/**
 * AberrationFilter
 * Visit http://createjs.com/ for documentation, updates and examples.
 *
 * Copyright (c) 2019 gskinner.com, inc.
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
 *
 * @license
 */

import Filter from "./Filter";

/**
 * Separates and pushes each of the colour channels apart. I.E. shift the red channel slightly left.
 * Allows specifying the direction and the ammount it affects each channel. Great for computer glitches and VCR like
 * effects.
 *
 * @memberof easeljs
 * @extends easeljs.Filter
 */
export default class AberrationFilter extends Filter {

	/**
	 * @param {Number} [xDir=0] Movement in x at a multiplier of 1, specified in pixels.
	 * @param {Number} [yDir=0] Movement in y at a multiplier of 1, specified in pixels.
	 * @param {Number} [redMultiplier=0] Multiplier for the movement of the Red channel. Negative values allowed.
	 * @param {Number} [greenMultiplier=0] Multiplier for the movement of the Green channel. Negative values allowed.
	 * @param {Number} [blueMultiplier=0] Multiplier for the movement of the Blue channel. Negative values allowed.
	 * @param {Number} [originalMix=0] Amount of original image to keep, 0-1.
	 * @param {Boolean} [alphaMax=false] Calculate combined alpha using maximum alpha available. Creates a stronger image.
	 */
	constructor(xDir = 0, yDir = 0, redMultiplier = 0, greenMultiplier = 0, blueMultiplier = 0, originalMix = 0, alphaMax = false) {
		super();

		this.xDir = Number(xDir);
		this.yDir = Number(yDir);

		this.redMultiplier = Number(redMultiplier);
		this.greenMultiplier = Number(greenMultiplier);
		this.blueMultiplier = Number(blueMultiplier);

		this.originalMix = Math.min(Math.max(originalMix, 0), 1);;
		this._alphaMax = alphaMax;

		this.FRAG_SHADER_BODY = (
			"uniform vec2 uColorDirection;" +
			"uniform vec3 uColorMultiplier;" +
			"uniform vec2 uExtraProps;" +

			"void main(void) {" +
				"vec4 sample = texture2D(" +
					"uSampler, " +
					"vTextureCoord" +
				");" +
				"vec4 rSample = texture2D(" +
					"uSampler, " +
					"vTextureCoord + (uColorDirection * uColorMultiplier.r)" +
				");" +
				"vec4 gSample = texture2D(" +
					"uSampler, " +
					"vTextureCoord + (uColorDirection * uColorMultiplier.g)" +
				");" +
				"vec4 bSample = texture2D(" +
					"uSampler, " +
					"vTextureCoord + (uColorDirection * uColorMultiplier.b)" +
				");" +

				"float newAlpha = " + (alphaMax ?
					"max(rSample.a, max(gSample.a, max(bSample.a, sample.a)))" :
					"(rSample.a + gSample.a + bSample.a) / 3.0"
				) + ";" +
				"vec4 result = vec4(" +
					"min(1.0, rSample.r/(rSample.a+0.00001)) * newAlpha, " +
					"min(1.0, gSample.g/(gSample.a+0.00001)) * newAlpha, " +
					"min(1.0, bSample.b/(bSample.a+0.00001)) * newAlpha, " +
					"newAlpha" +
				");" +
				"gl_FragColor = mix(result, sample, uExtraProps[0]*sample.a);" +
			"}"
		);
	}

	/**
	 * @param {WebGLRenderingContext} gl
	 * @param {easeljs.StageGL} stage
	 * @param {String} shaderProgram
	 */
	shaderParamSetup(gl, stage, shaderProgram) {
		gl.uniform2f(
			gl.getUniformLocation(shaderProgram, "uColorDirection"),
			this.xDir * (1 / stage._viewportWidth), this.yDir * (1 / -stage._viewportHeight)
		);

		gl.uniform3f(
			gl.getUniformLocation(shaderProgram, "uColorMultiplier"),
			-this.redMultiplier,
			-this.greenMultiplier,
			-this.blueMultiplier
		);

		gl.uniform2f(
			gl.getUniformLocation(shaderProgram, "uExtraProps"),
			this.originalMix, 0
		);
	}

	/**
	 * @param {Object} imageData
	 */
	_applyFilter(imageData) {
		const refPixels = imageData.data.slice();
		const outPixels = imageData.data;
		const width = imageData.width;
		const height = imageData.height;
		let offset, pixel;

		for (let i = 0; i < height; i++) {
			offset = i * width;
			for (let j = 0; j < width; j++) {
				pixel = (offset + j) * 4;

				let redX = j + ((this.xDir * -this.redMultiplier) | 0),
						redY = i + ((this.yDir * -this.redMultiplier) | 0),
			 			grnX = j + ((this.xDir * -this.greenMultiplier) | 0),
						grnY = i + ((this.yDir * -this.greenMultiplier) | 0),
			 			bluX = j + ((this.xDir * -this.blueMultiplier) | 0),
						bluY = i + ((this.yDir * -this.blueMultiplier) | 0);

				if (redX < 0) { redX = 0; }
				if (redX >= width) { redX = width - 1; }
				if (redY < 0) { redY = 0; }
				if (redY >= height) { redY = height - 1; }

				if (grnX < 0) { grnX = 0; }
				if (grnX >= width) { grnX = width - 1; }
				if (grnY < 0) { grnY = 0; }
				if (grnY >= height) { grnY = height - 1; }

				if (bluX < 0) { bluX = 0; }
				if (bluX >= width) { bluX = width - 1; }
				if (bluY < 0) { bluY = 0; }
				if (bluY >= height) { bluY = height - 1; }

				const redPixel = ((redY * width) + redX) * 4;
				 			grnPixel = ((grnY * width) + grnX) * 4;
				 			bluPixel = ((bluY * width) + bluX) * 4;

				outPixels[pixel] = refPixels[redPixel];
				outPixels[pixel+1] = refPixels[grnPixel+1];
				outPixels[pixel+2] = refPixels[bluPixel+2];
				outPixels[pixel+3] = (
					this._alphaMax
						?	Math.max(refPixels[redPixel + 3], refPixels[grnPixel + 3], refPixels[bluPixel + 3])
						: (refPixels[redPixel + 3] + refPixels[grnPixel + 3] + refPixels[bluPixel + 3]) / 3
				);
			}
		}

		return true;
	}

}
