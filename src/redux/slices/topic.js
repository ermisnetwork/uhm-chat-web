import { createSlice } from '@reduxjs/toolkit';
import { RoleMember, SidebarType } from '../../constants/commons-const';
import { client } from '../../client';
import { myRoleInChannel } from '../../utils/commons';
import { setSidebar } from './app';
import { SetMarkReadChannel } from './channel';

const initialState = {
  currentTopic: null,
  topics: [],
};

const slice = createSlice({
  name: 'topic',
  initialState,
  reducers: {
    setCurrentTopic(state, action) {
      state.currentTopic = action.payload;
    },
    setTopics(state, action) {
      state.topics = action.payload;
    },
  },
});

export default slice.reducer;

// ----------------------------------------------------------------------

export const ConnectCurrentTopic = topicId => {
  return async (dispatch, getState) => {
    try {
      if (!client) return;
      // dispatch(slice.actions.setCurrentTopic(null));
      const { user_id } = getState().auth;
      const topic = client.channel('topic', topicId);
      const messages = { limit: 25 };
      const response = await topic.query({
        messages,
      });

      if (response) {
        dispatch(setSidebar({ type: SidebarType.Channel, open: false }));
        dispatch(slice.actions.setCurrentTopic(topic));

        const myRole = myRoleInChannel(topic);
        if (![RoleMember.PENDING, RoleMember.SKIPPED].includes(myRole)) {
          setTimeout(() => {
            dispatch(SetMarkReadChannel(topic));
          }, 100);
        }
      }
    } catch (error) {}
  };
};

export const SetCurrentTopic = payload => {
  return async (dispatch, getState) => {
    dispatch(slice.actions.setCurrentTopic(payload));
  };
};

export const SetTopics = topics => {
  return async (dispatch, getState) => {
    dispatch(slice.actions.setTopics(topics));
  };
};
