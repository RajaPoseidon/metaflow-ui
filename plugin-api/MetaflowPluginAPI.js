const VERSION_INFO = {
  api: '1.2.0',
};

const DataListeners = [];
const EventListeners = [];
let initialised = false;
let onReadyFn = () => null;

const PluginInfo = {
  slot: null,
  manifest: null,
};

function messageHandler(event) {
  if (event.data && event.data.type) {
    switch (event.data.type) {
      case 'ReadyToRender': {
        if (!initialised) {
          Metaflow.parameters = event.data.config;
          Metaflow.resource = event.data.resource;
          Metaflow.settings = event.data.settings;
          PluginInfo.manifest = event.data.config;
          PluginInfo.slot = event.data.config?.config?.slot;
          initialised = true;
          if (onReadyFn) {
            onReadyFn(Metaflow.parameters, Metaflow.resource, Metaflow.settings);
          }
        }
        return;
      }
      case 'DataUpdate': {
        for (const listener of DataListeners) {
          if (event.data.path && listener.paths.includes(event.data.path)) {
            listener.callback(event.data);
          }
        }
        return;
      }
      case 'EventUpdate': {
        for (const listener of EventListeners) {
          listener(event.data);
        }
        return;
      }
      default:
        return;
    }
  }
}

window.addEventListener('message', messageHandler);

const Metaflow = {
  parameters: {},
  resource: {},
  /**
   * onReady function will be called with basic info like resource ids and custom server parameters.
   * @param {*} onready
   */
  onReady(onready) {
    onReadyFn = onready;
    window.parent.postMessage(
      {
        name: window.name,
        type: 'PluginRegisterEvent',
        version: VERSION_INFO,
      },
      '*',
    );
  },
  /**
   * Alias for onReady
   * @param {*} _settings Deprecated settings for register function
   * @param {*} onready   Callback to startup plugin.
   */
  register(_settings, onready) {
    if (onready) {
      this.onReady(onready);
    }
  },
  /**
   *  Update height of plugin to parent application. Useful if we want whole plugin to be visible
   * @param {number} fixedHeight Optional fixed height in pixels for plugin. If not given, we try to calculate plugin height automatically.
   */
  setHeight(fixedHeight) {
    if (fixedHeight) {
      window.parent.postMessage({ name: window.name, type: 'PluginHeightCheck', height: fixedHeight }, '*');
    } else {
      const body = document.body;
      const height = Math.max(body.scrollHeight, body.offsetHeight, body.clientHeight);
      window.parent.postMessage({ name: window.name, type: 'PluginHeightCheck', height: height }, '*');
    }
  },
  /**
   * Subscribe to data
   * @param {string[]} paths
   * @param {(event: { path: string, data: * }) => void} fn
   */
  subscribe(paths, fn) {
    DataListeners.push({ paths, callback: fn });
    window.parent.postMessage({ name: window.name, type: 'PluginSubscribeToData', paths: paths }, '*');
  },
  /**
   * Subscribe to events
   * @param {string[]} events List of event name to subscribe to
   * @param {(event: { type: string, data: * }) => void} fn Callback to trigger in case of event
   */
  on(events, fn) {
    EventListeners.push(fn);
    window.parent.postMessage({ name: window.name, type: 'PluginSubscribeToEvent', events: events }, '*');
  },
  /**
   * Call event with any name and payload. Other plugins or systems in app might subscribe to these events.
   * @param {string} event
   * @param {*} data
   */
  call(event, data) {
    window.parent.postMessage({ name: window.name, type: 'PluginCallEvent', event: event, data: data }, '*');
  },
  /**
   * Send notification on main application
   * @param {string | {type: string, message: string}} message
   */
  sendNotification(message) {
    window.parent.postMessage(
      {
        name: window.name,
        type: 'PluginCallEvent',
        event: 'SEND_NOTIFICATION',
        data: message,
      },
      '*',
    );
  },
  /**
   * Update visibility of plugin. It will remain in DOM either way.
   * @param {boolean} visible
   */
  setVisibility(visible) {
    window.parent.postMessage(
      {
        name: window.name,
        type: 'PluginCallEvent',
        event: 'UPDATE_PLUGIN',
        data: {
          slot: PluginInfo.slot,
          name: PluginInfo.manifest?.name,
          visible: visible,
        },
      },
      '*',
    );
  },
  //
  // Request to be removed?
  //
  remove() {
    window.parent.postMessage({ name: window.name, type: 'PluginRemoveRequest' }, '*');
  },

  subscribeToMetadata(fn) {
    this.subscribe(['metadata'], (data) => fn(data));
  },

  subscribeToInfo(fn) {
    this.subscribe(['info'], (data) => fn(data));
  },

  subscribeToTaskInfo(fn) {
    this.subscribe(['task-info'], (data) => fn(data));
  },

  subscribeToRunMetadata(fn) {
    this.subscribe(['run-metadata'], (data) => fn(data));
  },

  subscribeToRunInfo(fn) {
    this.subscribe(['run-info'], (data) => fn(data));
  },
};

if (typeof exports !== 'undefined') {
  exports.Metaflow = Metaflow;
}

if (typeof window !== 'undefined') {
  window.Metaflow = Metaflow;
}
