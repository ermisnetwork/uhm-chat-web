import { useCallback, useRef } from 'react';
import { nodeCall } from '../nodeCall';

export const useMediaEncoder = () => {
  const videoEncoderRef = useRef(null);
  const audioEncoderRef = useRef(null);
  const configSentRef = useRef(false);
  const videoConfigRef = useRef(null);
  const audioConfigRef = useRef(null);
  const videoConfigSentRef = useRef(false);
  const audioConfigSentRef = useRef(false);
  const hasVideoRef = useRef(false);
  const hasAudioRef = useRef(false);
  const canSendDataRef = useRef(false);

  const setCanSendData = useCallback(canSend => {
    canSendDataRef.current = canSend;

    if (canSend) {
      sendVideoConfig();
      sendAudioConfig();
    }
  }, []);

  const sendVideoConfig = useCallback(async () => {
    if (videoConfigRef.current && !videoConfigSentRef.current && canSendDataRef.current) {
      const configPacket = createPacketWithHeader(null, null, 'videoConfig', videoConfigRef.current);
      await nodeCall.asyncSend(configPacket);
      videoConfigSentRef.current = true;
    }
  }, []);

  const sendAudioConfig = useCallback(async () => {
    if (audioConfigRef.current && !audioConfigSentRef.current && canSendDataRef.current) {
      const configPacket = createPacketWithHeader(null, null, 'audioConfig', audioConfigRef.current);
      await nodeCall.asyncSend(configPacket);
      audioConfigSentRef.current = true;
    }
  }, []);

  const isReadyToSendData = useCallback(type => {
    if (!canSendDataRef.current) {
      return false;
    }

    const videoReady = !hasVideoRef.current || videoConfigSentRef.current;
    const audioReady = !hasAudioRef.current || audioConfigSentRef.current;

    // Phải đợi CẢ 2 config được gửi (nếu có)
    const allConfigsSent = videoReady && audioReady;

    if (type === 'video') {
      return allConfigsSent && videoConfigSentRef.current;
    } else if (type === 'audio') {
      return allConfigsSent && audioConfigSentRef.current;
    }

    return false;
  }, []);

  const sendPacketOrQueue = useCallback(
    async (packet, type) => {
      if (!isReadyToSendData(type)) {
        return; // Chưa sẵn sàng, bỏ qua packet
      }

      if (type === 'audio') {
        await nodeCall.asyncSend(packet);
      } else if (type === 'video') {
        await nodeCall.sendRaptorQ(packet);
      }
    },
    [isReadyToSendData],
  );

  // const sendDecoderConfigs = useCallback(async (hasVideo, hasAudio) => {
  //   const videoReady = !hasVideo || videoConfigRef.current !== null;
  //   const audioReady = !hasAudio || audioConfigRef.current !== null;

  //   const hasVideoConfig = videoConfigRef.current !== null;
  //   const hasAudioConfig = audioConfigRef.current !== null;

  //   if (videoReady && audioReady && !configSentRef.current) {
  //     const configMsg = {
  //       type: 'DecoderConfigs',
  //       ...(hasVideoConfig && { videoConfig: videoConfigRef.current }),
  //       ...(hasAudioConfig && { audioConfig: audioConfigRef.current }),
  //     };

  //     const configPacket = createPacketWithHeader(null, null, 'config', configMsg);
  //     await nodeCall.asyncSend(configPacket);
  //     configSentRef.current = true;
  //   }
  // }, []);

  // const sendPacketOrQueue = useCallback(async (packet, type) => {
  //   if (configSentRef.current) {
  //     // await nodeCall.asyncSend(packet);
  //     if (type === 'audio') {
  //       await nodeCall.asyncSend(packet);
  //     } else if (type === 'video') {
  //       await nodeCall.sendRaptorQ(packet);
  //     }
  //   }
  // }, []);

  const base64Encode = arrayBuffer => {
    let binary = '';
    const bytes = new Uint8Array(arrayBuffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  };

  const createPacketWithHeader = useCallback((data, timestamp, type, configMsg) => {
    let HEADER_SIZE;
    let payload;

    // Config messages chỉ có 1 byte header
    if ((type === 'videoConfig' || type === 'audioConfig') && configMsg) {
      HEADER_SIZE = 1;
      const jsonString = JSON.stringify(configMsg);
      const encoder = new TextEncoder();
      payload = encoder.encode(jsonString);
    } else {
      // Data packets có 5 bytes header
      HEADER_SIZE = 5;
      payload = new Uint8Array(data);
    }

    // Tạo mảng 5 + payload.byteLength bytes
    const packet = new Uint8Array(HEADER_SIZE + payload.byteLength);

    // Type mapping: videoConfig=0, audioConfig=1, video-key=2, video-delta=3, audio=4
    let typeCode;
    if (type === 'videoConfig') typeCode = 0;
    else if (type === 'audioConfig') typeCode = 1;
    else if (type === 'video-key') typeCode = 2;
    else if (type === 'video-delta') typeCode = 3;
    else if (type === 'audio') typeCode = 4;

    // Byte 0: Type code (1 byte)
    packet[0] = typeCode;

    // Byte 1-4: Timestamp (4 bytes)
    if (timestamp) {
      const view = new DataView(packet.buffer);
      view.setUint32(1, timestamp, false);
    }

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

  const initEncoders = useCallback(
    async (videoTrack, audioTrack) => {
      hasVideoRef.current = !!videoTrack;
      hasAudioRef.current = !!audioTrack;

      if (videoTrack) {
        const settings = videoTrack.getSettings();
        const videoWidth = settings.width || 1280;
        const videoHeight = settings.height || 720;

        // init video encoder
        const videoEncoder = new VideoEncoder({
          output: (chunk, metadata) => {
            if (metadata?.decoderConfig && !videoConfigSentRef.current) {
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

              // sendVideoConfig();
            }

            if (chunk && isReadyToSendData('video')) {
              const data = new ArrayBuffer(chunk.byteLength);
              chunk.copyTo(data);
              const type = chunk.type === 'key' ? 'video-key' : 'video-delta';
              // const timestamp = chunk.timestamp / 1000;
              const timestamp = Math.floor(chunk.timestamp / 1000);
              const packet = createPacketWithHeader(data, timestamp, type, null);
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
      }

      // init audio encoder
      if (audioTrack) {
        const audioEncoder = new AudioEncoder({
          output: (chunk, metadata) => {
            if (metadata?.decoderConfig && !audioConfigSentRef.current) {
              const description = metadata.decoderConfig.description;
              const base64Description = base64Encode(description);

              audioConfigRef.current = {
                codec: metadata.decoderConfig.codec ?? 'opus',
                sampleRate: metadata.decoderConfig.sampleRate ?? 48000,
                numberOfChannels: metadata.decoderConfig.numberOfChannels ?? 1,
                description: base64Description,
              };
              // sendAudioConfig();
            }

            if (chunk && isReadyToSendData('audio')) {
              const data = new ArrayBuffer(chunk.byteLength);
              chunk.copyTo(data);

              // const timestamp = chunk.timestamp / 1000;
              const timestamp = Math.floor(chunk.timestamp / 1000);

              const packet = createPacketWithHeader(data, timestamp, 'audio', null);
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
      }
    },
    [sendVideoConfig, sendAudioConfig, isReadyToSendData],
  );

  // const initEncoders = useCallback(
  //   async (videoTrack, audioTrack) => {
  //     const hasVideo = !!videoTrack;
  //     const hasAudio = !!audioTrack;

  //     if (videoTrack) {
  //       const settings = videoTrack.getSettings();
  //       const videoWidth = settings.width || 1280;
  //       const videoHeight = settings.height || 720;

  //       // init video encoder
  //       const videoEncoder = new VideoEncoder({
  //         output: (chunk, metadata) => {
  //           if (metadata?.decoderConfig && !configSentRef.current) {
  //             const description = metadata.decoderConfig.description;
  //             const base64Description = base64Encode(description);

  //             videoConfigRef.current = {
  //               codec: metadata.decoderConfig.codec ?? 'hev1.1.6.L93.B0',
  //               codedWidth: metadata.decoderConfig.codedWidth ?? videoWidth,
  //               codedHeight: metadata.decoderConfig.codedHeight ?? videoHeight,
  //               frameRate: metadata.decoderConfig.framerate ?? 30.0,
  //               description: base64Description,
  //               orientation: 0,
  //             };

  //             sendDecoderConfigs(hasVideo, hasAudio);
  //           }

  //           if (chunk && configSentRef.current) {
  //             const data = new ArrayBuffer(chunk.byteLength);
  //             chunk.copyTo(data);
  //             const type = chunk.type === 'key' ? 'video-key' : 'video-delta';
  //             // const timestamp = chunk.timestamp / 1000;
  //             const timestamp = Math.floor(chunk.timestamp / 1000);
  //             const packet = createPacketWithHeader(data, timestamp, type, null);
  //             sendPacketOrQueue(packet, 'video');
  //           }
  //         },
  //         error: console.error,
  //       });

  //       videoEncoder.configure({
  //         codec: 'hev1.1.6.L93.B0',
  //         width: videoWidth,
  //         height: videoHeight,
  //         bitrate: 800000,
  //         framerate: 30,
  //         latencyMode: 'realtime',
  //         hardwareAcceleration: 'prefer-hardware',
  //       });

  //       videoEncoderRef.current = videoEncoder;
  //     }

  //     // init audio encoder
  //     if (audioTrack) {
  //       const audioEncoder = new AudioEncoder({
  //         output: (chunk, metadata) => {
  //           if (metadata?.decoderConfig && !configSentRef.current) {
  //             const description = metadata.decoderConfig.description;
  //             const base64Description = base64Encode(description);

  //             audioConfigRef.current = {
  //               codec: metadata.decoderConfig.codec ?? 'opus',
  //               sampleRate: metadata.decoderConfig.sampleRate ?? 48000,
  //               numberOfChannels: metadata.decoderConfig.numberOfChannels ?? 1,
  //               description: base64Description,
  //             };
  //             sendDecoderConfigs(hasVideo, hasAudio);
  //           }

  //           if (chunk && configSentRef.current) {
  //             const data = new ArrayBuffer(chunk.byteLength);
  //             chunk.copyTo(data);

  //             // const timestamp = chunk.timestamp / 1000;
  //             const timestamp = Math.floor(chunk.timestamp / 1000);

  //             const packet = createPacketWithHeader(data, timestamp, 'audio', null);
  //             sendPacketOrQueue(packet, 'audio');
  //           }
  //         },
  //         error: console.error,
  //       });

  //       audioEncoder.configure({
  //         codec: 'opus',
  //         sampleRate: 48000,
  //         numberOfChannels: 1,
  //         bitrate: 64000,
  //       });

  //       audioEncoderRef.current = audioEncoder;
  //     }
  //   },
  //   [sendDecoderConfigs],
  // );

  const mediaEncoder = useCallback(localStream => {
    const videoTrack = localStream.getVideoTracks()[0];
    const audioTrack = localStream.getAudioTracks()[0];
    initEncoders(videoTrack, audioTrack);

    // Process video
    if (videoTrack) {
      const videoProcessor = new MediaStreamTrackProcessor({ track: videoTrack });
      const videoReader = videoProcessor.readable.getReader();
      processVideoFrames(videoReader);
    }

    // Process audio
    if (audioTrack) {
      const audioProcessor = new MediaStreamTrackProcessor({ track: audioTrack });
      const audioReader = audioProcessor.readable.getReader();
      processAudioFrames(audioReader);
    }
  }, []);

  const resetEncoders = useCallback(() => {
    // Reset and close video encoder
    if (videoEncoderRef.current) {
      // try {
      //   videoEncoderRef.current.flush?.();
      //   videoEncoderRef.current.close?.();
      // } catch (e) {
      //   console.warn('Error closing video encoder:', e);
      // }
      videoEncoderRef.current = null;
    }

    // Reset and close audio encoder
    if (audioEncoderRef.current) {
      // try {
      //   audioEncoderRef.current.flush?.();
      //   audioEncoderRef.current.close?.();
      // } catch (e) {
      //   console.warn('Error closing audio encoder:', e);
      // }
      audioEncoderRef.current = null;
    }

    // Reset configs and flags
    // configSentRef.current = false;
    videoConfigRef.current = null;
    audioConfigRef.current = null;

    videoConfigSentRef.current = false;
    audioConfigSentRef.current = false;
    hasVideoRef.current = false;
    hasAudioRef.current = false;
    canSendDataRef.current = false;
  }, []);

  return { mediaEncoder, resetEncoders, setCanSendData };
};
