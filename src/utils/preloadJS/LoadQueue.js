import AbstractLoader from "@/utils/preloadJS/loaders/AbstractLoader.js";
import TextLoader from "@/utils/preloadJS/loaders/TextLoader.js";
import VideoLoader from "@/utils/preloadJS/loaders/VideoLoader.js";
import BinaryLoader from "@/utils/preloadJS/loaders/BinaryLoader.js";
import SVGLoader from "@/utils/preloadJS/loaders/SVGLoader.js";
import XMLLoader from "@/utils/preloadJS/loaders/XMLLoader.js";
import SpriteSheetLoader from "@/utils/preloadJS/loaders/SpriteSheetLoader.js";
import ManifestLoader from "@/utils/preloadJS/loaders/ManifestLoader.js";
import SoundLoader from "@/utils/preloadJS/loaders/SoundLoader.js";
import JSONPLoader from "@/utils/preloadJS/loaders/JSONPLoader.js";
import JSONLoader from "@/utils/preloadJS/loaders/JSONLoader.js";
import CSSLoader from "@/utils/preloadJS/loaders/CSSLoader.js";
import JavaScriptLoader from "@/utils/preloadJS/loaders/JavaScriptLoader.js";
import ImageLoader from "@/utils/preloadJS/loaders/ImageLoader.js";
import FontLoader from "@/utils/preloadJS/loaders/FontLoader.js";
import ErrorEvent from "@/utils/base/ErrorEvent.js";
import Types from "@/utils/base/Types.js";
import LoadItem from "@/utils/preloadJS/data/LoadItem.js";
import URLUtils from "@/utils/base/URLUtils.js";
import RequestUtils from "@/utils/base/RequestUtils.js";
import Base from "@/utils/base/Base.js";
import DomUtils from "@/utils/base/DomUtils.js";
import {Event} from "@createjs/core";

