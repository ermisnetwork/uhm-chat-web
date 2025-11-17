import { useCallback, useRef } from 'react';

export const useMediaPublisher2 = (channelId, nodeRef) => {
  const videoEncoderRef = useRef(null);
  const audioEncoderRef = useRef(null);
  const configSentRef = useRef(false);
  const videoConfigRef = useRef(null);
  const audioConfigRef = useRef(null);

  const sendPacketOrQueue = useCallback(async packet => {
    await nodeRef.current.asyncSend(packet);
  }, []);

  const base64Encode = arrayBuffer => {
    let binary = '';
    const bytes = new Uint8Array(arrayBuffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  };

  const createPacketWithHeader = useCallback((data, timestamp, type) => {
    const HEADER_SIZE = 5;
    const packet = new Uint8Array(HEADER_SIZE + data.byteLength);
    const view = new DataView(packet.buffer);
    view.setUint32(0, timestamp, false);

    // Type mapping: video-key=0, video-delta=1, audio=2
    let typeCode = 1;
    if (type === 'video-key') typeCode = 0;
    else if (type === 'audio') typeCode = 2;

    packet[4] = typeCode;
    packet.set(new Uint8Array(data), HEADER_SIZE);
    return packet;
  }, []);

  const processAudioFrames = useCallback(async reader => {
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const frame = value;

        try {
          audioEncoderRef.current.encode(frame);
        } catch (err) {
          console.error('Encoding error:', err);
        } finally {
          frame.close();
        }
      }
    } catch (error) {
      console.log(`Error processing audio frames: ${error.message}`);
    }
  }, []);

  const processVideoFrames = useCallback(async reader => {
    try {
      let frameCounter = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const frame = value;

        frameCounter += 1;
        const keyFrame = frameCounter % 30 === 0;
        try {
          videoEncoderRef.current.encode(frame, { keyFrame });
        } catch (err) {
          console.error('Encode error:', err);
        } finally {
          frame.close();
        }
      }
    } catch (error) {
      console.log(`Error processing video frames: ${error.message}`);
    }
  }, []);

  const initEncoders = useCallback(async () => {
    // init video encoder
    const videoEncoder = new VideoEncoder({
      output: (chunk, metadata) => {
        if (metadata?.decoderConfig && !configSentRef.current) {
          const description = metadata.decoderConfig.description;
          const base64Description = base64Encode(description);

          videoConfigRef.current = {
            codec: metadata.decoderConfig.codec ?? 'hev1.1.6.L93.B0',
            codedWidth: metadata.decoderConfig.codedWidth ?? 1280,
            codedHeight: metadata.decoderConfig.codedHeight ?? 720,
            frameRate: metadata.decoderConfig.framerate ?? 30.0,
            description: base64Description,
          };
        }

        if (chunk) {
          const data = new ArrayBuffer(chunk.byteLength);
          chunk.copyTo(data);
          const type = chunk.type === 'key' ? 'video-key' : 'video-delta';
          const packet = createPacketWithHeader(data, chunk.timestamp, type);
          sendPacketOrQueue(packet);
        }
      },
      error: console.error,
    });

    videoEncoder.configure({
      codec: 'hev1.1.6.L93.B0',
      width: 1280,
      height: 720,
      bitrate: 1500000,
      framerate: 30,
      latencyMode: 'realtime',
      hardwareAcceleration: 'prefer-hardware',
      // hevc: { format: 'annexb', maxBFrames: 0 },
    });

    videoEncoderRef.current = videoEncoder;

    // init audio encoder
    const audioEncoder = new AudioEncoder({
      output: (chunk, metadata) => {
        // console.log('----chunk---', chunk);
        // console.log('----metadata---', metadata);

        // Lưu audio config từ metadata
        if (metadata?.decoderConfig && !audioConfigRef.current) {
          const description = metadata.decoderConfig.description;
          const base64Description = base64Encode(description);

          audioConfigRef.current = {
            codec: metadata.decoderConfig.codec ?? 'opus',
            sampleRate: metadata.decoderConfig.sampleRate ?? 48000,
            numberOfChannels: metadata.decoderConfig.numberOfChannels ?? 2,
            description: base64Description,
          };
        }

        if (chunk) {
          const data = new ArrayBuffer(chunk.byteLength);
          chunk.copyTo(data);
          const packet = createPacketWithHeader(data, chunk.timestamp, 'audio');
          sendPacketOrQueue(packet);
        }
      },
      error: console.error,
    });

    audioEncoder.configure({
      codec: 'opus',
      sampleRate: 48000,
      numberOfChannels: 1,
      bitrate: 128000,
    });

    audioEncoderRef.current = audioEncoder;
  }, []);

  const startCapture = useCallback(
    async channelId => {
      initEncoders();

      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });

      await nodeRef.current.connect(channelId);
      await nodeRef.current.openBidiStream();
      console.log('-----opened BidiStream----');

      // Process video
      const videoTrack = stream.getVideoTracks()[0];
      const videoProcessor = new MediaStreamTrackProcessor({ track: videoTrack });
      const videoReader = videoProcessor.readable.getReader();
      processVideoFrames(videoReader);

      // Process audio
      const audioTrack = stream.getAudioTracks()[0];
      const audioProcessor = new MediaStreamTrackProcessor({ track: audioTrack });
      const audioReader = audioProcessor.readable.getReader();
      processAudioFrames(audioReader);
    },
    [initEncoders, processVideoFrames, processAudioFrames],
  );

  const connectPublisher = useCallback(() => {
    startCapture(channelId);
  }, [channelId, startCapture]);

  return { connectPublisher };
};
