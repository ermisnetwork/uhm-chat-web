import { useCallback, useRef } from 'react';

export const useMediaEncoder = nodeRef => {
  const videoEncoderRef = useRef(null);
  const audioEncoderRef = useRef(null);
  const configSentRef = useRef(false);
  const videoConfigRef = useRef(null);
  const audioConfigRef = useRef(null);

  const sendDecoderConfigs = useCallback(async () => {
    if (videoConfigRef.current && audioConfigRef.current && !configSentRef.current) {
      const configMsg = {
        type: 'DecoderConfigs',
        videoConfig: videoConfigRef.current,
        audioConfig: audioConfigRef.current,
      };

      // Gửi config qua packet với type=0
      const configPacket = createPacketWithHeader(null, null, 'config', configMsg);
      await nodeRef.current.asyncSend(configPacket);
      configSentRef.current = true;
    }
  }, []);

  const sendPacketOrQueue = useCallback(async (packet, type) => {
    if (configSentRef.current) {
      await nodeRef.current.asyncSend(packet);
    }
  }, []);

  const base64Encode = arrayBuffer => {
    let binary = '';
    const bytes = new Uint8Array(arrayBuffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  };

  const createPacketWithHeader = useCallback((data, timestamp, type, configMsg = null) => {
    let HEADER_SIZE = 5; // 5 bytes cho header

    let payload;

    // Nếu là config message, serialize object thành bytes
    if (type === 'config' && configMsg) {
      HEADER_SIZE = 1;
      const jsonString = JSON.stringify(configMsg);
      const encoder = new TextEncoder();
      payload = encoder.encode(jsonString);
    } else {
      payload = new Uint8Array(data);
    }

    // Tạo mảng 5 + payload.byteLength bytes
    const packet = new Uint8Array(HEADER_SIZE + payload.byteLength);
    const view = new DataView(packet.buffer);

    // Type mapping: config=0, video-key=1, video-delta=2, audio=3
    let typeCode = 2; // default video-delta
    if (type === 'config') typeCode = 0;
    else if (type === 'video-key') typeCode = 1;
    else if (type === 'audio') typeCode = 3;

    // Byte 0: Type code (1 byte)
    packet[0] = typeCode;

    // Byte 1-4: Timestamp (4 bytes)
    if (timestamp) {
      view.setUint32(1, timestamp, false);
    }

    // Byte 5+: Data
    packet.set(payload, HEADER_SIZE);

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

  const initEncoders = useCallback(async videoTrack => {
    const settings = videoTrack.getSettings();
    const videoWidth = settings.width || 1280;
    const videoHeight = settings.height || 720;

    // init video encoder
    const videoEncoder = new VideoEncoder({
      output: (chunk, metadata) => {
        if (metadata?.decoderConfig && !configSentRef.current) {
          const description = metadata.decoderConfig.description;
          const base64Description = base64Encode(description);

          videoConfigRef.current = {
            codec: metadata.decoderConfig.codec ?? 'hev1.1.6.L93.B0',
            codedWidth: metadata.decoderConfig.codedWidth ?? videoWidth,
            codedHeight: metadata.decoderConfig.codedHeight ?? videoHeight,
            frameRate: metadata.decoderConfig.framerate ?? 30.0,
            description: base64Description,
            orientation: 0,
          };

          sendDecoderConfigs();
        }

        if (chunk && configSentRef.current) {
          const data = new ArrayBuffer(chunk.byteLength);
          chunk.copyTo(data);
          const type = chunk.type === 'key' ? 'video-key' : 'video-delta';
          // const timestamp = chunk.timestamp / 1000;
          const timestamp = Math.floor(chunk.timestamp / 1000);

          // console.log('🎥 Video Frame:', {
          //   type: chunk.type,
          //   timestamp: `${timestamp}ms`,
          //   originalTimestamp: `${chunk.timestamp}µs`,
          //   size: `${(chunk.byteLength / 1024).toFixed(2)} KB`,
          // });

          const packet = createPacketWithHeader(data, timestamp, type);
          sendPacketOrQueue(packet, 'video');
        }
      },
      error: console.error,
    });

    videoEncoder.configure({
      codec: 'hev1.1.6.L93.B0',
      width: videoWidth,
      height: videoHeight,
      bitrate: 800000,
      framerate: 30,
      latencyMode: 'realtime',
      hardwareAcceleration: 'prefer-hardware',
    });

    videoEncoderRef.current = videoEncoder;

    // init audio encoder
    const audioEncoder = new AudioEncoder({
      output: (chunk, metadata) => {
        if (metadata?.decoderConfig && !configSentRef.current) {
          const description = metadata.decoderConfig.description;
          const base64Description = base64Encode(description);

          audioConfigRef.current = {
            codec: metadata.decoderConfig.codec ?? 'opus',
            sampleRate: metadata.decoderConfig.sampleRate ?? 48000,
            numberOfChannels: metadata.decoderConfig.numberOfChannels ?? 1,
            description: base64Description,
          };
          sendDecoderConfigs();
        }

        if (chunk && configSentRef.current) {
          const data = new ArrayBuffer(chunk.byteLength);
          chunk.copyTo(data);

          // const timestamp = chunk.timestamp / 1000;
          const timestamp = Math.floor(chunk.timestamp / 1000);

          // console.log('🔊 Audio Chunk:', {
          //   timestamp: `${timestamp}ms`,
          //   originalTimestamp: `${chunk.timestamp}µs`,
          //   size: `${(chunk.byteLength / 1024).toFixed(2)} KB`,
          // });

          const packet = createPacketWithHeader(data, timestamp, 'audio');
          sendPacketOrQueue(packet, 'audio');
        }
      },
      error: console.error,
    });

    audioEncoder.configure({
      codec: 'opus',
      sampleRate: 48000,
      numberOfChannels: 1,
      bitrate: 64000,
    });

    audioEncoderRef.current = audioEncoder;
  }, []);

  const mediaEncoder = useCallback(localStream => {
    const videoTrack = localStream.getVideoTracks()[0];
    const audioTrack = localStream.getAudioTracks()[0];
    initEncoders(videoTrack);

    // Process video
    const videoProcessor = new MediaStreamTrackProcessor({ track: videoTrack });
    const videoReader = videoProcessor.readable.getReader();
    processVideoFrames(videoReader);

    // Process audio
    const audioProcessor = new MediaStreamTrackProcessor({ track: audioTrack });
    const audioReader = audioProcessor.readable.getReader();
    processAudioFrames(audioReader);
  }, []);

  return { mediaEncoder };
};