export default class LoadQueue extends AbstractLoader {
  constructor(preferXHR, basePath, crossOrigin) {
    super();
    /**
     * An array of the plugins registered using {{#crossLink "LoadQueue/installPlugin"}}{{/crossLink}}.
     * @property _plugins
     * @type {Array}
     * @private
     * @since 0.6.1
     */
    this._plugins = [];

    /**
     * An object hash of callbacks that are fired for each file type before the file is loaded, giving plugins the
     * ability to override properties of the load. Please see the {{#crossLink "LoadQueue/installPlugin"}}{{/crossLink}}
     * method for more information.
     * @property _typeCallbacks
     * @type {Object}
     * @private
     */
    this._typeCallbacks = {};

    /**
     * An object hash of callbacks that are fired for each file extension before the file is loaded, giving plugins the
     * ability to override properties of the load. Please see the {{#crossLink "LoadQueue/installPlugin"}}{{/crossLink}}
     * method for more information.
     * @property _extensionCallbacks
     * @type {null}
     * @private
     */
    this._extensionCallbacks = {};

    /**
     * The next preload queue to process when this one is complete. If an error is thrown in the current queue, and
     * {{#crossLink "LoadQueue/stopOnError:property"}}{{/crossLink}} is `true`, the next queue will not be processed.
     * @property next
     * @type {LoadQueue}
     * @default null
     */
    this.next = null;

    /**
     * Ensure loaded scripts "complete" in the order they are specified. Loaded scripts are added to the document head
     * once they are loaded. Scripts loaded via tags will load one-at-a-time when this property is `true`, whereas
     * scripts loaded using XHR can load in any order, but will "finish" and be added to the document in the order
     * specified.
     *
     * Any items can be set to load in order by setting the {{#crossLink "maintainOrder:property"}}{{/crossLink}}
     * property on the load item, or by ensuring that only one connection can be open at a time using
     * {{#crossLink "LoadQueue/setMaxConnections"}}{{/crossLink}}. Note that when the `maintainScriptOrder` property
     * is set to `true`, scripts items are automatically set to `maintainOrder=true`, and changing the
     * `maintainScriptOrder` to `false` during a load will not change items already in a queue.
     *
     * <h4>Example</h4>
     *
     *      var queue = new createjs.LoadQueue();
     *      queue.setMaxConnections(3); // Set a higher number to load multiple items at once
     *      queue.maintainScriptOrder = true; // Ensure scripts are loaded in order
     *      queue.loadManifest([
     *          "script1.js",
     *          "script2.js",
     *          "image.png", // Load any time
     *          {src: "image2.png", maintainOrder: true} // Will wait for script2.js
     *          "image3.png",
     *          "script3.js" // Will wait for image2.png before loading (or completing when loading with XHR)
     *      ]);
     *
     * @property maintainScriptOrder
     * @type {Boolean}
     * @default true
     */
    this.maintainScriptOrder = true;

    /**
     * Determines if the LoadQueue will stop processing the current queue when an error is encountered.
     * @property stopOnError
     * @type {Boolean}
     * @default false
     */
    this.stopOnError = false;

    /**
     * The number of maximum open connections that a loadQueue tries to maintain. Please see
     * {{#crossLink "LoadQueue/setMaxConnections"}}{{/crossLink}} for more information.
     * @property _maxConnections
     * @type {Number}
     * @default 1
     * @private
     */
    this._maxConnections = 1;

    /**
     * An internal list of all the default Loaders that are included with PreloadJS. Before an item is loaded, the
     * available loader list is iterated, in the order they are included, and as soon as a loader indicates it can
     * handle the content, it will be selected. The default loader, ({{#crossLink "TextLoader"}}{{/crossLink}} is
     * last in the list, so it will be used if no other match is found. Typically, loaders will match based on the
     * {{#crossLink "LoadItem/type"}}{{/crossLink}}, which is automatically determined using the file extension of
     * the {{#crossLink "LoadItem/src:property"}}{{/crossLink}}.
     *
     * Loaders can be removed from PreloadJS by simply not including them.
     *
     * Custom loaders installed using {{#crossLink "registerLoader"}}{{/crossLink}} will be prepended to this list
     * so that they are checked first.
     * @property _availableLoaders
     * @type {Array}
     * @private
     * @since 0.6.0
     */
    this._availableLoaders = [
      FontLoader,
      ImageLoader,
      JavaScriptLoader,
      CSSLoader,
      JSONLoader,
      JSONPLoader,
      SoundLoader,
      ManifestLoader,
      SpriteSheetLoader,
      XMLLoader,
      SVGLoader,
      BinaryLoader,
      VideoLoader,
      TextLoader
    ];

    /**
     * The number of built in loaders, so they can't be removed by {{#crossLink "unregisterLoader"}}{{/crossLink}.
     * @property _defaultLoaderLength
     * @type {Number}
     * @private
     * @since 0.6.0
     */
    this._defaultLoaderLength = this._availableLoaders.length;

    this.init(preferXHR, basePath, crossOrigin);
  }
  /**
   * An internal initialization method, which is used for initial set up, but also to reset the LoadQueue.
   * @method init
   * @param preferXHR
   * @param basePath
   * @param crossOrigin
   * @private
   */
  init = function (preferXHR, basePath, crossOrigin) {

    // public properties

    /**
     * Try and use XMLHttpRequest (XHR) when possible. Note that LoadQueue will default to tag loading or XHR
     * loading depending on the requirements for a media type. For example, HTML audio can not be loaded with XHR,
     * and plain text can not be loaded with tags, so it will default the the correct type instead of using the
     * user-defined type.
     * @type {Boolean}
     * @default true
     * @since 0.6.0
     */
    this.preferXHR = true; //TODO: Get/Set
    this._preferXHR = true;
    this.setPreferXHR(preferXHR);

    // protected properties
    /**
     * Whether the queue is currently paused or not.
     * @property _paused
     * @type {boolean}
     * @private
     */
    this._paused = false;

    /**
     * A path that will be prepended on to the item's {{#crossLink "LoadItem/src:property"}}{{/crossLink}}. The
     * `_basePath` property will only be used if an item's source is relative, and does not include a protocol such
     * as `http://`, or a relative path such as `../`.
     * @property _basePath
     * @type {String}
     * @private
     * @since 0.3.1
     */
    this._basePath = basePath;

    /**
     * An optional flag to set on images that are loaded using PreloadJS, which enables CORS support. Images loaded
     * cross-domain by servers that support CORS require the crossOrigin flag to be loaded and interacted with by
     * a canvas. When loading locally, or with a server with no CORS support, this flag can cause other security issues,
     * so it is recommended to only set it if you are sure the server supports it. Currently, supported values are ""
     * and "Anonymous".
     * @property _crossOrigin
     * @type {String}
     * @default ""
     * @private
     * @since 0.4.1
     */
    this._crossOrigin = crossOrigin;

    /**
     * Determines if the loadStart event was dispatched already. This event is only fired one time, when the first
     * file is requested.
     * @property _loadStartWasDispatched
     * @type {Boolean}
     * @default false
     * @private
     */
    this._loadStartWasDispatched = false;

    /**
     * Determines if there is currently a script loading. This helps ensure that only a single script loads at once when
     * using a script tag to do preloading.
     * @property _currentlyLoadingScript
     * @type {Boolean}
     * @private
     */
    this._currentlyLoadingScript = null;

    /**
     * An array containing the currently downloading files.
     * @property _currentLoads
     * @type {Array}
     * @private
     */
    this._currentLoads = [];

    /**
     * An array containing the queued items that have not yet started downloading.
     * @property _loadQueue
     * @type {Array}
     * @private
     */
    this._loadQueue = [];

    /**
     * An array containing downloads that have not completed, so that the LoadQueue can be properly reset.
     * @property _loadQueueBackup
     * @type {Array}
     * @private
     */
    this._loadQueueBackup = [];

    /**
     * An object hash of items that have finished downloading, indexed by the {{#crossLink "LoadItem"}}{{/crossLink}}
     * id.
     * @property _loadItemsById
     * @type {Object}
     * @private
     */
    this._loadItemsById = {};

    /**
     * An object hash of items that have finished downloading, indexed by {{#crossLink "LoadItem"}}{{/crossLink}}
     * source.
     * @property _loadItemsBySrc
     * @type {Object}
     * @private
     */
    this._loadItemsBySrc = {};

    /**
     * An object hash of loaded items, indexed by the ID of the {{#crossLink "LoadItem"}}{{/crossLink}}.
     * @property _loadedResults
     * @type {Object}
     * @private
     */
    this._loadedResults = {};

    /**
     * An object hash of un-parsed loaded items, indexed by the ID of the {{#crossLink "LoadItem"}}{{/crossLink}}.
     * @property _loadedRawResults
     * @type {Object}
     * @private
     */
    this._loadedRawResults = {};

    /**
     * The number of items that have been requested. This helps manage an overall progress without knowing how large
     * the files are before they are downloaded. This does not include items inside of loaders such as the
     * {{#crossLink "ManifestLoader"}}{{/crossLink}}.
     * @property _numItems
     * @type {Number}
     * @default 0
     * @private
     */
    this._numItems = 0;

    /**
     * The number of items that have completed loaded. This helps manage an overall progress without knowing how large
     * the files are before they are downloaded.
     * @property _numItemsLoaded
     * @type {Number}
     * @default 0
     * @private
     */
    this._numItemsLoaded = 0;

    /**
     * A list of scripts in the order they were requested. This helps ensure that scripts are "completed" in the right
     * order.
     * @property _scriptOrder
     * @type {Array}
     * @private
     */
    this._scriptOrder = [];

    /**
     * A list of scripts that have been loaded. Items are added to this list as <code>null</code> when they are
     * requested, contain the loaded item if it has completed, but not been dispatched to the user, and <code>true</true>
     * once they are complete and have been dispatched.
     * @property _loadedScripts
     * @type {Array}
     * @private
     */
    this._loadedScripts = [];

    /**
     * The last progress amount. This is used to suppress duplicate progress events.
     * @property _lastProgress
     * @type {Number}
     * @private
     * @since 0.6.0
     */
    this._lastProgress = NaN;

  };
  /**
   * Register a custom loaders class. New loaders are given precedence over loaders added earlier and default loaders.
   * It is recommended that loaders extend {{#crossLink "AbstractLoader"}}{{/crossLink}}. Loaders can only be added
   * once, and will be prepended to the list of available loaders.
   * @method registerLoader
   * @param {Function|AbstractLoader} loader The AbstractLoader class to add.
   * @since 0.6.0
   */
  registerLoader = function (loader) {
    if (!loader || !loader.canLoadItem) {
      throw new Error("loader is of an incorrect type.");
    } else if (this._availableLoaders.indexOf(loader) != -1) {
      throw new Error("loader already exists."); //LM: Maybe just silently fail here
    }

    this._availableLoaders.unshift(loader);
  };

  /**
   * Remove a custom loader added using {{#crossLink "registerLoader"}}{{/crossLink}}. Only custom loaders can be
   * unregistered, the default loaders will always be available.
   * @method unregisterLoader
   * @param {Function|AbstractLoader} loader The AbstractLoader class to remove
   */
  unregisterLoader = function (loader) {
    let idx = this._availableLoaders.indexOf(loader);
    if (idx != -1 && idx < this._defaultLoaderLength - 1) {
      this._availableLoaders.splice(idx, 1);
    }
  };

