import { useCallback, useEffect, useRef } from 'react';
import { useLibAV } from './useLibAV';

export const useMediaPublisher = channelId => {
  const { LibAVWebCodecs } = useLibAV();
  const videoEncoderRef = useRef(null);
  const audioEncoderRef = useRef(null);
  const publishSocketRef = useRef(null);
  const configSentRef = useRef(false);
  const videoConfigRef = useRef(null);
  const audioConfigRef = useRef(null);
  // Thêm queue để lưu packets chờ gửi
  const pendingPacketsRef = useRef([]);

  const sendDecoderConfigs = useCallback(() => {
    if (videoConfigRef.current && audioConfigRef.current && !configSentRef.current) {
      const configMsg = {
        type: 'DecoderConfigs',
        videoConfig: videoConfigRef.current,
        audioConfig: audioConfigRef.current,
      };

      if (publishSocketRef.current?.readyState === WebSocket.OPEN) {
        publishSocketRef.current.send(JSON.stringify(configMsg));
        configSentRef.current = true;

        // Gửi tất cả packets đang chờ
        while (pendingPacketsRef.current.length > 0) {
          const packet = pendingPacketsRef.current.shift();
          publishSocketRef.current.send(packet);
        }
      }
    }
  }, []);

  const sendPacketOrQueue = useCallback(packet => {
    if (configSentRef.current && publishSocketRef.current?.readyState === WebSocket.OPEN) {
      publishSocketRef.current.send(packet);
    } else {
      // Lưu packet vào queue nếu chưa gửi config
      pendingPacketsRef.current.push(packet);
    }
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

  const initAudioEncoder = useCallback(async () => {
    const encoder = new LibAVWebCodecs.AudioEncoder({
      output: (chunk, metadata) => {
        console.log('----chunk---', chunk);
        console.log('----metadata---', metadata);

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

          sendDecoderConfigs();
        }

        if (publishSocketRef.current?.readyState === WebSocket.OPEN) {
          const data = new ArrayBuffer(chunk.byteLength);
          chunk.copyTo(data);
          const packet = createPacketWithHeader(data, chunk.timestamp, 'audio');
          sendPacketOrQueue(packet);
        }
      },
      error: console.error,
    });

    encoder.configure({
      codec: 'opus',
      sampleRate: 48000,
      numberOfChannels: 2,
      bitrate: 128000,
    });

    audioEncoderRef.current = encoder;
  }, []);

  const initVideoEncoder = useCallback(async () => {
    const encoder = new VideoEncoder({
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

          sendDecoderConfigs();
        }

        if (publishSocketRef.current?.readyState === WebSocket.OPEN) {
          const data = new ArrayBuffer(chunk.byteLength);
          chunk.copyTo(data);
          const type = chunk.type === 'key' ? 'video-key' : 'video-delta';
          const packet = createPacketWithHeader(data, chunk.timestamp, type);
          sendPacketOrQueue(packet);
        }
      },
      error: console.error,
    });

    encoder.configure({
      codec: 'hev1.1.6.L93.B0',
      width: 1280,
      height: 720,
      bitrate: 1500000,
      framerate: 30,
      latencyMode: 'realtime',
      hardwareAcceleration: 'prefer-hardware',
      // hevc: { format: 'annexb', maxBFrames: 0 },
    });

    videoEncoderRef.current = encoder;
  }, [createPacketWithHeader]);

  const processAudioFrames = useCallback(async reader => {
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const audioData = LibAVWebCodecs.AudioData.fromNative(value);

        try {
          audioEncoderRef.current.encode(audioData);
        } catch (err) {
          console.error('Audio encode error:', err);
        } finally {
          audioData.close();
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

  const startCapture = useCallback(async () => {
    initVideoEncoder();
    initAudioEncoder();

    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });

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
  }, [initVideoEncoder, initAudioEncoder, processVideoFrames, processAudioFrames]);

  const connectPublisher = useCallback(() => {
    const ws = new WebSocket(`wss://4044.bandia.vn/publish/${channelId}`);
    ws.binaryType = 'arraybuffer';
    ws.onopen = () => {
      configSentRef.current = false; // Reset flag khi kết nối mới
      videoConfigRef.current = null;
      audioConfigRef.current = null;
      pendingPacketsRef.current = [];
      startCapture();
    };
    ws.onerror = console.error;
    ws.onclose = () => {
      videoEncoderRef.current?.close();
      audioEncoderRef.current?.close();
      pendingPacketsRef.current = [];
    };
    publishSocketRef.current = ws;
  }, [channelId, startCapture]);

  return { connectPublisher };
};
