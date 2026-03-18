import { ErmisChat, ErmisCallNode, MlsManager, IndexedDBMlsStorage } from 'ermis-chat-js-sdk';
import * as openmlsWasm from 'ermis-chat-js-sdk/src/wasm/openmls_wasm.js';
import { API_KEY, BASE_URL, BASE_URL_PROFILE } from '@/config';
import { handleError } from '@/utils/commons';
import { LocalStorageKey } from '@/constants/localStorage-const';

let client;
let callClient;

const mlsStorage = new IndexedDBMlsStorage();
const mlsManager = new MlsManager();

// Pre-load and init WASM module (once, at import time)
let wasmReady = null;
async function loadWasm() {
  if (!wasmReady) {
    wasmReady = (async () => {
      await openmlsWasm.default('/openmls_wasm_bg.wasm');
      openmlsWasm.init();
      return openmlsWasm;
    })();
  }
  return wasmReady;
}

const customConfig = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:global.stun.twilio.com:3478' },
    {
      urls: 'turn:36.50.63.8:3478',
      username: 'hoang',
      credential: 'pass1',
    },
  ],
};

const connectUser = async (projectId, user_id, token, dispatch) => {
  client = ErmisChat.getInstance(API_KEY, projectId, {
    // timeout: 6000,
    baseURL: BASE_URL,
    // timeout: 6000,
    // logger: (type, msg) => console.log(type, msg),
  });

  // Set device ID before connecting (for WS device_id param and E2EE X-Device-ID header)
  const deviceId = await mlsStorage.getDeviceId();
  client.deviceId = deviceId;

  try {
    await client.connectUser(
      {
        api_key: API_KEY,
        id: user_id,
        name: user_id,
        image: '',
      },
      `Bearer ${token}`,
    );
    const sessionID =
      window.localStorage.getItem(LocalStorageKey.SessionId) || `cb1a4db8-33f0-43dd-a48a-${user_id.slice(-12)}`;
    const wasmPath = '/ermis_call_node_wasm_bg.wasm';
    const relayUrl = 'https://iroh-relay.ermis.network:8443';
    callClient = new ErmisCallNode(client, sessionID, wasmPath, relayUrl);

    // Initialize MLS (E2EE) manager and WebSocket event handlers
    try {
      const wasmModule = await loadWasm();
      await mlsManager.initialize(client, user_id, {
        storage: mlsStorage,
        wasmModule,
      });
      // MLS event handlers are now integrated directly in SDK's _handleClientEvent / _handleChannelEvent
    } catch (mlsErr) {
      console.warn('[MLS] Initialization failed (E2EE will be unavailable):', mlsErr);
    }

    return true;
  } catch (error) {
    handleError(dispatch, error);
    return false;
  }
};

export { client, connectUser, callClient, mlsManager };