  /**
   * Change the {{#crossLink "preferXHR:property"}}{{/crossLink}} value. Note that if this is set to `true`, it may
   * fail, or be ignored depending on the browser's capabilities and the load type.
   * @method setPreferXHR
   * @param {Boolean} value
   * @returns {Boolean} The value of {{#crossLink "preferXHR"}}{{/crossLink}} that was successfully set.
   * @since 0.6.0
   */
  setPreferXHR = function (value) {
    // Determine if we can use XHR. XHR defaults to TRUE, but the browser may not support it.
    //TODO: Should we be checking for the other XHR types? Might have to do a try/catch on the different types similar to createXHR.
    this.preferXHR = (value != false && window.XMLHttpRequest != null);
    return this.preferXHR;
  };

  /**
   * Stops all queued and loading items, and clears the queue. This also removes all internal references to loaded
   * content, and allows the queue to be used again.
   * @method removeAll
   * @since 0.3.0
   */
  removeAll = function () {
    this.remove();
  };

  /**
   * Stops an item from being loaded, and removes it from the queue. If nothing is passed, all items are removed.
   * This also removes internal references to loaded item(s).
   *
   * <h4>Example</h4>
   *
   *      queue.loadManifest([
   *          {src:"test.png", id:"png"},
   *          {src:"test.jpg", id:"jpg"},
   *          {src:"test.mp3", id:"mp3"}
   *      ]);
   *      queue.remove("png"); // Single item by ID
   *      queue.remove("png", "test.jpg"); // Items as arguments. Mixed id and src.
   *      queue.remove(["test.png", "jpg"]); // Items in an Array. Mixed id and src.
   *
   * @method remove
   * @param {String | Array} idsOrUrls* The id or ids to remove from this queue. You can pass an item, an array of
   * items, or multiple items as arguments.
   * @since 0.3.0
   */
  remove = function (idsOrUrls) {
    let args = null;

    if (idsOrUrls && !Array.isArray(idsOrUrls)) {
      args = [idsOrUrls];
    } else if (idsOrUrls) {
      args = idsOrUrls;
    } else if (arguments.length > 0) {
      return;
    }

    let itemsWereRemoved = false;

    // Destroy everything
    if (!args) {
      this.close();
      for (let n in this._loadItemsById) {
        this._disposeItem(this._loadItemsById[n]);
      }
      this.init(this.preferXHR, this._basePath);

      // Remove specific items
    } else {
      while (args.length) {
        let item = args.pop();
        let r = this.getResult(item);
        //Remove from the main load Queue
        for (let i = this._loadQueue.length - 1; i >= 0; i--) {
          let loadItem = this._loadQueue[i].getItem();
          if (loadItem.id == item || loadItem.src == item) {
            this._loadQueue.splice(i, 1)[0].cancel();
            break;
          }
        }

        //Remove from the backup queue
        for (let i = this._loadQueueBackup.length - 1; i >= 0; i--) {
          let loadItem = this._loadQueueBackup[i].getItem();
          if (loadItem.id == item || loadItem.src == item) {
            this._loadQueueBackup.splice(i, 1)[0].cancel();
            break;
          }
        }

        if (r) {
          this._disposeItem(this.getItem(item));
        } else {
          for (let i = this._currentLoads.length - 1; i >= 0; i--) {
            let loadItem = this._currentLoads[i].getItem();
            if (loadItem.id == item || loadItem.src == item) {
              this._currentLoads.splice(i, 1)[0].cancel();
              itemsWereRemoved = true;
              break;
            }
          }
        }
      }

      // If this was called during a load, try to load the next item.
      if (itemsWereRemoved) {
        this._loadNext();
      }
    }
  };

  /**
   * Stops all open loads, destroys any loaded items, and resets the queue, so all items can
   * be reloaded again by calling {{#crossLink "AbstractLoader/load"}}{{/crossLink}}. Items are not removed from the
   * queue. To remove items use the {{#crossLink "LoadQueue/remove"}}{{/crossLink}} or
   * {{#crossLink "LoadQueue/removeAll"}}{{/crossLink}} method.
   * @method reset
   * @since 0.3.0
   */
  reset = function () {
    this.close();
    for (let n in this._loadItemsById) {
      this._disposeItem(this._loadItemsById[n]);
    }

    //Reset the queue to its start state
    let a = [];
    for (let i = 0, l = this._loadQueueBackup.length; i < l; i++) {
      a.push(this._loadQueueBackup[i].getItem());
    }

    this.loadManifest(a, false);
  };

  /**
   * Register a plugin. Plugins can map to load types (sound, image, etc), or specific extensions (png, mp3, etc).
   * Currently, only one plugin can exist per type/extension.
   *
   * When a plugin is installed, a <code>getPreloadHandlers()</code> method will be called on it. For more information
   * on this method, check out the {{#crossLink "SamplePlugin/getPreloadHandlers"}}{{/crossLink}} method in the
   * {{#crossLink "SamplePlugin"}}{{/crossLink}} class.
   *
   * Before a file is loaded, a matching plugin has an opportunity to modify the load. If a `callback` is returned
   * from the {{#crossLink "SamplePlugin/getPreloadHandlers"}}{{/crossLink}} method, it will be invoked first, and its
   * result may cancel or modify the item. The callback method can also return a `completeHandler` to be fired when
   * the file is loaded, or a `tag` object, which will manage the actual download. For more information on these
   * methods, check out the {{#crossLink "SamplePlugin/preloadHandler"}}{{/crossLink}} and {{#crossLink "SamplePlugin/fileLoadHandler"}}{{/crossLink}}
   * methods on the {{#crossLink "SamplePlugin"}}{{/crossLink}}.
   *
   * @method installPlugin
   * @param {Function} plugin The plugin class to install.
   */
  installPlugin = function (plugin) {
    if (plugin == null) {
      return;
    }

    if (plugin.getPreloadHandlers != null) {
      this._plugins.push(plugin);
      let map = plugin.getPreloadHandlers();
      map.scope = plugin;

      if (map.types != null) {
        for (let i = 0, l = map.types.length; i < l; i++) {
          this._typeCallbacks[map.types[i]] = map;
        }
      }

      if (map.extensions != null) {
        for (let i = 0, l = map.extensions.length; i < l; i++) {
          this._extensionCallbacks[map.extensions[i]] = map;
        }
      }
    }
  };

