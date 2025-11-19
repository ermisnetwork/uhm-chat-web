import React, { useState, useEffect, useRef } from 'react';
import { Box, Button, Typography, Paper, Grid, TextField } from '@mui/material';
import init, { ErmisCall } from '../../assets/wasm/ermis_call_node_wasm';
import ClipboardCopy from '../../components/ClipboardCopy';
import { useMediaEncoder } from '../../hooks/useMediaEncoder';
// import { useMediaDecoder } from '../../hooks/useMediaDecoder';
import { useMediaDecoderSync } from '../../hooks/useMediaDecoderSync';

const TestCall = () => {
  const nodeRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const localVideoRef = useRef(null);
  const [publisherConnectAddress, setPublisherConnectAddress] = useState('');

  const [address, setAddress] = useState('');

  const { mediaEncoder } = useMediaEncoder(nodeRef);
  const { mediaDecoder } = useMediaDecoderSync(remoteVideoRef, nodeRef);

  useEffect(() => {
    const initWasm = async () => {
      try {
        await init();
        const node = new ErmisCall();
        await node.spawn(['https://test-iroh.ermis.network.:8443']);

        const adds = await node.getLocalEndpointAddr();
        setAddress(adds);
        // await startLocalStream();

        nodeRef.current = node;
      } catch (error) {
        console.error('Failed to initialize WASM:', error);
      }
    };

    initWasm();
  }, []);

  const startLocalStream = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      // setLocalStream(stream);
      return stream;
    } catch (error) {
      console.error('Error accessing media devices.', error);
    }
  };

  const onConnect = async () => {
    const localStream = await startLocalStream();

    await nodeRef.current.connect(publisherConnectAddress);
    await nodeRef.current.openBidiStream();
    console.log('-----opened BidiStream----');
    mediaEncoder(localStream);
    mediaDecoder();
  };

  const onAccept = async () => {
    const localStream = await startLocalStream();

    await nodeRef.current.acceptConnection();
    await nodeRef.current.acceptBidiStream();
    console.log('-----acceptBidiStream----');
    mediaDecoder();
    mediaEncoder(localStream);
  };

  return (
    <Grid container spacing={3} sx={{ p: 3 }}>
      {address && (
        <Grid item xs={12}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, wordBreak: 'break-all' }}>
            <Typography variant="h5" align="center" gutterBottom>
              {address}
            </Typography>
            <ClipboardCopy text={address} />
          </Box>
        </Grid>
      )}

      {/* Local Column */}
      <Grid item xs={12} md={6}>
        <Paper elevation={3} sx={{ p: 3 }}>
          <Typography variant="h5" align="center" gutterBottom>
            Local
          </Typography>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <TextField
                fullWidth
                placeholder="Enter address to connect"
                value={publisherConnectAddress}
                onChange={e => setPublisherConnectAddress(e.target.value)}
                size="small"
              />
              <Button variant="contained" onClick={onConnect} sx={{ minWidth: '120px' }}>
                Connect
              </Button>
            </Box>
          </Box>

          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '20px 0px',
            }}
          >
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              controls={false}
              muted
              style={{
                width: '100%',
                height: '60vh',
                aspectRatio: '16/9',
                border: '2px solid #fff',
                borderRadius: '12px',
                backgroundColor: '#000',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)',
              }}
            />
          </Box>
        </Paper>
      </Grid>

      {/* Remote Column */}
      <Grid item xs={12} md={6}>
        <Paper elevation={3} sx={{ p: 3 }}>
          <Typography variant="h5" align="center" gutterBottom>
            Remote
          </Typography>

          <Button variant="contained" fullWidth onClick={onAccept}>
            Accept call
          </Button>

          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '20px 0px',
            }}
          >
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              controls={false}
              style={{
                width: '100%',
                height: '60vh',
                aspectRatio: '16/9',
                border: '2px solid #fff',
                borderRadius: '12px',
                backgroundColor: '#000',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)',
              }}
            />
          </Box>
        </Paper>
      </Grid>
    </Grid>
  );
};

export default TestCall;
