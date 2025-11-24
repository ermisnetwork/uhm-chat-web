import init, { ErmisCall } from './assets/wasm/ermis_call_node_wasm';

let nodeCall;

const initNodeCall = async () => {
  try {
    await init();
    const node = new ErmisCall();
    await node.spawn(['https://test-iroh.ermis.network.:8443']);
    console.log('--node--', node);

    nodeCall = node;
  } catch (error) {
    console.error('Error initializing NodeCall:', error);
  }
};

export { initNodeCall, nodeCall };