  /**
   * Set the maximum number of concurrent connections. Note that browsers and servers may have a built-in maximum
   * number of open connections, so any additional connections may remain in a pending state until the browser
   * opens the connection. When loading scripts using tags, and when {{#crossLink "LoadQueue/maintainScriptOrder:property"}}{{/crossLink}}
   * is `true`, only one script is loaded at a time due to browser limitations.
   *
   * <h4>Example</h4>
   *
   *      var queue = new createjs.LoadQueue();
   *      queue.setMaxConnections(10); // Allow 10 concurrent loads
   *
   * @method setMaxConnections
   * @param {Number} value The number of concurrent loads to allow. By default, only a single connection per LoadQueue
   * is open at any time.
   */
  setMaxConnections = function (value) {
    this._maxConnections = value;
    if (!this._paused && this._loadQueue.length > 0) {
      this._loadNext();
    }
  };

  /**
   * Load a single file. To add multiple files at once, use the {{#crossLink "LoadQueue/loadManifest"}}{{/crossLink}}
   * method.
   *
   * Files are always appended to the current queue, so this method can be used multiple times to add files.
   * To clear the queue first, use the {{#crossLink "AbstractLoader/close"}}{{/crossLink}} method.
   * @method loadFile
   * @param {LoadItem|Object|String} file The file object or path to load. A file can be either
   * <ul>
   *     <li>A {{#crossLink "LoadItem"}}{{/crossLink}} instance</li>
   *     <li>An object containing properties defined by {{#crossLink "LoadItem"}}{{/crossLink}}</li>
   *     <li>OR A string path to a resource. Note that this kind of load item will be converted to a {{#crossLink "LoadItem"}}{{/crossLink}}
   *     in the background.</li>
   * </ul>
   * @param {Boolean} [loadNow=true] Kick off an immediate load (true) or wait for a load call (false). The default
   * value is true. If the queue is paused using {{#crossLink "LoadQueue/setPaused"}}{{/crossLink}}, and the value is
   * `true`, the queue will resume automatically.
   * @param {String} [basePath] A base path that will be prepended to each file. The basePath argument overrides the
   * path specified in the constructor. Note that if you load a manifest using a file of type {{#crossLink "Types/MANIFEST:property"}}{{/crossLink}},
   * its files will <strong>NOT</strong> use the basePath parameter. <strong>The basePath parameter is deprecated.</strong>
   * This parameter will be removed in a future version. Please either use the `basePath` parameter in the LoadQueue
   * constructor, or a `path` property in a manifest definition.
   */
  loadFile = function (file, loadNow, basePath) {
    if (file == null) {
      let event = new ErrorEvent("PRELOAD_NO_FILE");
      this._sendError(event);
      return;
    }
    this._addItem(file, null, basePath);

    if (loadNow !== false) {
      this.setPaused(false);
    } else {
      this.setPaused(true);
    }
  };
  /**
   * Load an array of files. To load a single file, use the {{#crossLink "LoadQueue/loadFile"}}{{/crossLink}} method.
   * The files in the manifest are requested in the same order, but may complete in a different order if the max
   * connections are set above 1 using {{#crossLink "LoadQueue/setMaxConnections"}}{{/crossLink}}. Scripts will load
   * in the right order as long as {{#crossLink "LoadQueue/maintainScriptOrder"}}{{/crossLink}} is true (which is
   * default).
   *
   * Files are always appended to the current queue, so this method can be used multiple times to add files.
   * To clear the queue first, use the {{#crossLink "AbstractLoader/close"}}{{/crossLink}} method.
   * @method loadManifest
   * @param {Array|String|Object} manifest An list of files to load. The loadManifest call supports four types of
   * manifests:
   * <ol>
   *     <li>A string path, which points to a manifest file, which is a JSON file that contains a "manifest" property,
   *     which defines the list of files to load, and can optionally contain a "path" property, which will be
   *     prepended to each file in the list.</li>
   *     <li>An object which defines a "src", which is a JSON or JSONP file. A "callback" can be defined for JSONP
   *     file. The JSON/JSONP file should contain a "manifest" property, which defines the list of files to load,
   *     and can optionally contain a "path" property, which will be prepended to each file in the list.</li>
   *     <li>An object which contains a "manifest" property, which defines the list of files to load, and can
   *     optionally contain a "path" property, which will be prepended to each file in the list.</li>
   *     <li>An Array of files to load.</li>
   * </ol>
   *
   * Each "file" in a manifest can be either:
   * <ul>
   *     <li>A {{#crossLink "LoadItem"}}{{/crossLink}} instance</li>
   *     <li>An object containing properties defined by {{#crossLink "LoadItem"}}{{/crossLink}}</li>
   *     <li>OR A string path to a resource. Note that this kind of load item will be converted to a {{#crossLink "LoadItem"}}{{/crossLink}}
   *     in the background.</li>
   * </ul>
   *
   * @param {Boolean} [loadNow=true] Kick off an immediate load (true) or wait for a load call (false). The default
   * value is true. If the queue is paused using {{#crossLink "LoadQueue/setPaused"}}{{/crossLink}} and this value is
   * `true`, the queue will resume automatically.
   * @param {String} [basePath] A base path that will be prepended to each file. The basePath argument overrides the
   * path specified in the constructor. Note that if you load a manifest using a file of type {{#crossLink "LoadQueue/MANIFEST:property"}}{{/crossLink}},
   * its files will <strong>NOT</strong> use the basePath parameter. <strong>The basePath parameter is deprecated.</strong>
   * This parameter will be removed in a future version. Please either use the `basePath` parameter in the LoadQueue
   * constructor, or a `path` property in a manifest definition.
   */
  loadManifest = function (manifest, loadNow, basePath) {
    let fileList = null;
    let path = null;

    // Array-based list of items
    if (Array.isArray(manifest)) {
      if (manifest.length == 0) {
        let event = new ErrorEvent("PRELOAD_MANIFEST_EMPTY");
        this._sendError(event);
        return;
      }
      fileList = manifest;

      // String-based. Only file manifests can be specified this way. Any other types will cause an error when loaded.
    } else if (typeof(manifest) === "string") {
      fileList = [
        {
          src: manifest,
          type: LoadQueue.MANIFEST
        }
      ];

    } else if (typeof(manifest) == "object") {

      // An object that defines a manifest path
      if (manifest.src !== undefined) {
        if (manifest.type == null) {
          manifest.type = LoadQueue.MANIFEST;
        } else if (manifest.type != LoadQueue.MANIFEST) {
          let event = new ErrorEvent("PRELOAD_MANIFEST_TYPE");
          this._sendError(event);
        }
        fileList = [manifest];

        // An object that defines a manifest
      } else if (manifest.manifest !== undefined) {
        fileList = manifest.manifest;
        path = manifest.path;
      }

      // Unsupported. This will throw an error.
    } else {
      let event = new ErrorEvent("PRELOAD_MANIFEST_NULL");
      this._sendError(event);
      return;
    }

    for (let i = 0, l = fileList.length; i < l; i++) {
      this._addItem(fileList[i], path, basePath);
    }

    if (loadNow !== false) {
      this.setPaused(false);
    } else {
      this.setPaused(true);
    }

  };
  /**
   * Start a LoadQueue that was created, but not automatically started.
   * @method load
   */
  load = function () {
    this.setPaused(false);
  };

