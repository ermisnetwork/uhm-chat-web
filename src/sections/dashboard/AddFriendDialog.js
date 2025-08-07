import React, { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  Slide,
  Stack,
  Typography,
  useTheme,
  Button,
  IconButton,
} from '@mui/material';
import { useDispatch, useSelector } from 'react-redux';
import { client } from '../../client';
import { ChatType, RoleMember } from '../../constants/commons-const';
import { SetSearchQuery, showSnackbar, UpdateIsLoading } from '../../redux/slices/app';
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
  const { activeChannels } = useSelector(state => state.channel);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchedUser, setSearchedUser] = useState(null);

  const directChannels = useMemo(() => {
    return activeChannels.filter(channel => {
      const isDirect = channel.type === ChatType.MESSAGING;
      const otherMember = Object.values(channel.state.members).find(member => member.user_id !== user_id);
      return isDirect && otherMember && otherMember.channel_role === RoleMember.OWNER;
    });
  }, [activeChannels, user_id]);

  useEffect(() => {
    let ignore = false;
    let debounceTimer;

    if (searchQuery) {
      dispatch(UpdateIsLoading({ isLoading: true }));

      const fetchUsers = async () => {
        try {
          const name = searchQuery;
          const page = 1;
          const page_size = 10;
          const result = await client.searchUsers(page, page_size, name);

          if (!ignore) setSearchedUser(result.data[0]);
        } catch (e) {
          if (!ignore) setSearchedUser(null);
        } finally {
          dispatch(UpdateIsLoading({ isLoading: false }));
        }
      };

      debounceTimer = setTimeout(fetchUsers, 400);
    } else {
      setSearchedUser(null);
      dispatch(UpdateIsLoading({ isLoading: false }));
    }

    return () => {
      ignore = true;
      clearTimeout(debounceTimer);
    };
  }, [searchQuery]);

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
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {'Add Friend'}
        <IconButton onClick={onCloseAddFriendDialog}>
          <X size={25} />
        </IconButton>
      </DialogTitle>

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
            {searchQuery ? (
              <AddFriend
                searchQuery={searchQuery}
                enableUserSearch
                onSelect={({ channel, user }) => onSelectChannel(channel, user)}
              />
            ) : (
              <Stack
                sx={{
                  alignItems: 'center',
                }}
              >
                <Typography
                  variant="contained"
                  sx={{
                    fontSize: '14px',
                    padding: '5px',
                    color: theme.palette.text.secondary,
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
            )}
          </Stack>
        </Stack>
      </DialogContent>
    </Dialog>
  );
};

export default AddFriendDialog;
