import React, { useCallback, useEffect, useState } from 'react';
import { Box, IconButton, styled, Typography, useTheme, Stack, alpha, Divider, Tabs, Tab } from '@mui/material';
import { ArrowLeft, MagnifyingGlass } from 'phosphor-react';
import { useDispatch, useSelector } from 'react-redux';
import ChannelAvatar from '@/components/ChannelAvatar';
import { Search, SearchIconWrapper, StyledInputBase } from '@/components/Search';
import { DEFAULT_PATH, TRANSITION } from '@/config';
import { useNavigate } from 'react-router-dom';
import { client } from '@/client';
import { debounce } from '@mui/material/utils';
import { LoadingSpinner } from '@/components/animate';
import AvatarComponent from '@/components/AvatarComponent';
import { removeVietnameseTones, splitChannelId, formatString, getChannelName } from '@/utils/commons';
import { AvatarShape, ChatType } from '@/constants/commons-const';
import { setSearchChannels } from '@/redux/slices/channel';
import { SetOpenHomeSearch } from '@/redux/slices/app';
import { setSearchMessageId } from '@/redux/slices/messages';
import { useTranslation } from 'react-i18next';

const StyledSearchItem = styled(Box)(({ theme }) => ({
  transition: 'all .1s',
  width: '100%',
  borderRadius: '8px',
  '&:hover': {
    cursor: 'pointer',
    backgroundColor:
      theme.palette.mode === 'light' ? alpha(theme.palette.primary.main, 0.5) : theme.palette.primary.main,
  },
}));

const StyledTab = styled(Tab)(({ theme }) => ({
  textTransform: 'none',
  fontWeight: 600,
  fontSize: '13px',
  minHeight: '36px',
  padding: '6px 12px',
}));