  /**
   * Look up a {{#crossLink "LoadItem"}}{{/crossLink}} using either the "id" or "src" that was specified when loading it. Note that if no "id" was
   * supplied with the load item, the ID will be the "src", including a `path` property defined by a manifest. The
   * `basePath` will not be part of the ID.
   * @method getItem
   * @param {String} value The <code>id</code> or <code>src</code> of the load item.
   * @return {Object} The load item that was initially requested using {{#crossLink "LoadQueue/loadFile"}}{{/crossLink}}
   * or {{#crossLink "LoadQueue/loadManifest"}}{{/crossLink}}. This object is also returned via the {{#crossLink "LoadQueue/fileload:event"}}{{/crossLink}}
   * event as the `item` parameter.
   */
  getItem = function (value) {
    return this._loadItemsById[value] || this._loadItemsBySrc[value];
  };

  /**
   * Look up a loaded result using either the "id" or "src" that was specified when loading it. Note that if no "id"
   * was supplied with the load item, the ID will be the "src", including a `path` property defined by a manifest. The
   * `basePath` will not be part of the ID.
   * @method getResult
   * @param {String} value The <code>id</code> or <code>src</code> of the load item.
   * @param {Boolean} [rawResult=false] Return a raw result instead of a formatted result. This applies to content
   * loaded via XHR such as scripts, XML, CSS, and Images. If there is no raw result, the formatted result will be
   * returned instead.
   * @return {Object} A result object containing the content that was loaded, such as:
   * <ul>
   *      <li>An image tag (&lt;image /&gt;) for images</li>
   *      <li>A script tag for JavaScript (&lt;script /&gt;). Note that scripts are automatically added to the HTML
   *      DOM.</li>
   *      <li>A style tag for CSS (&lt;style /&gt; or &lt;link &gt;)</li>
   *      <li>Raw text for TEXT</li>
   *      <li>A formatted JavaScript object defined by JSON</li>
   *      <li>An XML document</li>
   *      <li>A binary arraybuffer loaded by XHR</li>
   *      <li>An audio tag (&lt;audio &gt;) for HTML audio. Note that it is recommended to use SoundJS APIs to play
   *      loaded audio. Specifically, audio loaded by Flash and WebAudio will return a loader object using this method
   *      which can not be used to play audio back.</li>
   * </ul>
   * This object is also returned via the {{#crossLink "LoadQueue/fileload:event"}}{{/crossLink}} event as the 'item`
   * parameter. Note that if a raw result is requested, but not found, the result will be returned instead.
   */
  getResult = function (value, rawResult) {
    let item = this._loadItemsById[value] || this._loadItemsBySrc[value];
    if (item == null) {
      return null;
    }
    let id = item.id;
    if (rawResult && this._loadedRawResults[id]) {
      return this._loadedRawResults[id];
    }
    return this._loadedResults[id];
  };

  /**
   * Generate an list of items loaded by this queue.
   * @method getItems
   * @param {Boolean} loaded Determines if only items that have been loaded should be returned. If false, in-progress
   * and failed load items will also be included.
   * @returns {Array} A list of objects that have been loaded. Each item includes the {{#crossLink "LoadItem"}}{{/crossLink}},
   * result, and rawResult.
   * @since 0.6.0
   */
  getItems = function (loaded) {
    let arr = [];
    for (let n in this._loadItemsById) {
      let item = this._loadItemsById[n];
      let result = this.getResult(n);
      if (loaded === true && result == null) {
        continue;
      }
      arr.push({
        item: item,
        result: result,
        rawResult: this.getResult(n, true)
      });
    }
    return arr;
  };

  /**
   * Pause or resume the current load. Active loads will not be cancelled, but the next items in the queue will not
   * be processed when active loads complete. LoadQueues are not paused by default.
   *
   * Note that if new items are added to the queue using {{#crossLink "LoadQueue/loadFile"}}{{/crossLink}} or
   * {{#crossLink "LoadQueue/loadManifest"}}{{/crossLink}}, a paused queue will be resumed, unless the `loadNow`
   * argument is `false`.
   * @method setPaused
   * @param {Boolean} value Whether the queue should be paused or not.
   */
  setPaused = function (value) {
    this._paused = value;
    if (!this._paused) {
      this._loadNext();
    }
  };

  /**
   * Close the active queue. Closing a queue completely empties the queue, and prevents any remaining items from
   * starting to download. Note that currently any active loads will remain open, and events may be processed.
   *
   * To stop and restart a queue, use the {{#crossLink "LoadQueue/setPaused"}}{{/crossLink}} method instead.
   * @method close
   */
  close = function () {
    while (this._currentLoads.length) {
      this._currentLoads.pop().cancel();
    }
    this._scriptOrder.length = 0;
    this._loadedScripts.length = 0;
    this.loadStartWasDispatched = false;
    this._itemCount = 0;
    this._lastProgress = NaN;
  };

// protected methods
  /**
   * Add an item to the queue. Items are formatted into a usable object containing all the properties necessary to
   * load the content. The load queue is populated with the loader instance that handles preloading, and not the load
   * item that was passed in by the user. To look up the load item by id or src, use the {{#crossLink "LoadQueue.getItem"}}{{/crossLink}}
   * method.
   * @method _addItem
   * @param {String|Object} value The item to add to the queue.
   * @param {String} [path] An optional path prepended to the `src`. The path will only be prepended if the src is
   * relative, and does not start with a protocol such as `http://`, or a path like `../`. If the LoadQueue was
   * provided a {{#crossLink "_basePath"}}{{/crossLink}}, then it will optionally be prepended after.
   * @param {String} [basePath] <strong>Deprecated</strong>An optional basePath passed into a {{#crossLink "LoadQueue/loadManifest"}}{{/crossLink}}
   * or {{#crossLink "LoadQueue/loadFile"}}{{/crossLink}} call. This parameter will be removed in a future tagged
   * version.
   * @private
   */
  _addItem = function (value, path, basePath) {
    let item = this._createLoadItem(value, path, basePath); // basePath and manifest path are added to the src.
    if (item == null) {
      return;
    } // Sometimes plugins or types should be skipped.
    let loader = this._createLoader(item);
    if (loader != null) {
      if ("plugins" in loader) {
        loader.plugins = this._plugins;
      }
      item._loader = loader;
      this._loadQueue.push(loader);
      this._loadQueueBackup.push(loader);

      this._numItems++;
      this._updateProgress();

      // Only worry about script order when using XHR to load scripts. Tags are only loading one at a time.
      if ((this.maintainScriptOrder
          && item.type == Types.JAVASCRIPT
          //&& loader instanceof createjs.XHRLoader //NOTE: Have to track all JS files this way
        )
        || item.maintainOrder === true) {
        this._scriptOrder.push(item);
        this._loadedScripts.push(null);
      }
    }
  };

