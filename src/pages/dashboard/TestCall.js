import { useState, useEffect, useRef } from 'react';
import { Box, Button, Typography, Paper, Grid, TextField } from '@mui/material';
import init, { ErmisCall } from '../../assets/wasm/ermis_call_node_wasm';
import { useMediaPublisher2 } from '../../hooks/useMediaPublisher2';
import { useMediaConsumer2 } from '../../hooks/useMediaConsumer2';
import { useDispatch } from 'react-redux';
import ClipboardCopy from '../../components/ClipboardCopy';

const TestCall = () => {
  const distpatch = useDispatch();
  const nodeRef = useRef(null);
  const videoRef = useRef(null);
  const [publisherConnectAddress, setPublisherConnectAddress] = useState('');

  const [address, setAddress] = useState('');

  const { connectPublisher } = useMediaPublisher2(publisherConnectAddress, nodeRef);
  const { connectConsumer } = useMediaConsumer2(address, videoRef, nodeRef);

  useEffect(() => {
    const initWasm = async () => {
      try {
        await init();
        const node = new ErmisCall();
        await node.spawn(['https://test-iroh.ermis.network.:8443']);

        const adds = node.getLocalEndpointAddr();
        setAddress(adds);

        nodeRef.current = node;
        console.log('----node---', node);
      } catch (error) {
        console.error('Failed to initialize WASM:', error);
      }
    };

    initWasm();
  }, []);

  const onCreateCall = async () => {
    await nodeRef.current.connect(adds);
    console.log('-----connected to:', adds);
    await nodeRef.current.openBidiStream();
    console.log('-----opened BidiStream----');
    const message = new Uint8Array(1000);
    await nodeRef.current.asyncSend(message);
    console.log('-----sent message----', message);
  };

  const onAcceptCall = async () => {
    await nodeRef.current.acceptConnection();
    console.log('-----acceptConnection----');

    await nodeRef.current.acceptBidiStream();

    console.log('-----acceptBidiStream----');
  };

  const handleConnectPublisher = async () => {
    await nodeRef.current.connect(publisherConnectAddress);
    console.log('-----connected to:', publisherConnectAddress);
    await nodeRef.current.openBidiStream();
    console.log('-----opened BidiStream----');
    const message = new Uint8Array(1000);
    await nodeRef.current.asyncSend(message);
    console.log('-----sent message----', message);
  };

  return (
    <Grid container spacing={3} sx={{ p: 3 }}>
      <Grid item xs={12}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
          <Typography variant="h5" align="center" gutterBottom>
            {address}
          </Typography>
          <ClipboardCopy text={address} />
        </Box>
      </Grid>
      {/* Publisher Column */}
      <Grid item xs={12} md={6}>
        <Paper elevation={3} sx={{ p: 3 }}>
          <Typography variant="h5" align="center" gutterBottom>
            Publisher
          </Typography>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Button variant="contained" fullWidth onClick={onCreateCall}>
              Create call
            </Button>

            <Box sx={{ display: 'flex', gap: 1 }}>
              <TextField
                fullWidth
                placeholder="Enter address to connect"
                value={publisherConnectAddress}
                onChange={e => setPublisherConnectAddress(e.target.value)}
                size="small"
              />
              <Button variant="contained" onClick={connectPublisher} sx={{ minWidth: '120px' }}>
                Connect
              </Button>
            </Box>
          </Box>
        </Paper>
      </Grid>

      {/* Consumer Column */}
      <Grid item xs={12} md={6}>
        <Paper elevation={3} sx={{ p: 3 }}>
          <Typography variant="h5" align="center" gutterBottom>
            Consumer
          </Typography>

          <Button variant="contained" fullWidth onClick={connectConsumer}>
            Accept call
          </Button>
        </Paper>
      </Grid>

      <Grid item xs={12}>
        <Box
          sx={{
            // backgroundColor: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
        >
          <video
            ref={videoRef}
            autoPlay
            playsInline
            controls={false}
            style={{
              maxWidth: '80vw',
              maxHeight: '60vh',
              width: 'auto',
              height: 'auto',
              aspectRatio: '16/9',
              border: '2px solid #fff',
              borderRadius: '12px',
              backgroundColor: '#000',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)',
            }}
          />
        </Box>
      </Grid>
    </Grid>
  );
};

export default TestCall;
