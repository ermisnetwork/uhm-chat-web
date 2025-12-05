import { ErmisCallNode } from 'ermis-chat-js-sdk';

let nodeCall;

const initNodeCall = async () => {
  const callNodeInstance = new ErmisCallNode('/ermis_call_node_wasm_bg.wasm');
  const nodeCallSdk = await callNodeInstance.initialize();

  console.log('--nodeCallSdk--', nodeCallSdk);

  nodeCall = nodeCallSdk;

  // try {
  //   await init();
  //   const node = new ErmisCall();
  //   await node.spawn(['https://test-iroh.ermis.network.:8443']);
  //   console.log('--node--', node);

  //   nodeCall = node;
  // } catch (error) {
  //   console.error('Error initializing NodeCall:', error);
  // }
};

export { initNodeCall, nodeCall };