  /**
   * Create a refined {{#crossLink "LoadItem"}}{{/crossLink}}, which contains all the required properties. The type of
   * item is determined by browser support, requirements based on the file type, and developer settings. For example,
   * XHR is only used for file types that support it in new browsers.
   *
   * Before the item is returned, any plugins registered to handle the type or extension will be fired, which may
   * alter the load item.
   * @method _createLoadItem
   * @param {String | Object | HTMLAudioElement | HTMLImageElement} value The item that needs to be preloaded.
   * @param {String} [path] A path to prepend to the item's source. Sources beginning with http:// or similar will
   * not receive a path. Since PreloadJS 0.4.1, the src will be modified to include the `path` and {{#crossLink "LoadQueue/_basePath:property"}}{{/crossLink}}
   * when it is added.
   * @param {String} [basePath] <strong>Deprectated</strong> A base path to prepend to the items source in addition to
   * the path argument.
   * @return {Object} The loader instance that will be used.
   * @private
   */
  _createLoadItem = function (value, path, basePath) {
    let item = LoadItem.create(value);
    if (item == null) {
      return null;
    }

    let bp = ""; // Store the generated basePath
    let useBasePath = basePath || this._basePath;

    if (item.src instanceof Object) {
      if (!item.type) {
        return null;
      } // the the src is an object, type is required to pass off to plugin
      if (path) {
        bp = path;
        let pathMatch = URLUtils.parseURI(path);
        // Also append basePath
        if (useBasePath != null && !pathMatch.absolute && !pathMatch.relative) {
          bp = useBasePath + bp;
        }
      } else if (useBasePath != null) {
        bp = useBasePath;
      }
    } else {
      // Determine Extension, etc.
      let match = URLUtils.parseURI(item.src);
      if (match.extension) {
        item.ext = match.extension;
      }
      if (item.type == null) {
        item.type = RequestUtils.getTypeByExtension(item.ext);
      }

      // Inject path & basePath
      let autoId = item.src;
      if (!match.absolute && !match.relative) {
        if (path) {
          bp = path;
          let pathMatch = URLUtils.parseURI(path);
          autoId = path + autoId;
          // Also append basePath
          if (useBasePath != null && !pathMatch.absolute && !pathMatch.relative) {
            bp = useBasePath + bp;
          }
        } else if (useBasePath != null) {
          bp = useBasePath;
        }
      }
      item.src = bp + item.src;
    }
    item.path = bp;

    // If there's no id, set one now.
    if (item.id === undefined || item.id === null || item.id === "") {
      item.id = autoId;
    }

    // Give plugins a chance to modify the loadItem:
    let customHandler = this._typeCallbacks[item.type] || this._extensionCallbacks[item.ext];
    if (customHandler) {
      // Plugins are now passed both the full source, as well as a combined path+basePath (appropriately)
      let result = customHandler.callback.call(customHandler.scope, item, this);

      // The plugin will handle the load, or has canceled it. Ignore it.
      if (result === false) {
        return null;

        // Load as normal:
      } else if (result === true) {
        // Do Nothing

        // Result is a loader class:
      } else if (result != null) {
        item._loader = result;
      }

      // Update the extension in case the type changed:
      let match = URLUtils.parseURI(item.src);
      if (match.extension != null) {
        item.ext = match.extension;
      }
    }

    // Store the item for lookup. This also helps clean-up later.
    this._loadItemsById[item.id] = item;
    this._loadItemsBySrc[item.src] = item;

    if (item.crossOrigin == null) {
      item.crossOrigin = this._crossOrigin;
    }

    return item;
  };

  /**
   * Create a loader for a load item.
   * @method _createLoader
   * @param {Object} item A formatted load item that can be used to generate a loader.
   * @return {AbstractLoader} A loader that can be used to load content.
   * @private
   */
  _createLoader = function (item) {
    if (item._loader != null) { // A plugin already specified a loader
      return item._loader;
    }

    // Initially, try and use the provided/supported XHR mode:
    let preferXHR = this.preferXHR;

    for (let i = 0; i < this._availableLoaders.length; i++) {
      let loader = this._availableLoaders[i];
      if (loader && loader.canLoadItem(item)) {
        return new loader(item, preferXHR);
      }
    }

    // TODO: Log error (requires createjs.log)
    return null;
  };

  /**
   * Load the next item in the queue. If the queue is empty (all items have been loaded), then the complete event
   * is processed. The queue will "fill up" any empty slots, up to the max connection specified using
   * {{#crossLink "LoadQueue.setMaxConnections"}}{{/crossLink}} method. The only exception is scripts that are loaded
   * using tags, which have to be loaded one at a time to maintain load order.
   * @method _loadNext
   * @private
   */
  _loadNext = function () {
    if (this._paused) {
      return;
    }

    // Only dispatch loadstart event when the first file is loaded.
    if (!this._loadStartWasDispatched) {
      this._sendLoadStart();
      this._loadStartWasDispatched = true;
    }

    // The queue has completed.
    if (this._numItems == this._numItemsLoaded) {
      this.loaded = true;
      this._sendComplete();

      // Load the next queue, if it has been defined.
      if (this.next && this.next.load) {
        this.next.load();
      }
    } else {
      this.loaded = false;
    }

    // Must iterate forwards to load in the right order.
    for (let i = 0; i < this._loadQueue.length; i++) {
      if (this._currentLoads.length >= this._maxConnections) {
        break;
      }
      let loader = this._loadQueue[i];

      // Determine if we should be only loading one tag-script at a time:
      // Note: maintainOrder items don't do anything here because we can hold onto their loaded value
      if (!this._canStartLoad(loader)) {
        continue;
      }
      this._loadQueue.splice(i, 1);
      i--;
      this._loadItem(loader);
    }
  };

