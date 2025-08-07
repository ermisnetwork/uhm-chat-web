import React, { useState } from 'react';
import { Dialog, DialogContent, DialogTitle, Slide, Stack, Typography, useTheme,Button } from '@mui/material';
import { useDispatch, useSelector } from 'react-redux';
import { client } from '../../client';
import { ChatType } from '../../constants/commons-const';
import { SetSearchQuery, showSnackbar } from '../../redux/slices/app';
import { CloseAddFriendDialog } from '../../redux/slices/dialog';
import { useNavigate } from 'react-router-dom';
import { DEFAULT_PATH } from '../../config';
import { Search, SearchIconWrapper, StyledInputBase } from '../../components/Search';
import { MagnifyingGlass, X } from 'phosphor-react';
import AddFriend from './AddFriend';
import { LoadingSpinner } from '../../components/animate';
import NoResult from '../../assets/Illustration/NoResult';

const Transition = React.forwardRef(function Transition(props, ref) {
  return <Slide direction="up" ref={ref} {...props} />;
});

const AddFriendDialog = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  const dispatch = useDispatch();
  const { openAddFriendDialog } = useSelector(state => state.dialog);
  const { isLoading } = useSelector(state => state.app);
  const { user_id } = useSelector(state => state.auth);
  const [searchQuery, setSearchQuery] = useState('');

  const onCloseAddFriendDialog = () => {
    dispatch(CloseAddFriendDialog());
  };

  const onCreateDirectChannel = async user => {
    try {
      const channel = await client.channel(ChatType.MESSAGING, {
        members: [user.id, user_id],
      });

      await channel.create();
      dispatch(showSnackbar({ severity: 'success', message: 'Invitation sent' }));
      dispatch(SetSearchQuery(''));
      onCloseAddFriendDialog();
    } catch (error) {
      dispatch(showSnackbar({ severity: 'error', message: 'Failed to send invite. Please retry' }));
    }
  };

  const onSelectChannel = async (channel, user) => {
    if (channel && user) {
      navigate(`${DEFAULT_PATH}/${channel.type}:${channel.id}`);
      dispatch(SetSearchQuery(''));
      onCloseAddFriendDialog();
      return;
    } else if (user) {
      onCreateDirectChannel(user);
      return;
    }
  };

  return (
    <Dialog
      fullWidth
      maxWidth="xs"
      open={openAddFriendDialog}
      TransitionComponent={Transition}
      keepMounted
      onClose={onCloseAddFriendDialog}
    >
      <Button
       sx={{
        top: '15px',
        right: '15px',
        position: 'absolute',
        color: 'black'
       }}
       onClick={onCloseAddFriendDialog}
      >
      <X size={25} />
      </Button>
      <DialogTitle>{'Add Friend'}</DialogTitle>

      <DialogContent sx={{ mt: 4 }}>
        <Stack spacing={3}>
          <Search>
            <SearchIconWrapper>
              {isLoading ? <LoadingSpinner size={18} /> : <MagnifyingGlass size={18} />}
            </SearchIconWrapper>
            <StyledInputBase
              placeholder="Search"
              inputProps={{ 'aria-label': 'search' }}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              sx={{ height: '48px' }}
              autoFocus
            />
          </Search>

          <Stack
            className="customScrollbar"
            sx={{
              overflowY: 'auto',
              overflowX: 'hidden',
              height: '450px',
              marginRight: '-15px!important',
              paddingRight: '12px',
            }}
          >
          {searchQuery ?
            <AddFriend
              searchQuery={searchQuery}
              enableUserSearch
              onSelect={({ channel, user }) => onSelectChannel(channel, user)}
            />
            : 
            <Stack
              sx={{
                alignItems: 'center'
              }}
            >
              <Typography 
                variant='contained'
                sx={{
                  fontSize: '14px',
                  padding: '5px',
                }}  
              >
                Search for new contact by entering their phone number or email address.
              </Typography>
                <NoResult width={160} height={300} />
                <Typography
                  variant="subtitle2"
                  sx={{
                    textAlign: 'center',
                    fontSize: 16,
                    color: theme.palette.text.primary,
                    fontWeight: 600,
                  }}
                >
                  Oops! Nothing here
                </Typography>
                <Typography
                  variant="subtitle2"
                  sx={{
                    textAlign: 'center',
                    fontSize: 14,
                    color: theme.palette.text.secondary,
                    fontWeight: 400,
                    marginTop: 1,
                  }}
                >
                  Looks like no one matches your search.
                </Typography>
            </Stack>
          }
          </Stack>
        </Stack>
      </DialogContent>
    </Dialog>
  );
};

export default AddFriendDialog;