const HomeSearch = () => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const theme = useTheme();
  const { user_id } = useSelector(state => state.auth);
  const { openHomeSearch } = useSelector(state => state.app);
  const { searchChannels, activeChannels = [] } = useSelector(state => state.channel);
  const { openTopicPanel } = useSelector(state => state.topic);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredLocalChannels, setFilteredLocalChannels] = useState([]);
  const [publicChannels, setPublicChannels] = useState([]);
  const [searchUsers, setSearchUsers] = useState([]);
  const [searchMessages, setSearchMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [tabValue, setTabValue] = useState(0);
  const users = client.state.users ? Object.values(client.state.users) : [];

  useEffect(() => {
    if (activeChannels.length) {
      const dataChannels = activeChannels.map(channel => {
        let name = '';
        const channelData = channel.data;
        if (channelData.type === ChatType.MESSAGING) {
          const otherMember = channelData.members.find(member => member.user_id !== user_id);
          if (otherMember) {
            const otherUser = users.find(user => user.id === otherMember.user_id);
            if (otherUser) {
              name = otherUser.name;
            }
          }
        } else {
          name = channelData.name;
        }

        return {
          type: channelData.type,
          id: channelData.id,
          name,
          image: channelData.image,
          public: channelData.public,
        };
      });

      dispatch(setSearchChannels(dataChannels));
    }
  }, [activeChannels, user_id]);

  function removeVietnameseTonesLocal(str) {
    return str
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D');
  }

  const debouncedSearch = useCallback(
    debounce(async term => {
      if (term) {
        try {
          // Search channels (existing)
          const channelResponse = await client.searchPublicChannel(term);
          if (channelResponse) {
            setPublicChannels(channelResponse.search_result.channels);
          }

          const searchTerm = removeVietnameseTonesLocal(term.toLowerCase());
          const results =
            searchChannels.filter(channel =>
              removeVietnameseTonesLocal(channel.name.toLowerCase()).includes(searchTerm),
            ) || [];
          setFilteredLocalChannels(results);

          // Search users
          try {
            const usersResponse = await client.searchUsers(1, 20, term);
            const userData = usersResponse?.data || usersResponse?.users || [];
            // Filter out self
            setSearchUsers(userData.filter(u => u.id !== user_id));
          } catch (err) {
            console.warn('[HomeSearch] User search failed:', err);
            setSearchUsers([]);
          }

          // Search messages (global - across all channels)
          try {
            const msgResponse = await client.searchGlobalMessages(term, 0, 20);
            setSearchMessages(msgResponse?.messages || []);
          } catch (err) {
            console.warn('[HomeSearch] Message search failed:', err);
            setSearchMessages([]);
          }
        } catch (err) {
          console.warn('[HomeSearch] Search failed:', err);
        }
        setLoading(false);
      } else {
        setLoading(false);
        setPublicChannels([]);
        setFilteredLocalChannels([]);
        setSearchUsers([]);
        setSearchMessages([]);
      }
    }, 300),
    [searchChannels],
  );

  const onFocusSearch = () => {
    dispatch(SetOpenHomeSearch(true));
  };

  const onChangeSearch = async event => {
    const query = event.target.value;
    setLoading(true);

    setSearchQuery(query);
    debouncedSearch(query);
  };

  const onCloseSearch = () => {
    setSearchQuery('');
    setFilteredLocalChannels([]);
    setPublicChannels([]);
    setSearchUsers([]);
    setSearchMessages([]);
    setLoading(false);
    setTabValue(0);
    dispatch(SetOpenHomeSearch(false));
  };

  const onSelectChannel = (channelId, channelType) => {
    navigate(`${DEFAULT_PATH}/${channelType}:${channelId}`);
    onCloseSearch();
  };

  const onSelectUser = user => {
    // Navigate to DM with user, or open user info
    const existingDm = activeChannels.find(ch => {
      if (ch.data?.type !== ChatType.MESSAGING) return false;
      const members = ch.data?.members || [];
      return members.length === 2 && members.some(m => m.user_id === user.id);
    });

    if (existingDm) {
      navigate(`${DEFAULT_PATH}/${existingDm.data.type}:${existingDm.data.id}`);
    }
    onCloseSearch();
  };

  const onSelectMessage = msg => {
    const cid = msg.cid;
    if (cid) {
      const splitCID = splitChannelId(cid);
      navigate(`${DEFAULT_PATH}/${splitCID.channelType}:${splitCID.channelId}`);
      // Scroll to message after navigation
      setTimeout(() => {
        dispatch(setSearchMessageId(msg.id));
      }, 500);
    }
    onCloseSearch();
  };

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  const getDisplayName = user => {
    return user?.name || formatString(user?.id || '');
  };

  // Highlight matching text in search results
  const highlightText = (text, query) => {
    if (!text || !query) return text;
    const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
    return parts.map((part, i) =>
      part.toLowerCase() === query.toLowerCase() ? (
        <span key={i} style={{ backgroundColor: alpha(theme.palette.primary.main, 0.3), fontWeight: 600 }}>
          {part}
        </span>
      ) : (
        part
      ),
    );
  };

  const renderChannelsTab = () => (
    <Stack spacing={2}>
      {/* Your channels */}
      <Box>
        <Typography
          variant="subtitle2"
          sx={{ color: theme.palette.text.secondary, marginBottom: '10px', fontWeight: 600 }}
        >
          {t('Homesearch.your_channel')}
        </Typography>
        {filteredLocalChannels.length ? (
          <Stack spacing={1}>
            {filteredLocalChannels.map(channel => {
              const dataChannel = activeChannels.find(it => it.data.id === channel.id);
              const channelId = channel.id;
              const channelType = channel.type;
              return (
                <StyledSearchItem
                  key={channel.id}
                  sx={{
                    backgroundColor: theme.palette.mode === 'light' ? '#fff' : theme.palette.background.paper,
                  }}
                  onClick={() => onSelectChannel(channelId, channelType)}
                >
                  <Stack direction="row" alignItems={'center'} justifyContent="space-between" sx={{ padding: '12px' }}>
                    <ChannelAvatar channel={dataChannel} width={40} height={40} shape={AvatarShape.Round} />
                    <Stack sx={{ width: 'calc(100% - 40px)', paddingLeft: '15px' }}>
                      <Typography
                        variant="subtitle2"
                        sx={{
                          width: '100%',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {channel.name}
                      </Typography>
                    </Stack>
                  </Stack>
                </StyledSearchItem>
              );
            })}
          </Stack>
        ) : (
          <Typography
            variant="subtitle2"
            sx={{
              textAlign: 'center',
              fontStyle: 'italic',
              fontSize: '14px',
              color: theme.palette.text.secondary,
              fontWeight: 400,
            }}
          >
            {t('noResult')}
          </Typography>
        )}
      </Box>

      <Divider />

      {/* Public channels */}
      <Box>
        <Typography
          variant="subtitle2"
          sx={{ color: theme.palette.text.secondary, marginBottom: '10px', fontWeight: 600 }}
        >
          {t('Homesearch.public_channel')}
        </Typography>
        {publicChannels.length ? (
          <Stack spacing={1}>
            {publicChannels.map(channel => {
              const splitCID = splitChannelId(channel.cid);
              const channelId = splitCID.channelId;
              const channelType = splitCID.channelType;
              return (
                <StyledSearchItem
                  key={channel.cid}
                  sx={{
                    backgroundColor: theme.palette.mode === 'light' ? '#fff' : theme.palette.background.paper,
                  }}
                  onClick={() => onSelectChannel(channelId, channelType)}
                >
                  <Stack direction="row" alignItems={'center'} justifyContent="space-between" sx={{ padding: '12px' }}>
                    <AvatarComponent
                      name={channel.name}
                      url={channel.image}
                      width={40}
                      height={40}
                      isPublic={true}
                      shape={AvatarShape.Round}
                    />
                    <Stack sx={{ width: 'calc(100% - 40px)', paddingLeft: '15px' }}>
                      <Typography
                        variant="subtitle2"
                        sx={{
                          width: '100%',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {channel.name}
                      </Typography>
                    </Stack>
                  </Stack>
                </StyledSearchItem>
              );
            })}
          </Stack>
        ) : (
          <Typography
            variant="subtitle2"
            sx={{
              textAlign: 'center',
              fontStyle: 'italic',
              fontSize: '14px',
              color: theme.palette.text.secondary,
              fontWeight: 400,
            }}
          >
            {t('noResult')}
          </Typography>
        )}
      </Box>
    </Stack>
  );

  const renderUsersTab = () => (
    <Stack spacing={1}>
      {searchUsers.length ? (
        searchUsers.map(user => (
          <StyledSearchItem
            key={user.id}
            sx={{
              backgroundColor: theme.palette.mode === 'light' ? '#fff' : theme.palette.background.paper,
            }}
            onClick={() => onSelectUser(user)}
          >
            <Stack direction="row" alignItems={'center'} sx={{ padding: '12px' }}>
              <AvatarComponent
                name={user.name || user.id}
                url={user.image}
                width={40}
                height={40}
                shape={AvatarShape.Round}
              />
              <Stack sx={{ width: 'calc(100% - 40px)', paddingLeft: '15px' }}>
                <Typography
                  variant="subtitle2"
                  sx={{
                    width: '100%',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {getDisplayName(user)}
                </Typography>
                {user.name && (
                  <Typography
                    variant="caption"
                    sx={{
                      color: theme.palette.text.secondary,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {formatString(user.id)}
                  </Typography>
                )}
              </Stack>
            </Stack>
          </StyledSearchItem>
        ))
      ) : (
        <Typography
          variant="subtitle2"
          sx={{
            textAlign: 'center',
            fontStyle: 'italic',
            fontSize: '14px',
            color: theme.palette.text.secondary,
            fontWeight: 400,
            paddingTop: '20px',
          }}
        >
          {t('Homesearch.no_user_found')}
        </Typography>
      )}
    </Stack>
  );

  const renderMessagesTab = () => (
    <Stack spacing={1}>
      {searchMessages.length ? (
        searchMessages.map(msg => {
          const channelName = msg.channel_name || '';
          const senderName = msg.user?.name || formatString(msg.user_id || msg.user?.id || '');
          const msgText = msg.text || '';
          const truncatedText = msgText.length > 80 ? msgText.substring(0, 80) + '...' : msgText;

          return (
            <StyledSearchItem
              key={msg.id}
              sx={{
                backgroundColor: theme.palette.mode === 'light' ? '#fff' : theme.palette.background.paper,
              }}
              onClick={() => onSelectMessage(msg)}
            >
              <Stack sx={{ padding: '12px' }}>
                <Stack direction="row" alignItems="center" justifyContent="space-between">
                  <Typography
                    variant="subtitle2"
                    sx={{
                      fontWeight: 600,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      maxWidth: '70%',
                    }}
                  >
                    {senderName}
                  </Typography>
                  {channelName && (
                    <Typography
                      variant="caption"
                      sx={{
                        color: theme.palette.text.secondary,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        maxWidth: '30%',
                      }}
                    >
                      {t('Homesearch.in_channel')} {channelName}
                    </Typography>
                  )}
                </Stack>
                <Typography
                  variant="body2"
                  sx={{
                    color: theme.palette.text.secondary,
                    marginTop: '4px',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {highlightText(truncatedText, searchQuery)}
                </Typography>
                <Typography
                  variant="caption"
                  sx={{
                    color: theme.palette.text.disabled,
                    marginTop: '2px',
                  }}
                >
                  {msg.created_at ? new Date(msg.created_at).toLocaleString() : ''}
                </Typography>
              </Stack>
            </StyledSearchItem>
          );
        })
      ) : (
        <Typography
          variant="subtitle2"
          sx={{
            textAlign: 'center',
            fontStyle: 'italic',
            fontSize: '14px',
            color: theme.palette.text.secondary,
            fontWeight: 400,
            paddingTop: '20px',
          }}
        >
          {t('Homesearch.no_message_found')}
        </Typography>
      )}
    </Stack>
  );

  return (
    <>
      <Stack
        sx={{
          width: '100%',
          position: 'relative',
          zIndex: 4,
          transition: TRANSITION,
          opacity: openTopicPanel ? 0.5 : 1,
          pointerEvents: openTopicPanel ? 'none' : 'auto',
        }}
      >
        <Stack direction="row" alignItems="center" gap={1}>
          {openHomeSearch && (
            <IconButton onClick={onCloseSearch}>
              <ArrowLeft />
            </IconButton>
          )}

          <Search>
            <SearchIconWrapper>
              {loading ? (
                <LoadingSpinner size={18} color={theme.palette.text.primary} />
              ) : (
                <MagnifyingGlass size={18} color={theme.palette.text.primary} />
              )}
            </SearchIconWrapper>
            <StyledInputBase
              placeholder={t('Homesearch.search')}
              inputProps={{ 'aria-label': 'search' }}
              onFocus={onFocusSearch}
              onChange={onChangeSearch}
              value={searchQuery}
              sx={{ height: '48px' }}
            />
          </Search>
        </Stack>
      </Stack>
      <Box
        sx={{
          marginTop: '0px !important',
          padding: '15px',
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          zIndex: 3,
          backgroundColor: theme.palette.mode === 'light' ? '#fff' : theme.palette.grey[900],
          borderRadius: '16px',
          display: openHomeSearch ? 'block' : 'none',
        }}
      >
        <Stack sx={{ marginTop: '63px', height: 'calc(100% - 63px)' }}>
          {/* Tabs */}
          <Box sx={{ borderBottom: 1, borderColor: 'divider', marginBottom: '8px' }}>
            <Tabs
              value={tabValue}
              onChange={handleTabChange}
              variant="fullWidth"
              sx={{
                minHeight: '36px',
                '& .MuiTabs-indicator': {
                  height: '2px',
                },
              }}
            >
              <StyledTab label={t('Homesearch.tab_channels')} />
              <StyledTab label={t('Homesearch.tab_users')} />
              <StyledTab label={t('Homesearch.tab_messages')} />
            </Tabs>
          </Box>

          {/* Tab Content */}
          <Stack sx={{ flexGrow: 1, overflowY: 'auto' }} className="customScrollbar">
            {tabValue === 0 && renderChannelsTab()}
            {tabValue === 1 && renderUsersTab()}
            {tabValue === 2 && renderMessagesTab()}
          </Stack>
        </Stack>
      </Box>
    </>
  );
};

export default HomeSearch;
