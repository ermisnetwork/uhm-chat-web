import React, { useState } from 'react';
import { useTheme } from '@mui/material/styles';
import { IconButton, Stack, Typography } from '@mui/material';
import { CaretLeft } from 'phosphor-react';
import { useDispatch, useSelector } from 'react-redux';
import { showSnackbar, UpdateSidebarType } from '../../redux/slices/app';
import { SidebarType } from '../../constants/commons-const';
import { handleError } from '../../utils/commons';
import { LoadingButton } from '@mui/lab';

const SidebarKeywords = () => {
  const theme = useTheme();
  const dispatch = useDispatch();
  const { currentChannel } = useSelector(state => state.channel);
  const [isBanned, setIsBanned] = useState(false);
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [loadingButton, setLoadingButton] = useState(false);

  const onSaveClick = async () => {
    try {
      setLoadingButton(true);
      await currentChannel.banMembers(selectedMembers.map(m => m.user_id));
      dispatch(showSnackbar({ severity: 'success', message: 'Banned members successfully' }));
      setIsBanned(false);
      setSelectedMembers([]);
    } catch (error) {
      handleError(dispatch, error);
    } finally {
      setLoadingButton(false);
    }
  };

  return (
    <Stack sx={{ width: '100%', height: '100%' }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ padding: '10px 15px' }}>
        <IconButton
          onClick={() => {
            if (isBanned) {
              setIsBanned(false);
            } else {
              dispatch(UpdateSidebarType(SidebarType.Channel));
            }
          }}
        >
          <CaretLeft size={20} color={theme.palette.text.primary} />
        </IconButton>

        <Typography variant="subtitle2" sx={{ flex: 1, textAlign: 'center', fontSize: '18px' }}>
          Keywords Filtering
        </Typography>

        <LoadingButton
          variant="text"
          size="small"
          color="error"
          onClick={onSaveClick}
          disabled={selectedMembers.length === 0}
          loading={loadingButton}
          sx={{ visibility: isBanned ? 'visible' : 'hidden' }}
        >
          BANNED
        </LoadingButton>
      </Stack>

      <Stack sx={{ padding: '24px', flex: 1, minHeight: 'auto', overflow: 'hidden' }} gap={2}>
        <Stack
          className="customScrollbar"
          sx={{
            overflowY: 'auto',
            overflowX: 'hidden',
            marginLeft: '-24px!important',
            marginRight: '-24px!important',
            padding: '0 24px',
            minHeight: 'auto',
            flex: 1,
          }}
        >
          hdgh
        </Stack>
      </Stack>
    </Stack>
  );
};

export default SidebarKeywords;
