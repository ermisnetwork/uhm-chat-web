import React, { useState } from 'react';
import { Button, Dialog, DialogContent, DialogTitle, Slide, DialogContentText, DialogActions } from '@mui/material';
import { useDispatch, useSelector } from 'react-redux';
import { LoadingButton } from '@mui/lab';
import { onDeleteMessageForMe, setMessageIdError } from '@/redux/slices/messages';
import { handleError } from '@/utils/commons';
import { useTranslation } from 'react-i18next';

const Transition = React.forwardRef(function Transition(props, ref) {
  return <Slide direction="up" ref={ref} {...props} />;
});

const DeleteMessageForMeDialog = () => {
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const { openDialog, messageId, deleteForMe } = useSelector(state => state.messages.deleteMessageForMe);
  const { currentChannel } = useSelector(state => state.channel);
  const { currentTopic } = useSelector(state => state.topic);

  const [loadingButton, setLoadingButton] = useState(false);
  const currentChat = currentTopic ? currentTopic : currentChannel;
  const channelType = currentChannel?.type;

  const onCloseDialog = () => {
    dispatch(onDeleteMessageForMe({ openDialog: false, messageId: '', deleteForMe: false }));
  };

  const onSubmit = async () => {
    try {
      setLoadingButton(true);
      let response;
      if (channelType === 'messaging') {
        response = await currentChat.deleteMessageForMe(messageId, deleteForMe);
      } else {
        response = await currentChat.deleteMessageChannelForMe(messageId, deleteForMe);
      }
      if (response) {
        onCloseDialog();
        setLoadingButton(false);
      }
    } catch (error) {
      if (error.code === 'ERR_NETWORK') {
        dispatch(setMessageIdError(messageId));
      } else {
        handleError(dispatch, error, t);
      }
      onCloseDialog();
      setLoadingButton(false);
    }
  };

  return (
    <Dialog
      open={openDialog}
      TransitionComponent={Transition}
      keepMounted
      onClose={onCloseDialog}
      aria-describedby="alert-dialog-slide-description"
    >
      <DialogTitle>{t('deleteMessageDialog.title')}</DialogTitle>
      <DialogContent>
        <DialogContentText id="alert-dialog-slide-description">
          {t('deleteMessageDialog.message')}
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCloseDialog}>{t('deleteMessageDialog.cancel')}</Button>
        <LoadingButton onClick={onSubmit} loading={loadingButton}>
          {t('deleteMessageDialog.yes')}
        </LoadingButton>
      </DialogActions>
    </Dialog>
  );
};

export default DeleteMessageForMeDialog;