  /**
   * Begin loading an item. Event listeners are not added to the loaders until the load starts.
   * @method _loadItem
   * @param {AbstractLoader} loader The loader instance to start. Currently, this will be an XHRLoader or TagLoader.
   * @private
   */
  _loadItem = function (loader) {
    loader.on("fileload", this._handleFileLoad, this);
    loader.on("progress", this._handleProgress, this);
    loader.on("complete", this._handleFileComplete, this);
    loader.on("error", this._handleError, this);
    loader.on("fileerror", this._handleFileError, this);
    this._currentLoads.push(loader);
    this._sendFileStart(loader.getItem());
    loader.load();
  };

  /**
   * The callback that is fired when a loader loads a file. This enables loaders like {{#crossLink "ManifestLoader"}}{{/crossLink}}
   * to maintain internal queues, but for this queue to dispatch the {{#crossLink "fileload:event"}}{{/crossLink}}
   * events.
   * @param {Event} event The {{#crossLink "AbstractLoader/fileload:event"}}{{/crossLink}} event from the loader.
   * @private
   * @since 0.6.0
   */
  _handleFileLoad = function (event) {
    event.target = null;
    this.dispatchEvent(event);
  };

  /**
   * The callback that is fired when a loader encounters an error from an internal file load operation. This enables
   * loaders like M
   * @param event
   * @private
   */
  _handleFileError = function (event) {
    let newEvent = new ErrorEvent("FILE_LOAD_ERROR", null, event.item);
    this._sendError(newEvent);
  };

  /**
   * The callback that is fired when a loader encounters an error. The queue will continue loading unless {{#crossLink "LoadQueue/stopOnError:property"}}{{/crossLink}}
   * is set to `true`.
   * @method _handleError
   * @param {ErrorEvent} event The error event, containing relevant error information.
   * @private
   */
  _handleError = function (event) {
    let loader = event.target;
    this._numItemsLoaded++;

    this._finishOrderedItem(loader, true);
    this._updateProgress();

    let newEvent = new ErrorEvent("FILE_LOAD_ERROR", null, loader.getItem());
    // TODO: Propagate actual error message.

    this._sendError(newEvent);

    if (!this.stopOnError) {
      this._removeLoadItem(loader);
      this._cleanLoadItem(loader);
      this._loadNext();
    } else {
      this.setPaused(true);
    }
  };

  /**
   * An item has finished loading. We can assume that it is totally loaded, has been parsed for immediate use, and
   * is available as the "result" property on the load item. The raw text result for a parsed item (such as JSON, XML,
   * CSS, JavaScript, etc) is available as the "rawResult" property, and can also be looked up using {{#crossLink "LoadQueue/getResult"}}{{/crossLink}}.
   * @method _handleFileComplete
   * @param {Event} event The event object from the loader.
   * @private
   */
  _handleFileComplete = function (event) {
    let loader = event.target;
    let item = loader.getItem();

    let result = loader.getResult();
    this._loadedResults[item.id] = result;
    let rawResult = loader.getResult(true);
    if (rawResult != null && rawResult !== result) {
      this._loadedRawResults[item.id] = rawResult;
    }

    this._saveLoadedItems(loader);

    // Remove the load item
    this._removeLoadItem(loader);

    if (!this._finishOrderedItem(loader)) {
      // The item was NOT managed, so process it now
      this._processFinishedLoad(item, loader);
    }

    // Clean up the load item
    this._cleanLoadItem(loader);
  };

  /**
   * Some loaders might load additional content, other than the item they were passed (such as {{#crossLink "ManifestLoader"}}{{/crossLink}}).
   * Any items exposed by the loader using {{#crossLink "AbstractLoader/getLoadItems"}}{{/crossLink}} are added to the
   * LoadQueue's look-ups, including {{#crossLink "getItem"}}{{/crossLink}} and {{#crossLink "getResult"}}{{/crossLink}}
   * methods.
   * @method _saveLoadedItems
   * @param {AbstractLoader} loader
   * @protected
   * @since 0.6.0
   */
  _saveLoadedItems = function (loader) {
    // TODO: Not sure how to handle this. Would be nice to expose the items.
    // Loaders may load sub-items. This adds them to this queue
    let list = loader.getLoadedItems();
    if (list === null) {
      return;
    }

    for (let i = 0; i < list.length; i++) {
      let item = list[i].item;

      // Store item lookups
      this._loadItemsBySrc[item.src] = item;
      this._loadItemsById[item.id] = item;

      // Store loaded content
      this._loadedResults[item.id] = list[i].result;
      this._loadedRawResults[item.id] = list[i].rawResult;
    }
  };

  /**
   * Flag an item as finished. If the item's order is being managed, then ensure that it is allowed to finish, and if
   * so, trigger prior items to trigger as well.
   * @method _finishOrderedItem
   * @param {AbstractLoader} loader
   * @param {Boolean} loadFailed
   * @return {Boolean} If the item's order is being managed. This allows the caller to take an alternate
   * behaviour if it is.
   * @private
   */
  _finishOrderedItem = function (loader, loadFailed) {
    let item = loader.getItem();

    if ((this.maintainScriptOrder && item.type == Types.JAVASCRIPT)
      || item.maintainOrder) {

      //TODO: Evaluate removal of the _currentlyLoadingScript
      if (loader instanceof JavaScriptLoader) {
        this._currentlyLoadingScript = false;
      }

      let index = Base.indexOf(this._scriptOrder, item);
      if (index == -1) {
        return false;
      } // This loader no longer exists
      this._loadedScripts[index] = (loadFailed === true) ? true : item;

      this._checkScriptLoadOrder();
      return true;
    }

    return false;
  };

  /**
   * Ensure the scripts load and dispatch in the correct order. When using XHR, scripts are stored in an array in the
   * order they were added, but with a "null" value. When they are completed, the value is set to the load item,
   * and then when they are processed and dispatched, the value is set to `true`. This method simply
   * iterates the array, and ensures that any loaded items that are not preceded by a `null` value are
   * dispatched.
   * @method _checkScriptLoadOrder
   * @private
   */
  _checkScriptLoadOrder = function () {
    let l = this._loadedScripts.length;

    for (let i = 0; i < l; i++) {
      let item = this._loadedScripts[i];
      if (item === null) {
        break;
      } // This is still loading. Do not process further.
      if (item === true) {
        continue;
      } // This has completed, and been processed. Move on.

      let loadItem = this._loadedResults[item.id];
      if (item.type == Types.JAVASCRIPT) {
        // Append script tags to the head automatically.
        DomUtils.appendToHead(loadItem);
      }

      let loader = item._loader;
      this._processFinishedLoad(item, loader);
      this._loadedScripts[i] = true;
    }
  };

