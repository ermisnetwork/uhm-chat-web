import { combineReducers } from 'redux';
import storage from 'redux-persist/lib/storage';
// slices
import appReducer from '@/redux/slices/app';
import authReducer from '@/redux/slices/auth';
import channelReducer from '@/redux/slices/channel';
import memberReducer from '@/redux/slices/member';
import dialogReducer from '@/redux/slices/dialog';
import messagesReducer from '@/redux/slices/messages';
import callDirectReducer from '@/redux/slices/callDirect';
import walletReducer from '@/redux/slices/wallet';
import topicReducer from '@/redux/slices/topic';

import { createTransform } from 'redux-persist';
import { parse, stringify } from 'flatted';

// ----------------------------------------------------------------------

export const transformCircular = createTransform(
  (inboundState, key) => stringify(inboundState),
  (outboundState, key) => parse(outboundState),
);

const rootPersistConfig = {
  key: 'root',
  storage,
  keyPrefix: 'redux-',
  transforms: [transformCircular],
  whitelist: ['auth'],
  blacklist: ['app', 'channel', 'message', 'member', 'dialog', 'mesages', 'callDirect', 'wallet', 'topic'],
};

const rootReducer = combineReducers({
  app: appReducer,
  auth: authReducer,
  channel: channelReducer,
  member: memberReducer,
  dialog: dialogReducer,
  messages: messagesReducer,
  callDirect: callDirectReducer,
  wallet: walletReducer,
  topic: topicReducer,
});

export { rootPersistConfig, rootReducer };
