import Stage from "./Stage";
import Container from "./Container";
import shaders from "../gl/shaders";
import Matrix2D from "@/utils/EaselJS/geom/Matrix2D.js";
import Filter from "@/utils/EaselJS/filters/Filter.js";
import BitmapCache from "@/utils/EaselJS/filters/BitmapCache.js";
export default class AJStageGL extends Stage {

	constructor(canvas,options = {}) {
		super(canvas);
		const {
			premultiply = false,
			transparent = false,
			antialias = false,
			preserveBuffer = false,
			autoPurge = undefined,
		} = options;
		this.vocalDebug = false;
		this._preserveBuffer = preserveBuffer;
		this._antialias = antialias;
		this._transparent = transparent;
		this._premultiply = premultiply;
		this._autoPurge = autoPurge;
		this._viewportWidth = 0;
		this._viewportHeight = 0;
		this._projectionMatrix = null;
		this._webGLContext = null;
		this._clearColor = {r: 0.50, g: 0.50, b: 0.50, a: 0.00};
		this._maxCardsPerBatch = AJStageGL.DEFAULT_MAX_BATCH_SIZE;														//TODO: write getter/setters for this
		this._activeShader = null;
		this._vertices = null;
		this._vertexPositionBuffer = null;
		this._uvs = null;
		this._uvPositionBuffer = null;
		this._indices = null;
		this._textureIndexBuffer = null;
		this._alphas = null;
		this._alphaBuffer = null;
		this._textureDictionary = [];
		this._textureIDs = {};
		this._batchTextures = [];
		this._baseTextures = [];
		this._batchTextureCount = 8;
		this._lastTextureInsert = -1;
		this._batchID = 0;
		this._drawID = 0;
		this._slotBlacklist = [];
		this._isDrawing = 0;
		this._lastTrackedCanvas = 0;
		this.isCacheControlled = false;
		this._cacheContainer = new Container()

		// and begin
		this._initializeWebGL();
	}

	static buildUVRects(spritesheet, target = -1, onlyTarget = false) {
		if (!spritesheet || !spritesheet._frames) { return null; }

		let i = target !== -1 && onlyTarget ? target : 0;
		let end = target !== -1 && onlyTarget ? target + 1 : spritesheet._frames.length;

		for (; i<end; i++) {
			let f = spritesheet._frames[i];
			if (f.uvRect || f.image.width <= 0 || f.image.height <= 0) { continue; }

			let r = f.rect;
			f.uvRect = {
				t: 1 - (r.y / f.image.height),
				l: r.x / f.image.width,
				b: 1 - ((r.y + r.height) / f.image.height),
				r: (r.x + r.width) / f.image.width
			};
		}

		return spritesheet._frames[target !== -1 ? target : 0].uvRect || {t:0, l:0, b:1, r:1};
	}

	static isWebGLActive(ctx) {
		return ctx &&
			ctx instanceof WebGLRenderingContext &&
			typeof WebGLRenderingContext !== "undefined";
	}

	static colorToObj(color) {
		let r, g, b, a;

		if (typeof color === "string") {
			if (color.indexOf("#") === 0) {
				if (color.length === 4) {
					color = `#${color.charAt(1)+color.charAt(1)+color.charAt(2)+color.charAt(2)+color.charAt(3)+color.charAt(3)}`;
				}
				r = Number(`0x${color.slice(1, 3)}`) / 255;
				g = Number(`0x${color.slice(3, 5)}`) / 255;
				b = Number(`0x${color.slice(5, 7)}`) / 255;
				a = Number(`0x${color.slice(7, 9)}`) / 255;
			} else if (color.indexOf("rgba(") === 0) {
				let output = color.slice(5, -1).split(",");
				r = Number(output[0]) / 255;
				g = Number(output[1]) / 255;
				b = Number(output[2]) / 255;
				a = Number(output[3]);
			}
		} else {
			// >>> is an unsigned shift which is what we want as 0x80000000 and up are negative values
			r = ((color & 0xFF000000) >>> 24) / 255;
			g = ((color & 0x00FF0000) >>> 16) / 255;
			b = ((color & 0x0000FF00) >>> 8) / 255;
			a = (color & 0x000000FF) / 255;
		}
		return {
			r: Math.min(Math.max(0, r), 1),
			g: Math.min(Math.max(0, g), 1),
			b: Math.min(Math.max(0, b), 1),
			a: Math.min(Math.max(0, a), 1)
		}
	}

	get isWebGL() {
		return !!this._webGLContext;
	}

	get autoPurge() {
		return this._autoPurge;
	}
	set autoPurge(value) {
		value = isNaN(value) ? 1200 : value;
		if (value !== -1) {
			value = Math.max(value, 10);
		}
		this._autoPurge = value;
	}