  /**
   * A file has completed loading, and the LoadQueue can move on. This triggers the complete event, and kick-starts
   * the next item.
   * @method _processFinishedLoad
   * @param {LoadItem|Object} item
   * @param {AbstractLoader} loader
   * @protected
   */
  _processFinishedLoad = function (item, loader) {
    this._numItemsLoaded++;

    // Since LoadQueue needs maintain order, we can't append scripts in the loader.
    // So we do it here instead. Or in _checkScriptLoadOrder();
    if (!this.maintainScriptOrder && item.type == Types.JAVASCRIPT) {
      let tag = loader.getTag();
      DomUtils.appendToHead(tag);
    }

    this._updateProgress();
    this._sendFileComplete(item, loader);
    this._loadNext();
  };

  /**
   * Ensure items with `maintainOrder=true` that are before the specified item have loaded. This only applies to
   * JavaScript items that are being loaded with a TagLoader, since they have to be loaded and completed <strong>before</strong>
   * the script can even be started, since it exist in the DOM while loading.
   * @method _canStartLoad
   * @param {AbstractLoader} loader The loader for the item
   * @return {Boolean} Whether the item can start a load or not.
   * @private
   */
  _canStartLoad = function (loader) {
    if (!this.maintainScriptOrder || loader.preferXHR) {
      return true;
    }
    let item = loader.getItem();
    if (item.type != Types.JAVASCRIPT) {
      return true;
    }
    if (this._currentlyLoadingScript) {
      return false;
    }

    let index = this._scriptOrder.indexOf(item);
    let i = 0;
    while (i < index) {
      let checkItem = this._loadedScripts[i];
      if (checkItem == null) {
        return false;
      }
      i++;
    }
    this._currentlyLoadingScript = true;
    return true;
  };

  /**
   * A load item is completed or was canceled, and needs to be removed from the LoadQueue.
   * @method _removeLoadItem
   * @param {AbstractLoader} loader A loader instance to remove.
   * @private
   */
  _removeLoadItem = function (loader) {
    let l = this._currentLoads.length;
    for (let i = 0; i < l; i++) {
      if (this._currentLoads[i] == loader) {
        this._currentLoads.splice(i, 1);
        break;
      }
    }
  };

  /**
   * Remove unneeded references from a loader.
   *
   * @param loader
   * @private
   */
  _cleanLoadItem = function(loader) {
    let item = loader.getItem();
    loader.removeAllEventListeners();
    if (item) {
      delete item._loader;
    }
  }

  /**
   * An item has dispatched progress. Propagate that progress, and update the LoadQueue's overall progress.
   * @method _handleProgress
   * @param {ProgressEvent} event The progress event from the item.
   * @private
   */
  _handleProgress = function (event) {
    let loader = event.target;
    this._sendFileProgress(loader.getItem(), loader.progress);
    this._updateProgress();
  };

  /**
   * Overall progress has changed, so determine the new progress amount and dispatch it. This changes any time an
   * item dispatches progress or completes. Note that since we don't always know the actual filesize of items before
   * they are loaded. In this case, we define a "slot" for each item (1 item in 10 would get 10%), and then append
   * loaded progress on top of the already-loaded items.
   *
   * For example, if 5/10 items have loaded, and item 6 is 20% loaded, the total progress would be:
   * <ul>
   *      <li>5/10 of the items in the queue (50%)</li>
   *      <li>plus 20% of item 6's slot (2%)</li>
   *      <li>equals 52%</li>
   * </ul>
   * @method _updateProgress
   * @private
   */
  _updateProgress = function () {
    let loaded = this._numItemsLoaded / this._numItems; // Fully Loaded Progress
    let remaining = this._numItems - this._numItemsLoaded;
    if (remaining > 0) {
      let chunk = 0;
      for (let i = 0, l = this._currentLoads.length; i < l; i++) {
        chunk += this._currentLoads[i].progress;
      }
      loaded += (chunk / remaining) * (remaining / this._numItems);
    }

    if (this._lastProgress != loaded) {
      this._sendProgress(loaded);
      this._lastProgress = loaded;
    }
  };

  /**
   * Clean out item results, to free them from memory. Mainly, the loaded item and results are cleared from internal
   * hashes.
   * @method _disposeItem
   * @param {LoadItem|Object} item The item that was passed in for preloading.
   * @private
   */
  _disposeItem = function (item) {
    delete this._loadedResults[item.id];
    delete this._loadedRawResults[item.id];
    delete this._loadItemsById[item.id];
    delete this._loadItemsBySrc[item.src];
  };

  /**
   * Dispatch a "fileprogress" {{#crossLink "Event"}}{{/crossLink}}. Please see the LoadQueue {{#crossLink "LoadQueue/fileprogress:event"}}{{/crossLink}}
   * event for details on the event payload.
   * @method _sendFileProgress
   * @param {LoadItem|Object} item The item that is being loaded.
   * @param {Number} progress The amount the item has been loaded (between 0 and 1).
   * @protected
   */
  _sendFileProgress = function (item, progress) {
    if (this._isCanceled() || this._paused) {
      return;
    }
    if (!this.hasEventListener("fileprogress")) {
      return;
    }

    //LM: Rework ProgressEvent to support this?
    let event = new Event("fileprogress");
    event.progress = progress;
    event.loaded = progress;
    event.total = 1;
    event.item = item;

    this.dispatchEvent(event);
  };

  /**
   * Dispatch a fileload {{#crossLink "Event"}}{{/crossLink}}. Please see the {{#crossLink "LoadQueue/fileload:event"}}{{/crossLink}} event for
   * details on the event payload.
   * @method _sendFileComplete
   * @param {LoadItemObject} item The item that is being loaded.
   * @param {AbstractLoader} loader
   * @protected
   */
  _sendFileComplete = function (item, loader) {
    if (this._isCanceled() || this._paused) {
      return;
    }

    let event = new Event("fileload");
    event.loader = loader;
    event.item = item;
    event.result = this._loadedResults[item.id];
    event.rawResult = this._loadedRawResults[item.id];

    // This calls a handler specified on the actual load item. Currently, the SoundJS plugin uses this.
    if (item.completeHandler) {
      item.completeHandler(event);
    }

    this.hasEventListener("fileload") && this.dispatchEvent(event);
  };

  /**
   * Dispatch a filestart {{#crossLink "Event"}}{{/crossLink}} immediately before a file starts to load. Please see
   * the {{#crossLink "LoadQueue/filestart:event"}}{{/crossLink}} event for details on the event payload.
   * @method _sendFileStart
   * @param {LoadItem|Object} item The item that is being loaded.
   * @protected
   */
  _sendFileStart = function (item) {
    let event = new Event("filestart");
    event.item = item;
    this.hasEventListener("filestart") && this.dispatchEvent(event);
  };

  toString = function () {
    return "[PreloadJS LoadQueue]";
  };

}