	_initializeWebGL() {
		if (this.canvas) {
			if (!this._webGLContext || this._webGLContext.canvas !== this.canvas) {
				// A context hasn't been defined yet,
				// OR the defined context belongs to a different canvas, so reinitialize.

				// defaults and options
				let options = {
					depth: false, // Disable the depth buffer as it isn't used.
					alpha: this._transparent, // Make the canvas background transparent.
					stencil: true,
					antialias: this._antialias,
					premultipliedAlpha: this._premultiply, // Assume the drawing buffer contains colors with premultiplied alpha.
					preserveDrawingBuffer: this._preserveBuffer
				};

				let gl = this._webGLContext = this._fetchWebGLContext(this.canvas, options);
				if (!gl) { return null; }

				this.updateSimultaneousTextureCount(gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS));
				this._maxTextureSlots = gl.getParameter(gl.MAX_COMBINED_TEXTURE_IMAGE_UNITS);
				this._createBuffers(gl);
				this._initTextures(gl);

				gl.disable(gl.DEPTH_TEST);
				gl.enable(gl.BLEND);
				gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
				gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, this._premultiply);
				//gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);

				this._webGLContext.clearColor(this._clearColor.r, this._clearColor.g, this._clearColor.b, this._clearColor.a);
				this.updateViewport(this._viewportWidth || this.canvas.width, this._viewportHeight || this.canvas.height);
			}
		} else {
			this._webGLContext = null;
		}
		return this._webGLContext;
	}

	update(props) {
		if (!this.canvas) { return; }
		if (this.tickOnUpdate) { this.tick(props); }
		this.dispatchEvent("drawstart");
		if (this.autoClear) { this.clear(); }

		if (this._webGLContext) {
			// Use WebGL.
			this._batchDraw(this, this._webGLContext);
			if (this._autoPurge != -1 && !(this._drawID%((this._autoPurge/2)|0))) {
				this.purgeTextures(this._autoPurge);
			}
		} else {
			// Use 2D.
			let ctx = this.canvas.getContext("2d");
			ctx.save();
			this.updateContext(ctx);
			this.draw(ctx, false);
			ctx.restore();
		}
		this.dispatchEvent("drawend");
	}

	clear() {
		if (!this.canvas) { return; }
		if (AJStageGL.isWebGLActive(this._webGLContext)) {
			let gl = this._webGLContext;
			let cc = this._clearColor;
			let adjust = this._transparent ? cc.a : 1.0;
			// Use WebGL settings; adjust for pre multiplied alpha appropriate to scenario
			this._webGLContext.clearColor(cc.r * adjust, cc.g * adjust, cc.b * adjust, adjust);
			gl.clear(gl.COLOR_BUFFER_BIT);
			this._webGLContext.clearColor(cc.r, cc.g, cc.b, cc.a);
		} else {
			// Use 2D.
			this.Stage_clear();
		}
	}

	draw(context, ignoreCache = false) {
		if (context === this._webGLContext && AJStageGL.isWebGLActive(this._webGLContext)) {
			let gl = this._webGLContext;
			this._batchDraw(this, gl, ignoreCache);
			return true;
		} else {
			return super.draw(context, ignoreCache);
		}
	}

	cacheDraw(target, manager) {
		// 2D context fallback
		if (!AJStageGL.isWebGLActive(this._webGLContext)) {
			return false;
		}

		for (let i = 0; i < this._gpuTextureCount; i++) {
			if (this._batchTextures[i]._frameBuffer) {
				this._batchTextures[i] = this._baseTextures[i];
			}
		}

		let storeBatchOutput = this._batchTextureOutput;
		let storeBatchConcat = this._batchTextureConcat;
		let storeBatchTemp = this._batchTextureTemp;

		let filterCount = manager._filterCount, filtersLeft = filterCount;
		let backupWidth = this._viewportWidth, backupHeight = this._viewportHeight;
		this._updateDrawingSurface(manager._drawWidth, manager._drawHeight);

		this._batchTextureOutput = (manager._filterCount%2) ? manager._bufferTextureConcat : manager._bufferTextureOutput;
		this._batchTextureConcat = (manager._filterCount%2) ? manager._bufferTextureOutput : manager._bufferTextureConcat;
		this._batchTextureTemp = manager._bufferTextureTemp;

		let container = this._cacheContainer;
		container.children = [target];
		container.transformMatrix = this._alignTargetToCache(target, manager);

		this._updateRenderMode("source-over");
		this._drawContent(container, true);

		// re-align buffers with fake filter passes to solve certain error cases
		if (this.isCacheControlled) {
			// post filter pass to place content into output buffer
			// TODO: add in directDraw support for cache controlled StageGLs
			filterCount++;
			filtersLeft++;
		} else if (manager._cacheCanvas !== ((manager._filterCount % 2) ? this._batchTextureConcat : this._batchTextureOutput)) {
			// pre filter pass to align output, may of become misaligned due to composite operations
			filtersLeft++;
		}

		// warning: pay attention to where filtersLeft is modified, this is a micro-optimization
		while (filtersLeft) {
			let filter = manager._getGLFilter(filterCount - (filtersLeft--));
			let swap = this._batchTextureConcat;
			this._batchTextureConcat = this._batchTextureOutput;
			this._batchTextureOutput = (this.isCacheControlled && filtersLeft === 0) ? this : swap;
			this.batchReason = "filterPass";
			this._drawCover(this._batchTextureOutput._frameBuffer, this._batchTextureConcat, filter);
		}

		manager._bufferTextureOutput = this._batchTextureOutput;
		manager._bufferTextureConcat = this._batchTextureConcat;
		manager._bufferTextureTemp = this._batchTextureTemp;

		this._batchTextureOutput = storeBatchOutput;
		this._batchTextureConcat = storeBatchConcat;
		this._batchTextureTemp = storeBatchTemp;

		this._updateDrawingSurface(backupWidth, backupHeight);
		return true;
	}

	releaseTexture(item, safe = false) {
		let i, l;
		if (!item) { return; }

		// this is a container object
		if (item.children) {
			for (i = 0, l = item.children.length; i < l; i++) {
				this.releaseTexture(item.children[i], safe);
			}
		}

		// this has a cache canvas
		if (item.cacheCanvas) {
			item.uncache();
		}

		let foundImage = undefined;
		if (item._storeID !== undefined) {
			// this is a texture itself
			if (item === this._textureDictionary[item._storeID]) {
				this._killTextureObject(item);
				item._storeID = undefined;
				return;
			}

			// this is an image or canvas
			foundImage = item;
		} else if (item._webGLRenderStyle === 2) {
			// this is a Bitmap class
			foundImage = item.image;
		} else if (item._webGLRenderStyle === 1) {
			// this is a SpriteSheet, we can't tell which image we used from the list easily so remove them all!
			for (i = 0, l = item.spriteSheet._images.length; i < l; i++) {
				this.releaseTexture(item.spriteSheet._images[i], safe);
			}
			return;
		}

		// did we find anything
		if (foundImage === undefined) {
			if (this.vocalDebug) {
				console.log("No associated texture found on release");
			}
			return;
		}

		// remove it
		let texture = this._textureDictionary[foundImage._storeID];
		if (safe) {
			let data = texture._imageData;
			let index = data.indexOf(foundImage);
			if (index >= 0) { data.splice(index, 1); }
			foundImage._storeID = undefined;
			if (data.length === 0) { this._killTextureObject(texture); }
		} else {
			this._killTextureObject(texture);
		}
	}
	protectTextureSlot = function (id, lock) {
		if (id > this._maxTextureSlots || id < 0) {
			throw "Slot outside of acceptable range";
		}
		this._slotBlacklist[id] = !!lock;
	};
	getTargetRenderTexture = function (target, w, h) {
		let result, toggle = false;
		let gl = this._webGLContext;
		if (target.__lastRT !== undefined && target.__lastRT === target.__rtA) { toggle = true; }
		if (!toggle) {
			if (target.__rtA === undefined) {
				target.__rtA = this.getRenderBufferTexture(w, h);
			} else {
				if (w != target.__rtA._width || h != target.__rtA._height) {
					this.resizeTexture(target.__rtA, w, h);
				}
				this.setTextureParams(gl);
			}
			result = target.__rtA;
		} else {
			if (target.__rtB === undefined) {
				target.__rtB = this.getRenderBufferTexture(w, h);
			} else {
				if (w != target.__rtB._width || h != target.__rtB._height) {
					this.resizeTexture(target.__rtB, w, h);
				}
				this.setTextureParams(gl);
			}
			result = target.__rtB;
		}
		if (!result) {
			throw "Problems creating render textures, known causes include using too much VRAM by not releasing WebGL texture instances";
		}
		target.__lastRT = result;
		return result;
	};
	_initTextures = function () {
		//TODO: DHG: add a cleanup routine in here in case this happens mid stream

		// reset counters
		this._lastTextureInsert = -1;

		// clear containers
		this._textureDictionary = [];
		this._textureIDs = {};
		this._baseTextures = [];
		this._batchTextures = [];

		// fill in blanks as it helps the renderer be stable while textures are loading and reduces need for safety code
		for (let i=0; i<this._batchTextureCount;i++) {
			let tex = this.getBaseTexture();
			this._baseTextures[i] = this._batchTextures[i] = tex;
			if (!tex) {
				throw "Problems creating basic textures, known causes include using too much VRAM by not releasing WebGL texture instances";
			}
		}
	};
	updateSimultaneousTextureCount = function (count) {
		// TODO: DHG: make sure API works in all instances, may be some issues with buffers etc I haven't foreseen
		let gl = this._webGLContext;
		let success = false;

		if (count < 1 || isNaN(count)) { count = 1; }
		this._batchTextureCount = count;

		while (!success) {
			try {
				this._activeShader = this._fetchShaderProgram(gl);
				success = true;
			} catch(e) {
				if (this._batchTextureCount == 1) {
					throw "Cannot compile shader " + e;
				}

				this._batchTextureCount -= 4;
				if (this._batchTextureCount < 1) { this._batchTextureCount = 1; }

				if (this.vocalDebug) {
					console.log("Reducing desired texture count due to errors: " + this._batchTextureCount);
				}
			}
		}
	};
	purgeTextures(count = 100) {
		if (count == undefined){ count = 100; }

		let dict = this._textureDictionary;
		let l = dict.length;
		for (let i= 0; i<l; i++) {
			let item = dict[i];
			if (!item) { continue; }
			if (item._drawID + count <= this._drawID) {	// use draw not batch as draw is more indicative of time
				this._killTextureObject(item);
			}
		}
	}

	updateViewport(width, height) {
		this._viewportWidth = width|0;
		this._viewportHeight = height|0;
		let gl = this._webGLContext;

		if (gl) {
			gl.viewport(0, 0, this._viewportWidth, this._viewportHeight);

			// WebGL works with a -1,1 space on its screen. It also follows Y-Up
			// we need to flip the y, scale and then translate the co-ordinates to match this
			// additionally we offset into they Y so the polygons are inside the camera's "clipping" plane
			this._projectionMatrix = new Float32Array([
				2 / this._viewportWidth,	0,								0,							0,
				0,							-2 / this._viewportHeight,		1,							0,
				0,							0,								1,							0,
				-1,							1,								0.1,						0
			]);
			// create the flipped version for use with render texture flipping
			// DHG: this would be a slice/clone but some platforms don't offer them for Float32Array
			this._projectionMatrixFlip = new Float32Array([0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0]);
			this._projectionMatrixFlip.set(this._projectionMatrix);
			this._projectionMatrixFlip[5] *= -1;
			this._projectionMatrixFlip[13] *= -1;
		}
	}

	getFilterShader(filter = this) {
		if (!filter) { filter = this; }

		let gl = this._webGLContext;
		let targetShader = this._activeShader;

		if (filter._builtShader) {
			targetShader = filter._builtShader;
			if (filter.shaderParamSetup) {
				gl.useProgram(targetShader);
				filter.shaderParamSetup(gl, this, targetShader);
			}
		} else {
			try {
				targetShader = this._fetchShaderProgram(
					gl, "filter",
					filter.VTX_SHADER_BODY, filter.FRAG_SHADER_BODY,
					filter.shaderParamSetup && filter.shaderParamSetup.bind(filter)
				);
				filter._builtShader = targetShader;
				targetShader._name = filter.toString();
			} catch (e) {
				console && console.log("SHADER SWITCH FAILURE", e);
			}
		}
		return targetShader;
	}

	getBaseTexture(width = 1, height = 1) {
		width = Math.ceil(width > 0 ? width : 1);
		height = Math.ceil(height > 0 ? height : 1);

		let gl = this._webGLContext;
		let texture = gl.createTexture();
		this.resizeTexture(texture, width, height);
		this.setTextureParams(gl, false);

		return texture;
	}

	resizeTexture(texture, width, height) {
		if (texture.width === width && texture.height === height) { return; }

		let gl = this._webGLContext;
		gl.bindTexture(gl.TEXTURE_2D, texture);
		gl.texImage2D(
			gl.TEXTURE_2D,		// target
			0,								// level of detail
			gl.RGBA,					// internal format
			width, height, 0,	// width, height, border (only for array/null sourced textures)
			gl.RGBA,					// format (match internal format)
			gl.UNSIGNED_BYTE,	// type of texture(pixel color depth)
			null							// image data, we can do null because we're doing array data
		);

		// set its width and height for spoofing as an image and tracking
		texture.width = width;
		texture.height = height;
	}

	getRenderBufferTexture(width, height) {
		let gl = this._webGLContext;

		let renderTexture = this.getBaseTexture(w, h);
		if (!renderTexture) { return null; }

		let frameBuffer = gl.createFramebuffer();
		if (!frameBuffer) { return null; }

		// set its width and height for spoofing as an image and tracking
		renderTexture.width = width;
		renderTexture.height = height;

		// attach frame buffer to texture and provide cross links to look up each other
		gl.bindFramebuffer(gl.FRAMEBUFFER, frameBuffer);
		gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, renderTexture, 0);
		frameBuffer._renderTexture = renderTexture;
		renderTexture._frameBuffer = frameBuffer;

		// these keep track of themselves simply to reduce complexity of some lookup code
		renderTexture._storeID = this._textureDictionary.length;
		this._textureDictionary[renderTexture._storeID] = renderTexture;

		gl.bindFramebuffer(gl.FRAMEBUFFER, null);
		return renderTexture;
	}

	setTextureParams(gl, isPOT = false) {
		if (isPOT && this._antialias) {
			// non POT linear works in some devices, but performance is NOT good, investigate
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
		} else {
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
		}
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
	}

	setClearColor(color = 0x00000000) {
		this._clearColor = AJStageGL.colorToObj(color);
		if (!this._webGLContext) { return; }
		this._webGLContext.clearColor(this._clearColor.r, this._clearColor.g, this._clearColor.b, this._clearColor.a);
	}

	toDataURL(backgroundColor, mimeType = "image/png", encoderOptions = 0.92) {
		let gl = this._webGLContext;
		let clearBackup = this._clearColor;
		this.batchReason = "dataURL";

		if (!this.canvas) { return; }
		if (!AJStageGL.isWebGLActive(gl)) {
			return super.toDataURL(backgroundColor, mimeType, encoderOptions);
		}

		// if the buffer is preserved and we don't want a background we can just output what we have, otherwise we'll have to render it
		if (!this._preserveBuffer || backgroundColor !== undefined) {
			// render it onto the right background
			if (backgroundColor !== undefined) {
				this._clearColor = AJStageGL.colorToObj(backgroundColor);
			}
			this.clear();
			// if we're not using directDraw then we can just trust the last buffer content
			if(!this._directDraw) {
				this._drawCover(null, this._bufferTextureOutput);
			} else {
				console.log("No stored/useable gl render info, result may be incorrect if content was changed since render");
				this.draw(gl);
			}
		}

		// create the dataurl
		let dataURL = this.canvas.toDataURL(mimeType, encoderOptions);

		// reset the picture in the canvas
		if (!this._preserveBuffer || backgroundColor !== undefined) {
			if (backgroundColor !== undefined) {
				this._clearColor = clearBackup;
			}
			this.clear();
			if (!this._directDraw) {
				this._drawCover(null, this._bufferTextureOutput);
			} else {
				this.draw(gl);
			}
		}

		return dataURL;
	}

	_updateDrawingSurface(width, height) {
		this._viewportWidth = width;
		this._viewportHeight = height;

		this._webGLContext.viewport(0, 0, this._viewportWidth, this._viewportHeight);

		// WebGL works with a -1,1 space on its screen. It also follows Y-Up
		// we need to flip the y, scale and then translate the co-ordinates to match this
		// additionally we offset into they Y so the polygons are inside the camera's "clipping" plane
		this._projectionMatrix = new Float32Array([
			2 / width,	0,			0,			0,
			0,			-2 / height,	0,			0,
			0,			0,			1,			0,
			-1,			1,			0,			1
		]);
	}

	_getSafeTexture(width = 1, height = 1) {
		let texture = this.getBaseTexture(width, height);

		if (!texture) {
			let msg = "Problem creating texture, possible cause: using too much VRAM, please try releasing texture memory";
			(console.error && console.error(msg)) || console.log(msg);

			texture = this._baseTextures[0];
		}

		return texture;
	}

	_clearFrameBuffer(alpha) {
		let gl = this._webGLContext;
		let cc = this._clearColor;

		if (alpha > 0) { alpha = 1; }
		if (alpha < 0) { alpha = 0; }

		// Use WebGL settings; adjust for pre multiplied alpha appropriate to scenario
		gl.clearColor(cc.r * alpha, cc.g * alpha, cc.b * alpha, alpha);
		gl.clear(gl.COLOR_BUFFER_BIT);
		gl.clearColor(0, 0, 0, 0);
	}

	_fetchWebGLContext(canvas, options) {
		let gl;

		try {
			gl = canvas.getContext("webgl", options) || canvas.getContext("experimental-webgl", options);
		} catch (e) {
			// don't do anything in catch, null check will handle it
		}

		if (!gl) {
			let msg = "Could not initialize WebGL";
			console.error?console.error(msg):console.log(msg);
		} else {
			gl.viewportWidth = canvas.width;
			gl.viewportHeight = canvas.height;
		}

		return gl;
	}

	_fetchShaderProgram(gl, shaderName, customVTX, customFRAG, shaderParamSetup) {
		gl.useProgram(null);		// safety to avoid collisions

		// build the correct shader string out of the right headers and bodies
		var targetFrag, targetVtx;
		switch (shaderName) {
			case "filter":
				targetVtx = AJStageGL.COVER_VERTEX_HEADER + (customVTX || AJStageGL.COVER_VERTEX_BODY);
				targetFrag = AJStageGL.COVER_FRAGMENT_HEADER + (customFRAG || AJStageGL.COVER_FRAGMENT_BODY);
				break;
			case "particle": //TODO
				targetVtx = AJStageGL.REGULAR_VERTEX_HEADER + AJStageGL.PARTICLE_VERTEX_BODY;
				targetFrag = AJStageGL.REGULAR_FRAGMENT_HEADER + AJStageGL.PARTICLE_FRAGMENT_BODY;
				break;
			case "override":
				targetVtx = AJStageGL.REGULAR_VERTEX_HEADER + (customVTX || AJStageGL.REGULAR_VERTEX_BODY);
				targetFrag = AJStageGL.REGULAR_FRAGMENT_HEADER + (customFRAG || AJStageGL.REGULAR_FRAGMENT_BODY);
				break;
			case "regular":
			default:
				targetVtx = AJStageGL.REGULAR_VERTEX_HEADER + AJStageGL.REGULAR_VERTEX_BODY;
				targetFrag = AJStageGL.REGULAR_FRAGMENT_HEADER + AJStageGL.REGULAR_FRAGMENT_BODY;
				break;
		}

		// create the separate vars
		var vertexShader = this._createShader(gl, gl.VERTEX_SHADER, targetVtx);
		var fragmentShader = this._createShader(gl, gl.FRAGMENT_SHADER, targetFrag);

		// link them together
		var shaderProgram = gl.createProgram();
		gl.attachShader(shaderProgram, vertexShader);
		gl.attachShader(shaderProgram, fragmentShader);
		gl.linkProgram(shaderProgram);
		shaderProgram._type = shaderName;

		// check compile status
		if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
			gl.useProgram(this._activeShader);
			throw gl.getProgramInfoLog(shaderProgram);
		}

		// set up the parameters on the shader
		gl.useProgram(shaderProgram);
		switch (shaderName) {
			case "filter":
				// get the places in memory the shader is stored so we can feed information into them
				// then save it off on the shader because it's so tied to the shader itself
				shaderProgram.vertexPositionAttribute = gl.getAttribLocation(shaderProgram, "vertexPosition");
				gl.enableVertexAttribArray(shaderProgram.vertexPositionAttribute);

				shaderProgram.uvPositionAttribute = gl.getAttribLocation(shaderProgram, "uvPosition");
				gl.enableVertexAttribArray(shaderProgram.uvPositionAttribute);

				shaderProgram.samplerUniform = gl.getUniformLocation(shaderProgram, "uSampler");
				gl.uniform1i(shaderProgram.samplerUniform, 0);

				shaderProgram.uprightUniform = gl.getUniformLocation(shaderProgram, "uUpright");
				gl.uniform1f(shaderProgram.uprightUniform, 0);

				// if there's some custom attributes be sure to hook them up
				if (shaderParamSetup) {
					shaderParamSetup(gl, this, shaderProgram);
				}
				break;
			case "override":
			case "particle":
			case "regular":
			default:
				// get the places in memory the shader is stored so we can feed information into them
				// then save it off on the shader because it's so tied to the shader itself
				shaderProgram.vertexPositionAttribute = gl.getAttribLocation(shaderProgram, "vertexPosition");
				gl.enableVertexAttribArray(shaderProgram.vertexPositionAttribute);

				shaderProgram.uvPositionAttribute = gl.getAttribLocation(shaderProgram, "uvPosition");
				gl.enableVertexAttribArray(shaderProgram.uvPositionAttribute);

				shaderProgram.textureIndexAttribute = gl.getAttribLocation(shaderProgram, "textureIndex");
				gl.enableVertexAttribArray(shaderProgram.textureIndexAttribute);

				shaderProgram.alphaAttribute = gl.getAttribLocation(shaderProgram, "objectAlpha");
				gl.enableVertexAttribArray(shaderProgram.alphaAttribute);

				var samplers = [];
				for (var i = 0; i < this._batchTextureCount; i++) {
					samplers[i] = i;
				}

				shaderProgram.samplerData = samplers;
				shaderProgram.samplerUniform = gl.getUniformLocation(shaderProgram, "uSampler");
				gl.uniform1iv(shaderProgram.samplerUniform, samplers);

				shaderProgram.pMatrixUniform = gl.getUniformLocation(shaderProgram, "pMatrix");
				break;
		}

		gl.useProgram(this._activeShader);
		return shaderProgram;
	}

	_createShader(gl, type, str) {
		str = str.replace(/{{count}}/g, this._batchTextureCount);

		// resolve issue with no dynamic samplers by creating correct samplers in if else chain
		// TODO: WebGL 2.0 does not need this support
		let insert = "";
		for (var i = 1; i<this._batchTextureCount; i++) {
			insert += "} else if (indexPicker <= "+ i +".5) { color = texture2D(uSampler["+ i +"], vTextureCoord);";
		}
		str = str.replace(/{{alternates}}/g, insert);
		str = str.replace(/{{fragColor}}/g, this._premultiply ? AJStageGL.REGULAR_FRAG_COLOR_PREMULTIPLY : AJStageGL.REGULAR_FRAG_COLOR_NORMAL);

		// actually compile the shader
		let shader = gl.createShader(type);
		gl.shaderSource(shader, str);
		gl.compileShader(shader);

		// check compile status
		if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
			throw gl.getShaderInfoLog(shader);
		}

		return shader;
	}

	_createBuffers(gl) {
		let groupCount = this._maxCardsPerBatch * AJStageGL.INDICIES_PER_CARD;
		let groupSize, i, l;
		// the actual position information
		let vertexPositionBuffer = this._vertexPositionBuffer = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, vertexPositionBuffer);
		groupSize = 2;
		let vertices = this._vertices = new Float32Array(groupCount * groupSize);
		for (i=0, l=vertices.length; i<l; i+=groupSize) { vertices[i] = vertices[i+1] = 0; }
		gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.DYNAMIC_DRAW);
		vertexPositionBuffer.itemSize = groupSize;
		vertexPositionBuffer.numItems = groupCount;

		// where on the texture it gets its information
		let uvPositionBuffer = this._uvPositionBuffer = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, uvPositionBuffer);
		groupSize = 2;
		let uvs = this._uvs = new Float32Array(groupCount * groupSize);
		for (i=0, l=uvs.length; i<l; i+=groupSize) { uvs[i] = uvs[i+1] = 0; }
		gl.bufferData(gl.ARRAY_BUFFER, uvs, gl.DYNAMIC_DRAW);
		uvPositionBuffer.itemSize = groupSize;
		uvPositionBuffer.numItems = groupCount;

		// what texture it should use
		let textureIndexBuffer = this._textureIndexBuffer = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, textureIndexBuffer);
		groupSize = 1;
		let indices = this._indices = new Float32Array(groupCount * groupSize);
		for (i=0, l=indices.length; i<l; i++) { indices[i] = 0; }
		gl.bufferData(gl.ARRAY_BUFFER, indices, gl.DYNAMIC_DRAW);
		textureIndexBuffer.itemSize = groupSize;
		textureIndexBuffer.numItems = groupCount;

		// what alpha it should have
		let alphaBuffer = this._alphaBuffer = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, alphaBuffer);
		groupSize = 1;
		let alphas = this._alphas = new Float32Array(groupCount * groupSize);
		for (i=0, l=alphas.length; i<l; i++) { alphas[i] = 1; }
		gl.bufferData(gl.ARRAY_BUFFER, alphas, gl.DYNAMIC_DRAW);
		alphaBuffer.itemSize = groupSize;
		alphaBuffer.numItems = groupCount;
	}

	_initMaterials() {
		// reset counters
		this._lastTextureInsert = -1;

		// clear containers
		this._textureDictionary = [];
		this._textureIDs = {};
		this._baseTextures = [];
		this._batchTextures = [];

		// fill in blanks as it helps the renderer be stable while textures are loading and reduces need for safety code
		for (let i=0; i<this._batchTextureCount;i++) {
			let tex = this.getBaseTexture();
			this._baseTextures[i] = this._batchTextures[i] = tex;
			if (!tex) {
				throw "Problems creating basic textures, known causes include using too much VRAM by not releasing WebGL texture instances";
			}
		}
	}

	_loadTextureImage(gl, image) {
		let src = image.src;

		if (!src) {
			// one time canvas property setup
			image._isCanvas = true;
			src = image.src = "canvas_" + this._lastTrackedCanvas++;
		}

		// put the texture into our storage system
		let storeID = this._textureIDs[src];
		if (storeID === undefined) {
			storeID = this._textureIDs[src] = this._textureDictionary.length;
		}
		if (this._textureDictionary[storeID] === undefined) {
			this._textureDictionary[storeID] = this.getBaseTexture();
		}

		let texture = this._textureDictionary[storeID];

		if (texture) {
			// get texture params all set up
			texture._batchID = this._batchID;
			texture._storeID = storeID;
			texture._imageData = image;
			this._insertTextureInBatch(gl, texture);

			// get the data into the texture or wait for it to load
			image._storeID = storeID;
			if (image.complete || image.naturalWidth || image._isCanvas) {	// is it already loaded
				this._updateTextureImageData(gl, image);
			} else  {
				image.addEventListener("load", this._updateTextureImageData.bind(this, gl, image));
			}
		} else {
			// we really really should have a texture, try to recover the error by using a saved empty texture so we don't crash
			let msg = "Problem creating desired texture, known causes include using too much VRAM by not releasing WebGL texture instances";
			(console.error && console.error(msg)) || console.log(msg);

			texture = this._baseTextures[0];
			texture._batchID = this._batchID;
			texture._storeID = -1;
			texture._imageData = texture;
			this._insertTextureInBatch(gl, texture);
		}

		return texture;
	}

	_updateTextureImageData(gl, image) {
		// the image isn't loaded and isn't ready to be updated, because we don't set the invalid flag we should try again later
		let isNPOT = (image.width & image.width-1) || (image.height & image.height-1);
		let texture = this._textureDictionary[image._storeID];

		gl.activeTexture(gl.TEXTURE0 + texture._activeIndex);
		gl.bindTexture(gl.TEXTURE_2D, texture);

		texture.isPOT = !isNPOT;
		this.setTextureParams(gl, texture.isPOT);

		try {
			gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
		} catch(e) {
			var errString = "\nAn error has occurred. This is most likely due to security restrictions on WebGL images with local or cross-domain origins";
			if(console.error) {
				//TODO: LM: I recommend putting this into a log function internally, since you do it so often, and each is implemented differently.
				console.error(errString);
				console.error(e);
			} else if (console) {
				console.log(errString);
				console.log(e);
			}
		}

		image._invalid = false;

		texture._w = image.width;
		texture._h = image.height;

		if (this.vocalDebug) {
			if (isNPOT) {
				console.warn("NPOT(Non Power of Two) Texture: "+ image.src);
			}
			if (image.width > gl.MAX_TEXTURE_SIZE || image.height > gl.MAX_TEXTURE_SIZE){
				console && console.error("Oversized Texture: "+ image.width+"x"+image.height +" vs "+ gl.MAX_TEXTURE_SIZE +"max");
			}
		}
	}

	_insertTextureInBatch(gl, texture) {
		// if it wasn't used last batch
		if (this._batchTextures[texture._activeIndex] !== texture) {
			// we've got to find it a a spot.
			let found = -1;
			let start = (this._lastTextureInsert+1) % this._batchTextureCount;
			let look = start;
			do {
				if (this._batchTextures[look]._batchID != this._batchID && !this._slotBlacklist[look]) {
					found = look;
					break;
				}
				look = (look+1) % this._batchTextureCount;
			} while (look !== start);

			// we couldn't find anywhere for it go, meaning we're maxed out
			if (found === -1) {
				this.batchReason = "textureOverflow";
				this._drawBuffers(gl);		// <------------------------------------------------------------------------
				this.batchCardCount = 0;
				found = start;
			}

			// lets put it into that spot
			this._batchTextures[found] = texture;
			texture._activeIndex = found;
			var image = texture._imageData;
			if (image && image._invalid && texture._drawID !== undefined) {
				this._updateTextureImageData(gl, image);
			} else {
				gl.activeTexture(gl.TEXTURE0 + found);
				gl.bindTexture(gl.TEXTURE_2D, texture);
				this.setTextureParams(gl);
			}
			this._lastTextureInsert = found;
		} else {
			let image = texture._imageData;
			if (texture._storeID != undefined && image && image._invalid) {
				this._updateTextureImageData(gl, image);
			}
		}

		texture._drawID = this._drawID;
		texture._batchID = this._batchID;
	}

	_killTextureObject(tex) {
		if (!tex) { return; }
		let gl = this._webGLContext;

		// remove linkage
		if (tex._storeID !== undefined && tex._storeID >= 0) {
			this._textureDictionary[tex._storeID] = undefined;
			for (let n in this._textureIDs) {
				if (this._textureIDs[n] == tex._storeID) { delete this._textureIDs[n]; }
			}
			if(tex._imageData) { tex._imageData._storeID = undefined; }
			tex._imageData = tex._storeID = undefined;
		}

		// make sure to drop it out of an active slot
		if (tex._activeIndex !== undefined && this._batchTextures[tex._activeIndex] === tex) {
			this._batchTextures[tex._activeIndex] = this._baseTextures[tex._activeIndex];
		}

		// remove buffers if present
		try {
			if (tex._frameBuffer) { gl.deleteFramebuffer(tex._frameBuffer); }
			tex._frameBuffer = undefined;
		} catch(e) {
			/* suppress delete errors because it's already gone or didn't need deleting probably */
			if (this.vocalDebug) { console.log(e); }
		}

		// remove entry
		try {
			gl.deleteTexture(tex);
		} catch(e) {
			/* suppress delete errors because it's already gone or didn't need deleting probably */
			if (this.vocalDebug) { console.log(e); }
		}
	}
	_backupBatchTextures = function (restore, target) {
		let gl = this._webGLContext;

		if (!this._backupTextures) { this._backupTextures = []; }
		if (target === undefined) { target = this._backupTextures; }

		for (let i=0; i<this._batchTextureCount; i++) {
			gl.activeTexture(gl.TEXTURE0 + i);
			if (restore) {
				this._batchTextures[i] = target[i];
			} else {
				target[i] = this._batchTextures[i];
				this._batchTextures[i] = this._baseTextures[i];
			}
			gl.bindTexture(gl.TEXTURE_2D, this._batchTextures[i]);
			this.setTextureParams(gl, this._batchTextures[i].isPOT);
		}

		if (restore && target === this._backupTextures) { this._backupTextures = []; }
	};
	_batchDraw = function (sceneGraph, gl, ignoreCache) {
		if (this._isDrawing > 0) {
			this._drawBuffers(gl);
		}
		this._isDrawing++;
		this._drawID++;

		this.batchCardCount = 0;
		this.depth = 0;

		this._appendToBatchGroup(sceneGraph, gl, new Matrix2D(), this.alpha, ignoreCache);

		this.batchReason = "drawFinish";
		this._drawBuffers(gl);								// <--------------------------------------------------------
		this._isDrawing--;
	};
	_cacheDraw = function (gl, target, filters, manager) {
		/*
    Implicitly there are 4 modes to this function: filtered-sameContext, filtered-uniqueContext, sameContext, uniqueContext.
    Each situation must be handled slightly differently as 'sameContext' or 'uniqueContext' define how the output works,
    one drawing directly into the main context and the other drawing into a stored renderTexture respectively.
    When the draw is a 'filtered' draw, the filters are applied sequentially and will draw into saved textures repeatedly.
    Once the final filter is done the final output is treated depending upon whether it is a same or unique context.
    The internal complexity comes from reducing over-draw, shared code, and issues like textures needing to be flipped
    sometimes when written to render textures.
    */
		let renderTexture;
		let shaderBackup = this._activeShader;
		let blackListBackup = this._slotBlacklist;
		let lastTextureSlot = this._maxTextureSlots-1;
		let wBackup = this._viewportWidth, hBackup = this._viewportHeight;

		// protect the last slot so that we have somewhere to bind the renderTextures so it doesn't get upset
		this.protectTextureSlot(lastTextureSlot, true);

		// create offset container for drawing item
		let mtx = target.getMatrix();
		mtx = mtx.clone();
		mtx.scale(1/manager.scale, 1/manager.scale);
		mtx = mtx.invert();
		mtx.translate(-manager.offX/manager.scale*target.scaleX, -manager.offY/manager.scale*target.scaleY);
		let container = this._cacheContainer;
		container.children = [target];
		container.transformMatrix = mtx;

		this._backupBatchTextures(false);

		if (filters && filters.length) {
			this._drawFilters(target, filters, manager);
		} else {
			// is this for another stage or mine?
			if (this.isCacheControlled) {
				// draw item to canvas				I -> C
				gl.clear(gl.COLOR_BUFFER_BIT);
				this._batchDraw(container, gl, true);
			} else {
				gl.activeTexture(gl.TEXTURE0 + lastTextureSlot);
				target.cacheCanvas = this.getTargetRenderTexture(target, manager._drawWidth, manager._drawHeight);
				renderTexture = target.cacheCanvas;

				// draw item to render texture		I -> T
				gl.bindFramebuffer(gl.FRAMEBUFFER, renderTexture._frameBuffer);
				this.updateViewport(manager._drawWidth, manager._drawHeight);
				this._projectionMatrix = this._projectionMatrixFlip;
				gl.clear(gl.COLOR_BUFFER_BIT);
				this._batchDraw(container, gl, true);

				gl.bindFramebuffer(gl.FRAMEBUFFER, null);
				this.updateViewport(wBackup, hBackup);
			}
		}

		this._backupBatchTextures(true);

		this.protectTextureSlot(lastTextureSlot, false);
		this._activeShader = shaderBackup;
		this._slotBlacklist = blackListBackup;
	};
	_drawFilters = function (target, filters, manager) {
		let gl = this._webGLContext;
		let renderTexture;
		let lastTextureSlot = this._maxTextureSlots-1;
		let wBackup = this._viewportWidth, hBackup = this._viewportHeight;

		let container = this._cacheContainer;
		let filterCount = filters.length;

		// we don't know which texture slot we're dealing with previously and we need one out of the way
		// once we're using that slot activate it so when we make and bind our RenderTexture it's safe there
		gl.activeTexture(gl.TEXTURE0 + lastTextureSlot);
		renderTexture = this.getTargetRenderTexture(target, manager._drawWidth, manager._drawHeight);

		// draw item to render texture		I -> T
		gl.bindFramebuffer(gl.FRAMEBUFFER, renderTexture._frameBuffer);
		this.updateViewport(manager._drawWidth, manager._drawHeight);
		gl.clear(gl.COLOR_BUFFER_BIT);
		this._batchDraw(container, gl, true);

		// bind the result texture to slot 0 as all filters and cover draws assume original content is in slot 0
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, renderTexture);
		this.setTextureParams(gl);

		let flipY = false;
		let i = 0, filter = filters[i];
		do { // this is safe because we wouldn't be in apply filters without a filter count of at least 1

			// swap to correct shader
			this._activeShader = this.getFilterShader(filter);
			if (!this._activeShader) { continue; }

			// now the old result is stored in slot 0, make a new render texture
			gl.activeTexture(gl.TEXTURE0 + lastTextureSlot);
			renderTexture = this.getTargetRenderTexture(target, manager._drawWidth, manager._drawHeight);
			gl.bindFramebuffer(gl.FRAMEBUFFER, renderTexture._frameBuffer);

			// draw result to render texture	R -> T
			gl.viewport(0, 0, manager._drawWidth, manager._drawHeight);
			gl.clear(gl.COLOR_BUFFER_BIT);
			this._drawCover(gl, flipY);

			// bind the result texture to slot 0 as all filters and cover draws assume original content is in slot 0
			gl.activeTexture(gl.TEXTURE0);
			gl.bindTexture(gl.TEXTURE_2D, renderTexture);
			this.setTextureParams(gl);

			// use flipping to keep things upright, things already cancel out on a single filter
			// this needs to be here as multiPass is not accurate to _this_ frame until after shader acquisition
			if (filterCount > 1 || filters[0]._multiPass) {
				flipY = !flipY;
			}

			// work through the multipass if it's there, otherwise move on
			filter = filter._multiPass !== null ? filter._multiPass : filters[++i];
		} while (filter);

		// is this for another stage or mine
		if (this.isCacheControlled) {
			gl.bindFramebuffer(gl.FRAMEBUFFER, null);
			this.updateViewport(wBackup, hBackup);

			// draw result to canvas			R -> C
			this._activeShader = this.getFilterShader(this);
			gl.clear(gl.COLOR_BUFFER_BIT);
			this._drawCover(gl, flipY);
		} else {
			//TODO: DHG: this is less than ideal. A flipped initial render for this circumstance might help. Adjust the perspective matrix?
			if (flipY) {
				gl.activeTexture(gl.TEXTURE0 + lastTextureSlot);
				renderTexture = this.getTargetRenderTexture(target, manager._drawWidth, manager._drawHeight);
				gl.bindFramebuffer(gl.FRAMEBUFFER, renderTexture._frameBuffer);

				this._activeShader = this.getFilterShader(this);
				gl.viewport(0, 0, manager._drawWidth, manager._drawHeight);
				gl.clear(gl.COLOR_BUFFER_BIT);
				this._drawCover(gl, !flipY);
			}
			gl.bindFramebuffer(gl.FRAMEBUFFER, null);
			this.updateViewport(wBackup, hBackup);

			// make sure the last texture is the active thing to draw
			target.cacheCanvas = renderTexture;
		}
	};
	_setCoverMixShaderParams(gl, stage, shaderProgram) {
		gl.uniform1i(
			gl.getUniformLocation(shaderProgram, "uMixSampler"),
			1
		);
	}

	_updateRenderMode(newMode) {
		if (newMode === null || newMode === undefined) { newMode = "source-over"; }

		let blendSrc = shaders.blendSources[newMode];
		if (blendSrc === undefined) {
			if (this.vocalDebug){ console.log("Unknown compositeOperation ["+ newMode +"], reverting to default"); }
			blendSrc = shaders.blendSources[newMode = "source-over"];
		}

		if (this._renderMode === newMode) { return; }

		let gl = this._webGLContext;
		let shaderData = this._builtShaders[newMode];
		if (shaderData === undefined) {
			try {
				shaderData = this._builtShaders[newMode] = {
					eqRGB: gl[blendSrc.eqRGB || "FUNC_ADD"],
					srcRGB: gl[blendSrc.srcRGB || "ONE"],
					dstRGB: gl[blendSrc.dstRGB || "ONE_MINUS_SRC_ALPHA"],
					eqA: gl[blendSrc.eqA || "FUNC_ADD"],
					srcA: gl[blendSrc.srcA || "ONE"],
					dstA: gl[blendSrc.dstA || "ONE_MINUS_SRC_ALPHA"],
					immediate: blendSrc.shader !== undefined,
					shader: (blendSrc.shader || this._builtShaders["source-over"] === undefined) ?
						this._fetchShaderProgram(
							true, undefined, blendSrc.shader,
							this._setCoverMixShaderParams
						) : this._builtShaders["source-over"].shader // re-use source-over when we don't need a new shader
				};
				if (blendSrc.shader) { shaderData.shader._name = newMode; }
			} catch (e) {
				this._builtShaders[newMode] = undefined;
				console && console.log("SHADER SWITCH FAILURE", e);
				return;
			}
		}

		if (shaderData.immediate) {
			if (this._directDraw) {
				if (this.vocalDebug) { console.log("Illegal compositeOperation ["+ newMode +"] due to AJStageGL.directDraw = true, reverting to default"); }
				return;
			}
			this._activeConfig = this._attributeConfig["micro"];
		}

		gl.bindFramebuffer(gl.FRAMEBUFFER, this._batchTextureOutput._frameBuffer);

		this.batchReason = "shaderSwap";
		this._renderBatch();		// <--------------------------------------------------------------------------------

		this._renderMode = newMode;
		this._immediateRender = shaderData.immediate;
		gl.blendEquationSeparate(shaderData.eqRGB, shaderData.eqA);
		gl.blendFuncSeparate(shaderData.srcRGB, shaderData.dstRGB, shaderData.srcA, shaderData.dstA);
	}

	_drawContent(content, ignoreCache) {
		let gl = this._webGLContext;

		this._activeShader = this._mainShader;

		gl.bindFramebuffer(gl.FRAMEBUFFER, this._batchTextureOutput._frameBuffer);
		if(this._batchTextureOutput._frameBuffer !== null) { gl.clear(gl.COLOR_BUFFER_BIT); }

		this._appendToBatch(content, new Matrix2D(), this.alpha, ignoreCache);

		this.batchReason = "contentEnd";
		this._renderBatch();
	}

	_drawCover(gl, flipY) {
		if (this._isDrawing > 0) {
			this._drawBuffers(gl);
		}

		if (this.vocalDebug) {
			console.log("Draw["+ this._drawID +":"+ this._batchID +"] : "+ "Cover");
		}
		var shaderProgram = this._activeShader;
		var vertexPositionBuffer = this._vertexPositionBuffer;
		var uvPositionBuffer = this._uvPositionBuffer;

		gl.clear(gl.COLOR_BUFFER_BIT);
		gl.useProgram(shaderProgram);

		gl.bindBuffer(gl.ARRAY_BUFFER, vertexPositionBuffer);
		gl.vertexAttribPointer(shaderProgram.vertexPositionAttribute, vertexPositionBuffer.itemSize, gl.FLOAT, false, 0, 0);
		gl.bufferSubData(gl.ARRAY_BUFFER, 0, AJStageGL.COVER_VERT);
		gl.bindBuffer(gl.ARRAY_BUFFER, uvPositionBuffer);
		gl.vertexAttribPointer(shaderProgram.uvPositionAttribute, uvPositionBuffer.itemSize, gl.FLOAT, false, 0, 0);
		gl.bufferSubData(gl.ARRAY_BUFFER, 0, flipY?AJStageGL.COVER_UV_FLIP:AJStageGL.COVER_UV);

		gl.uniform1i(shaderProgram.samplerUniform, 0);
		gl.uniform1f(shaderProgram.uprightUniform, flipY?0:1);

		gl.drawArrays(gl.TRIANGLES, 0, AJStageGL.INDICIES_PER_CARD);
	}

	_alignTargetToCache(target, manager) {
		if (manager._counterMatrix === null) {
			manager._counterMatrix = target.getMatrix();
		} else {
			target.getMatrix(manager._counterMatrix)
		}

		let mtx = manager._counterMatrix;
		mtx.scale(1/manager.scale, 1/manager.scale);
		mtx = mtx.invert();
		mtx.translate(-manager.offX/manager.scale*target.scaleX, -manager.offY/manager.scale*target.scaleY);

		return mtx;
	}

	_appendToBatch(container, concatMtx, concatAlpha, ignoreCache) {
		let gl = this._webGLContext;

		// sort out shared properties
		let cMtx = container._glMtx;
		cMtx.copy(concatMtx);
		if (container.transformMatrix !== null) {
			cMtx.appendMatrix(container.transformMatrix);
		} else {
			cMtx.appendTransform(
				container.x, container.y,
				container.scaleX, container.scaleY,
				container.rotation, container.skewX, container.skewY,
				container.regX, container.regY
			);
		}

		let previousRenderMode = this._renderMode;
		if (container.compositeOperation) {
			this._updateRenderMode(container.compositeOperation);
		}

		// sub components of figuring out the position an object holds
		let subL, subT, subR, subB;

		// actually apply its data to the buffers
		let l = container.children.length;
		for (let i = 0; i < l; i++) {
			let item = container.children[i];
			let useCache = (!ignoreCache && item.cacheCanvas) || false;

			if (!(item.visible && concatAlpha > 0.0035)) { continue; }
			let itemAlpha = item.alpha;

			if (useCache === false) {
				if (item._updateState){
					item._updateState();
				}

				if(!this._directDraw && (!ignoreCache && item.cacheCanvas === null && item.filters !== null && item.filters.length)) {
					let bounds;
					if (item.bitmapCache === null) {
						bounds = item.getBounds();
						item.bitmapCache = new BitmapCache();
						item.bitmapCache._autoGenerated = true;
					}
					if (item.bitmapCache._autoGenerated) {
						this.batchReason = "cachelessFilterInterupt";
						this._renderBatch();					// <----------------------------------------------------

						item.alpha = 1;
						let shaderBackup = this._activeShader;
						bounds = bounds || item.getBounds();
						item.bitmapCache.define(item, bounds.x, bounds.y, bounds.width, bounds.height, 1, {useGL:this});
						useCache = item.bitmapCache._cacheCanvas;

						item.alpha = itemAlpha;
						this._activeShader = shaderBackup;
						gl.bindFramebuffer(gl.FRAMEBUFFER, this._batchTextureOutput._frameBuffer);
					}
				}
			}

			if (useCache === false && item.children) {
				this._appendToBatch(item, cMtx, itemAlpha * concatAlpha);
				continue;
			}

			let containerRenderMode = this._renderMode;
			if (item.compositeOperation) {
				this._updateRenderMode(item.compositeOperation);
			}

			// check for overflowing batch, if yes then force a render
			if (this._batchVertexCount + AJStageGL.INDICIES_PER_CARD > this._maxBatchVertexCount) {
				this.batchReason = "vertexOverflow";
				this._renderBatch();					// <------------------------------------------------------------
			}

			// keep track of concatenated position
			let iMtx = item._glMtx;
			iMtx.copy(cMtx);
			if (item.transformMatrix) {
				iMtx.appendMatrix(item.transformMatrix);
			} else {
				iMtx.appendTransform(
					item.x, item.y,
					item.scaleX, item.scaleY,
					item.rotation, item.skewX, item.skewY,
					item.regX, item.regY
				);
			}

			let uvRect, texIndex, image, frame, texture, src;

			// get the image data, or abort if not present
			// BITMAP / Cached Canvas
			if (item._webGLRenderStyle === 2 || useCache !== false) {
				image = useCache === false ? item.image : useCache;

			// SPRITE
			} else if (item._webGLRenderStyle === 1) {
				frame = item.spriteSheet.getFrame(item.currentFrame);
				if (frame === null) { continue; }
				image = frame.image;
				// MISC (DOM objects render themselves later)
			} else {
				continue;
			}
			if (!image) { continue; }

			// calculate texture
			if (image._storeID === undefined) {
				// this texture is new to us so load it and add it to the batch
				texture = this._loadTextureImage(gl, image);
			} else {
				// fetch the texture (render textures know how to look themselves up to simplify this logic)
				texture = this._textureDictionary[image._storeID];

				if (!texture){ //TODO: this should really not occur but has due to bugs, hopefully this can be removed eventually
					if (this.vocalDebug){ console.log("Image source should not be lookup a non existent texture, please report a bug."); }
					continue;
				}

				// put it in the batch if needed
				if (texture._batchID !== this._batchID) {
					this._insertTextureInBatch(gl, texture);
				}
			}
			texIndex = texture._activeIndex;
			image._drawID = this._drawID;

			// BITMAP / Cached Canvas
			if (item._webGLRenderStyle === 2 || useCache !== false) {
				if (useCache === false && item.sourceRect) {
					// calculate uvs
					if (!item._uvRect) { item._uvRect = {}; }
					src = item.sourceRect;
					uvRect = item._uvRect;
					uvRect.t = 1 - ((src.y)/image.height);
					uvRect.l = (src.x)/image.width;
					uvRect.b = 1 - ((src.y + src.height)/image.height);
					uvRect.r = (src.x + src.width)/image.width;

					// calculate vertices
					subL = 0;							subT = 0;
					subR = src.width+subL;				subB = src.height+subT;
				} else {
					// calculate uvs
					uvRect = AJStageGL.UV_RECT;
					// calculate vertices
					if (useCache === false) {
						subL = 0;						subT = 0;
						subR = image.width+subL;		subB = image.height+subT;
					} else {
						src = item.bitmapCache;
						subL = src.x+(src._filterOffX/src.scale);	subT = src.y+(src._filterOffY/src.scale);
						subR = (src._drawWidth/src.scale)+subL;		subB = (src._drawHeight/src.scale)+subT;
					}
				}

			// SPRITE
			} else if (item._webGLRenderStyle === 1) {
				let rect = frame.rect;

				// calculate uvs
				uvRect = frame.uvRect;
				if (!uvRect) {
					uvRect = AJStageGL.buildUVRects(item.spriteSheet, item.currentFrame, false);
				}

				// calculate vertices
				subL = -frame.regX;
				subT = -frame.regY;
				subR = rect.width-frame.regX;
				subB = rect.height-frame.regY;
			}

			let spacing = 0;
			let cfg =  this._activeConfig;
			let vpos = cfg.position.array;
			let uvs = cfg.uv.array;
			let texI = cfg.texture.array;
			let alphas = cfg.alpha.array;

			// apply vertices
			spacing = cfg.position.spacing;
			let vtxOff = this._batchVertexCount * spacing + cfg.position.offset;
			vpos[vtxOff] = subL*iMtx.a + subT*iMtx.c + iMtx.tx;
			vpos[vtxOff+1] = subL*iMtx.b + subT*iMtx.d + iMtx.ty;
			vtxOff += spacing;
			vpos[vtxOff] = subL*iMtx.a + subB*iMtx.c + iMtx.tx;
			vpos[vtxOff+1] = subL*iMtx.b + subB*iMtx.d + iMtx.ty;
			vtxOff += spacing;
			vpos[vtxOff] = subR*iMtx.a + subT*iMtx.c + iMtx.tx;
			vpos[vtxOff+1] = subR*iMtx.b + subT*iMtx.d + iMtx.ty;
			vtxOff += spacing;
			vpos[vtxOff] = subL*iMtx.a + subB*iMtx.c + iMtx.tx;
			vpos[vtxOff+1] = subL*iMtx.b + subB*iMtx.d + iMtx.ty;
			vtxOff += spacing;
			vpos[vtxOff] = subR*iMtx.a + subT*iMtx.c + iMtx.tx;
			vpos[vtxOff+1] = subR*iMtx.b + subT*iMtx.d + iMtx.ty;
			vtxOff += spacing;
			vpos[vtxOff] = subR*iMtx.a + subB*iMtx.c + iMtx.tx;
			vpos[vtxOff+1] = subR*iMtx.b + subB*iMtx.d + iMtx.ty;

			// apply uvs
			spacing = cfg.uv.spacing;
			let uvOff = this._batchVertexCount * spacing + cfg.uv.offset;
			uvs[uvOff] = uvRect.l;        uvs[uvOff+1] = uvRect.t;
			uvOff += spacing;
			uvs[uvOff] = uvRect.l;        uvs[uvOff+1] = uvRect.b;
			uvOff += spacing;
			uvs[uvOff] = uvRect.r;        uvs[uvOff+1] = uvRect.t;
			uvOff += spacing;
			uvs[uvOff] = uvRect.l;        uvs[uvOff+1] = uvRect.b;
			uvOff += spacing;
			uvs[uvOff] = uvRect.r;        uvs[uvOff+1] = uvRect.t;
			uvOff += spacing;
			uvs[uvOff] = uvRect.r;        uvs[uvOff+1] = uvRect.b;

			// apply texture
			spacing = cfg.texture.spacing;
			let texOff = this._batchVertexCount * spacing + cfg.texture.offset;
			texI[texOff] = texIndex;
			texOff += spacing;
			texI[texOff] = texIndex;
			texOff += spacing;
			texI[texOff] = texIndex;
			texOff += spacing;
			texI[texOff] = texIndex;
			texOff += spacing;
			texI[texOff] = texIndex;
			texOff += spacing;
			texI[texOff] = texIndex;

			// apply alpha
			spacing = cfg.alpha.spacing;
			let aOff = this._batchVertexCount * spacing + cfg.alpha.offset;
			alphas[aOff] = itemAlpha * concatAlpha;
			aOff += spacing;
			alphas[aOff] = itemAlpha * concatAlpha;
			aOff += spacing;
			alphas[aOff] = itemAlpha * concatAlpha;
			aOff += spacing;
			alphas[aOff] = itemAlpha * concatAlpha;
			aOff += spacing;
			alphas[aOff] = itemAlpha * concatAlpha;
			aOff += spacing;
			alphas[aOff] = itemAlpha * concatAlpha;

			this._batchVertexCount += AJStageGL.INDICIES_PER_CARD;

			if (this._immediateRender) {
				this._activeConfig = this._attributeConfig["default"];
				this._immediateBatchRender();
			}

			if (this._renderMode !== containerRenderMode) {
				this._updateRenderMode(containerRenderMode);
			}
		}

		if (this._renderMode !== previousRenderMode) {
			this._updateRenderMode(previousRenderMode);
		}
	}

	_immediateBatchRender() {
		let gl = this._webGLContext;

		if (this._batchTextureConcat === null){
			this._batchTextureConcat = this.getRenderBufferTexture(this._viewportWidth, this._viewportHeight);
		} else {
			this.resizeTexture(this._batchTextureConcat, this._viewportWidth, this._viewportHeight);
			gl.bindFramebuffer(gl.FRAMEBUFFER, this._batchTextureConcat._frameBuffer);
			gl.clear(gl.COLOR_BUFFER_BIT);
		}
		if (this._batchTextureTemp === null){
			this._batchTextureTemp = this.getRenderBufferTexture(this._viewportWidth, this._viewportHeight);
			gl.bindFramebuffer(gl.FRAMEBUFFER, this._batchTextureTemp._frameBuffer);
		} else {
			this.resizeTexture(this._batchTextureTemp, this._viewportWidth, this._viewportHeight);
			gl.bindFramebuffer(gl.FRAMEBUFFER, this._batchTextureTemp._frameBuffer);
			gl.clear(gl.COLOR_BUFFER_BIT);
		}

		let swap = this._batchTextureOutput;
		this._batchTextureOutput = this._batchTextureConcat;
		this._batchTextureConcat = swap;

		this._activeShader = this._mainShader;
		this.batchReason = "immediatePrep";
		this._renderBatch();

		this.batchReason = "immediateResults";
		this._drawCover(this._batchTextureOutput._frameBuffer, this._batchTextureConcat, this._batchTextureTemp);

		gl.bindFramebuffer(gl.FRAMEBUFFER, this._batchTextureOutput._frameBuffer);
	}

	_renderBatch() {
		if (this._batchVertexCount <= 0) { return; }	// prevents error logs on stages filled with un-renederable content.
		let gl = this._webGLContext;
		this._renderPerDraw++;

		if (this.vocalDebug) {
			console.log(`Batch[${this._drawID}:${this._batchID}]: ${this.batchReason}`);
		}
		let shaderProgram = this._activeShader;
		let config = this._activeConfig;
		let pc;

		gl.useProgram(shaderProgram);

		pc = config.position;
		gl.bindBuffer(gl.ARRAY_BUFFER, pc.buffer);
		gl.vertexAttribPointer(shaderProgram.positionAttribute, pc.size, pc.type, false, pc.stride, pc.offB);
		gl.bufferSubData(gl.ARRAY_BUFFER, 0, pc.array);

		pc = config.texture;
		gl.bindBuffer(gl.ARRAY_BUFFER, pc.buffer);
		gl.vertexAttribPointer(shaderProgram.textureIndexAttribute, pc.size, pc.type, false, pc.stride, pc.offB);
		gl.bufferSubData(gl.ARRAY_BUFFER, 0, pc.array);

		pc = config.uv;
		gl.bindBuffer(gl.ARRAY_BUFFER, pc.buffer);
		gl.vertexAttribPointer(shaderProgram.uvPositionAttribute, pc.size, pc.type, false, pc.stride, pc.offB);
		gl.bufferSubData(gl.ARRAY_BUFFER, 0, pc.array);

		pc = config.alpha;
		gl.bindBuffer(gl.ARRAY_BUFFER, pc.buffer);
		gl.vertexAttribPointer(shaderProgram.alphaAttribute, pc.size, pc.type, false, pc.stride, pc.offB);
		gl.bufferSubData(gl.ARRAY_BUFFER, 0, pc.array);

		gl.uniformMatrix4fv(shaderProgram.pMatrixUniform, gl.FALSE, this._projectionMatrix);

		for (let i = 0; i < this._batchTextureCount; i++) {
			gl.activeTexture(gl.TEXTURE0 + i);
			gl.bindTexture(gl.TEXTURE_2D, this._batchTextures[i]);
		}

		gl.drawArrays(gl.TRIANGLES, 0, this._batchVertexCount);

		this._batchVertexCount = 0;
		this._batchID++;
	}

	_renderCover() {
		let gl = this._webGLContext;
		this._renderPerDraw++;

		if (this.vocalDebug) {
			console.log("Cover["+ this._drawID +":"+ this._batchID +"] : "+ this.batchReason);
		}
		let shaderProgram = this._activeShader;
		let config = this._attributeConfig.default;
		let pc;

		gl.useProgram(shaderProgram);

		pc = config.position;
		gl.bindBuffer(gl.ARRAY_BUFFER, pc.buffer);
		gl.vertexAttribPointer(shaderProgram.positionAttribute, pc.size, pc.type, false, pc.stride, pc.offB);
		gl.bufferSubData(gl.ARRAY_BUFFER, 0, AJStageGL.COVER_VERT);

		pc = config.uv;
		gl.bindBuffer(gl.ARRAY_BUFFER, pc.buffer);
		gl.vertexAttribPointer(shaderProgram.uvPositionAttribute, pc.size, pc.type, false, pc.stride, pc.offB);
		gl.bufferSubData(gl.ARRAY_BUFFER, 0, AJStageGL.COVER_UV);

		gl.uniform1i(shaderProgram.samplerUniform, 0);

		gl.drawArrays(gl.TRIANGLES, 0, AJStageGL.INDICIES_PER_CARD);
		this._batchID++; // while this isn't a batch, this fixes issues with expected textures in expected places
	}
	_appendToBatchGroup = function (container, gl, concatMtx, concatAlpha, ignoreCache) {
		// sort out shared properties
		if (!container._glMtx) { container._glMtx = new Matrix2D(); }
		let cMtx = container._glMtx;
		cMtx.copy(concatMtx);
		if (container.transformMatrix) {
			cMtx.appendMatrix(container.transformMatrix);
		} else {
			cMtx.appendTransform(
				container.x, container.y,
				container.scaleX, container.scaleY,
				container.rotation, container.skewX, container.skewY,
				container.regX, container.regY
			);
		}

		// sub components of figuring out the position an object holds
		let subL, subT, subR, subB;

		// actually apply its data to the buffers
		let l = container.children.length;
		for (let i = 0; i < l; i++) {
			let item = container.children[i];

			if (!(item.visible && concatAlpha)) { continue; }
			if (!item.cacheCanvas || ignoreCache) {
				if (item._updateState){
					item._updateState();
				}
				if (item.children) {
					this._appendToBatchGroup(item, gl, cMtx, item.alpha * concatAlpha);
					continue;
				}
			}

			// check for overflowing batch, if yes then force a render
			// TODO: DHG: consider making this polygon count dependant for things like vector draws
			if (this.batchCardCount+1 > this._maxCardsPerBatch) {
				this.batchReason = "vertexOverflow";
				this._drawBuffers(gl);					// <------------------------------------------------------------
				this.batchCardCount = 0;
			}

			// keep track of concatenated position
			if (!item._glMtx) { item._glMtx = new Matrix2D(); }
			let iMtx = item._glMtx;
			iMtx.copy(cMtx);
			if (item.transformMatrix) {
				iMtx.appendMatrix(item.transformMatrix);
			} else {
				iMtx.appendTransform(
					item.x, item.y,
					item.scaleX, item.scaleY,
					item.rotation, item.skewX, item.skewY,
					item.regX, item.regY
				);
			}

			let uvRect, texIndex, image, frame, texture, src;
			let useCache = item.cacheCanvas && !ignoreCache;

			if (item._webGLRenderStyle === 2 || useCache) {			// BITMAP / Cached Canvas
				image = (ignoreCache?false:item.cacheCanvas) || item.image;
			} else if (item._webGLRenderStyle === 1) {											// SPRITE
				frame = item.spriteSheet.getFrame(item.currentFrame);	//TODO: Faster way?
				if (frame === null) { continue; }
				image = frame.image;
			} else {																			// MISC (DOM objects render themselves later)
				continue;
			}

			let uvs = this._uvs;
			let vertices = this._vertices;
			let texI = this._indices;
			let alphas = this._alphas;

			// calculate texture
			if (!image) { continue; }
			if (image._storeID === undefined) {
				// this texture is new to us so load it and add it to the batch
				texture = this._loadTextureImage(gl, image);
				this._insertTextureInBatch(gl, texture);
			} else {
				// fetch the texture (render textures know how to look themselves up to simplify this logic)
				texture = this._textureDictionary[image._storeID];
				if (!texture){
					if (this.vocalDebug){ console.log("Texture should not be looked up while not being stored."); }
					continue;
				}

				// put it in the batch if needed
				if (texture._batchID !== this._batchID) {
					this._insertTextureInBatch(gl, texture);
				}
			}
			texIndex = texture._activeIndex;

			if (item._webGLRenderStyle === 2 || useCache) {			// BITMAP / Cached Canvas
				if (!useCache && item.sourceRect) {
					// calculate uvs
					if (!item._uvRect) { item._uvRect = {}; }
					src = item.sourceRect;
					uvRect = item._uvRect;
					uvRect.t = (src.y)/image.height;
					uvRect.l = (src.x)/image.width;
					uvRect.b = (src.y + src.height)/image.height;
					uvRect.r = (src.x + src.width)/image.width;

					// calculate vertices
					subL = 0;							subT = 0;
					subR = src.width+subL;				subB = src.height+subT;
				} else {
					// calculate uvs
					uvRect = AJStageGL.UV_RECT;
					// calculate vertices
					if (useCache) {
						src = item.bitmapCache;
						subL = src.x+(src._filterOffX/src.scale);	subT = src.y+(src._filterOffY/src.scale);
						subR = (src._drawWidth/src.scale)+subL;		subB = (src._drawHeight/src.scale)+subT;
					} else {
						subL = 0;						subT = 0;
						subR = image.width+subL;		subB = image.height+subT;
					}
				}
			} else if (item._webGLRenderStyle === 1) {											// SPRITE
				let rect = frame.rect;

				// calculate uvs
				uvRect = frame.uvRect;
				if (!uvRect) {
					uvRect = AJStageGL.buildUVRects(item.spriteSheet, item.currentFrame, false);
				}

				// calculate vertices
				subL = -frame.regX;								subT = -frame.regY;
				subR = rect.width-frame.regX;					subB = rect.height-frame.regY;
			}

			// These must be calculated here else a forced draw might happen after they're set
			let offV1 = this.batchCardCount*AJStageGL.INDICIES_PER_CARD;		// offset for 1 component vectors
			let offV2 = offV1*2;											// offset for 2 component vectors

			//DHG: See Matrix2D.transformPoint for why this math specifically
			// apply vertices
			vertices[offV2] =		subL *iMtx.a + subT *iMtx.c +iMtx.tx;		vertices[offV2+1] =		subL *iMtx.b + subT *iMtx.d +iMtx.ty;
			vertices[offV2+2] =		subL *iMtx.a + subB *iMtx.c +iMtx.tx;		vertices[offV2+3] =		subL *iMtx.b + subB *iMtx.d +iMtx.ty;
			vertices[offV2+4] =		subR *iMtx.a + subT *iMtx.c +iMtx.tx;		vertices[offV2+5] =		subR *iMtx.b + subT *iMtx.d +iMtx.ty;
			vertices[offV2+6] =		vertices[offV2+2];							vertices[offV2+7] =		vertices[offV2+3];
			vertices[offV2+8] =		vertices[offV2+4];							vertices[offV2+9] =		vertices[offV2+5];
			vertices[offV2+10] =	subR *iMtx.a + subB *iMtx.c +iMtx.tx;		vertices[offV2+11] =	subR *iMtx.b + subB *iMtx.d +iMtx.ty;

			// apply uvs
			uvs[offV2] =	uvRect.l;			uvs[offV2+1] =	uvRect.t;
			uvs[offV2+2] =	uvRect.l;			uvs[offV2+3] =	uvRect.b;
			uvs[offV2+4] =	uvRect.r;			uvs[offV2+5] =	uvRect.t;
			uvs[offV2+6] =	uvRect.l;			uvs[offV2+7] =	uvRect.b;
			uvs[offV2+8] =	uvRect.r;			uvs[offV2+9] =	uvRect.t;
			uvs[offV2+10] =	uvRect.r;			uvs[offV2+11] =	uvRect.b;

			// apply texture
			texI[offV1] = texI[offV1+1] = texI[offV1+2] = texI[offV1+3] = texI[offV1+4] = texI[offV1+5] = texIndex;

			// apply alpha
			alphas[offV1] = alphas[offV1+1] = alphas[offV1+2] = alphas[offV1+3] = alphas[offV1+4] = alphas[offV1+5] = item.alpha * concatAlpha;

			this.batchCardCount++;
		}
	};
	_drawBuffers = function (gl) {
		if (this.batchCardCount <= 0) { return; }	// prevents error logs on stages filled with un-renederable content.

		if (this.vocalDebug) {
			console.log("Draw["+ this._drawID +":"+ this._batchID +"] : "+ this.batchReason);
		}
		let shaderProgram = this._activeShader;
		let vertexPositionBuffer = this._vertexPositionBuffer;
		let textureIndexBuffer = this._textureIndexBuffer;
		let uvPositionBuffer = this._uvPositionBuffer;
		let alphaBuffer = this._alphaBuffer;

		gl.useProgram(shaderProgram);

		gl.bindBuffer(gl.ARRAY_BUFFER, vertexPositionBuffer);
		gl.vertexAttribPointer(shaderProgram.vertexPositionAttribute, vertexPositionBuffer.itemSize, gl.FLOAT, false, 0, 0);
		gl.bufferSubData(gl.ARRAY_BUFFER, 0, this._vertices);

		gl.bindBuffer(gl.ARRAY_BUFFER, textureIndexBuffer);
		gl.vertexAttribPointer(shaderProgram.textureIndexAttribute, textureIndexBuffer.itemSize, gl.FLOAT, false, 0, 0);
		gl.bufferSubData(gl.ARRAY_BUFFER, 0, this._indices);

		gl.bindBuffer(gl.ARRAY_BUFFER, uvPositionBuffer);
		gl.vertexAttribPointer(shaderProgram.uvPositionAttribute, uvPositionBuffer.itemSize, gl.FLOAT, false, 0, 0);
		gl.bufferSubData(gl.ARRAY_BUFFER, 0, this._uvs);

		gl.bindBuffer(gl.ARRAY_BUFFER, alphaBuffer);
		gl.vertexAttribPointer(shaderProgram.alphaAttribute, alphaBuffer.itemSize, gl.FLOAT, false, 0, 0);
		gl.bufferSubData(gl.ARRAY_BUFFER, 0, this._alphas);

		gl.uniformMatrix4fv(shaderProgram.pMatrixUniform, gl.FALSE, this._projectionMatrix);

		for (let i = 0; i < this._batchTextureCount; i++) {
			let texture = this._batchTextures[i];
			gl.activeTexture(gl.TEXTURE0 + i);
			gl.bindTexture(gl.TEXTURE_2D, texture);
			this.setTextureParams(gl, texture.isPOT);
		}

		gl.drawArrays(gl.TRIANGLES, 0, this.batchCardCount*AJStageGL.INDICIES_PER_CARD);
		this._batchID++;
	};
}
AJStageGL.VERTEX_PROPERTY_COUNT = 6;
AJStageGL.INDICIES_PER_CARD = 6;
AJStageGL.DEFAULT_MAX_BATCH_SIZE = 10000;
AJStageGL.WEBGL_MAX_INDEX_NUM = Math.pow(2, 16);
AJStageGL.UV_RECT = {t:0, l:0, b:1, r:1};
try {
	AJStageGL.COVER_VERT = new Float32Array([
		-1,		 1,		//TL
		1,		 1,		//TR
		-1,		-1,		//BL
		1,		 1,		//TR
		1,		-1,		//BR
		-1,		-1		//BL
	]);
	AJStageGL.COVER_UV = new Float32Array([
		0,		 0,		//TL
		1,		 0,		//TR
		0,		 1,		//BL
		1,		 0,		//TR
		1,		 1,		//BR
		0,		 1		//BL
	]);
	AJStageGL.COVER_UV_FLIP = new Float32Array([
		0,		 1,		//TL
		1,		 1,		//TR
		0,		 0,		//BL
		1,		 1,		//TR
		1,		 0,		//BR
		0,		 0		//BL
	]);
} catch(e) { /* Breaking in older browsers, but those browsers wont run AJStageGL so no recovery or warning needed */ }
AJStageGL.REGULAR_VARYING_HEADER = (
	"precision mediump float;" +
	"varying vec2 vTextureCoord;" +
	"varying lowp float indexPicker;" +
	"varying lowp float alphaValue;"
);
AJStageGL.REGULAR_VERTEX_HEADER = (
	AJStageGL.REGULAR_VARYING_HEADER +
	"attribute vec2 vertexPosition;" +
	"attribute vec2 uvPosition;" +
	"attribute lowp float textureIndex;" +
	"attribute lowp float objectAlpha;" +
	"uniform mat4 pMatrix;"
);
AJStageGL.REGULAR_FRAGMENT_HEADER = (
	AJStageGL.REGULAR_VARYING_HEADER +
	"uniform sampler2D uSampler[{{count}}];"
);
AJStageGL.REGULAR_VERTEX_BODY  = (
	"void main(void) {" +
	//DHG TODO: This doesn't work. Must be something wrong with the hand built matrix see js... bypass for now
	//vertexPosition, round if flag
	//"gl_Position = pMatrix * vec4(vertexPosition.x, vertexPosition.y, 0.0, 1.0);" +
	"gl_Position = vec4("+
	"(vertexPosition.x * pMatrix[0][0]) + pMatrix[3][0]," +
	"(vertexPosition.y * pMatrix[1][1]) + pMatrix[3][1]," +
	"pMatrix[3][2]," +
	"1.0" +
	");" +
	"alphaValue = objectAlpha;" +
	"indexPicker = textureIndex;" +
	"vTextureCoord = uvPosition;" +
	"}"
);
AJStageGL.REGULAR_FRAGMENT_BODY = (
	"void main(void) {" +
	"vec4 color = vec4(1.0, 0.0, 0.0, 1.0);" +

	"if (indexPicker <= 0.5) {" +
	"color = texture2D(uSampler[0], vTextureCoord);" +
	"{{alternates}}" +
	"}" +

	"{{fragColor}}" +
	"}"
);
AJStageGL.REGULAR_FRAG_COLOR_NORMAL = (
	"gl_FragColor = vec4(color.rgb, color.a * alphaValue);"
);
AJStageGL.REGULAR_FRAG_COLOR_PREMULTIPLY = (
	"if(color.a > 0.0035) {" +		// 1/255 = 0.0039, so ignore any value below 1 because it's probably noise
	"gl_FragColor = vec4(color.rgb/color.a, color.a * alphaValue);" +
	"} else {" +
	"gl_FragColor = vec4(0.0, 0.0, 0.0, 0.0);" +
	"}"
);
AJStageGL.PARTICLE_VERTEX_BODY = (
	AJStageGL.REGULAR_VERTEX_BODY
);
AJStageGL.PARTICLE_FRAGMENT_BODY = (
	AJStageGL.REGULAR_FRAGMENT_BODY
);
AJStageGL.COVER_VARYING_HEADER = (
	"precision mediump float;" +

	"varying highp vec2 vRenderCoord;" +
	"varying highp vec2 vTextureCoord;"
);
AJStageGL.COVER_VERTEX_HEADER = (
	AJStageGL.COVER_VARYING_HEADER +
	"attribute vec2 vertexPosition;" +
	"attribute vec2 uvPosition;" +
	"uniform float uUpright;"
);
AJStageGL.COVER_FRAGMENT_HEADER = (
	AJStageGL.COVER_VARYING_HEADER +
	"uniform sampler2D uSampler;"
);
AJStageGL.COVER_VERTEX_BODY  = (
	"void main(void) {" +
	"gl_Position = vec4(vertexPosition.x, vertexPosition.y, 0.0, 1.0);" +
	"vRenderCoord = uvPosition;" +
	"vTextureCoord = vec2(uvPosition.x, abs(uUpright - uvPosition.y));" +
	"}"
);
AJStageGL.COVER_FRAGMENT_BODY = (
	"void main(void) {" +
	"vec4 color = texture2D(uSampler, vRenderCoord);" +
	"gl_FragColor = color;" +
	"}"
);