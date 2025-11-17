import { useCallback, useRef } from 'react';

export const useMediaConsumer2 = (channelId, videoRef, nodeRef) => {
  const videoDecoderRef = useRef(null);
  const videoWriterRef = useRef(null);
  const audioDecoderRef = useRef(null);
  const combinedStreamRef = useRef(null);
  const isWaitingForKeyFrame = useRef(true);
  const audioContextRef = useRef(null);
  const mediaDestinationRef = useRef(null);
  const nextStartTimeRef = useRef(0);

  const initAudioContext = useCallback(async () => {
    if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 48000 });

      mediaDestinationRef.current = audioContextRef.current.createMediaStreamDestination();

      // Resume AudioContext nếu bị suspended (cần user interaction)
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }

      nextStartTimeRef.current = audioContextRef.current.currentTime;
      // firstPacketRef.current = true;
    }
  }, []);

  const playDecodedAudio = useCallback(async audioData => {
    try {
      const { numberOfChannels, numberOfFrames, sampleRate, format } = audioData;
      const audioContext = audioContextRef.current;
      if (!audioContext) return;

      // Tạo AudioBuffer
      const audioBuffer = audioContext.createBuffer(numberOfChannels, numberOfFrames, sampleRate);

      // ✅ Tạo buffer để copy dữ liệu
      const dataSize = numberOfFrames * numberOfChannels;
      const tempBuffer = new Float32Array(dataSize);

      // ✅ Copy dữ liệu từ AudioData với format f32-planar
      audioData.copyTo(tempBuffer, {
        planeIndex: 0,
        format: 'f32-planar',
      });

      // Copy dữ liệu vào từng kênh
      for (let ch = 0; ch < numberOfChannels; ch++) {
        const channelData = audioBuffer.getChannelData(ch);
        const offset = ch * numberOfFrames; // offset cho từng kênh trong planar format

        for (let i = 0; i < numberOfFrames; i++) {
          channelData[i] = tempBuffer[offset + i];
        }
      }

      // Tạo nguồn phát âm thanh
      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;

      const gainNode = audioContext.createGain();
      gainNode.gain.value = 1.0;
      source.connect(gainNode).connect(mediaDestinationRef.current);

      // Đảm bảo phát liên tục
      if (nextStartTimeRef.current < audioContext.currentTime) {
        nextStartTimeRef.current = audioContext.currentTime;
      }

      source.start(nextStartTimeRef.current);
      nextStartTimeRef.current += numberOfFrames / sampleRate;

      // Giải phóng bộ nhớ
      if (audioData && typeof audioData.close === 'function') {
        audioData.close();
      }
    } catch (err) {
      console.error('Error in playDecodedAudio:', err);
      if (audioData && typeof audioData.close === 'function') {
        audioData.close();
      }
    }
  }, []);

  const initDecoders = useCallback(() => {
    // Đóng decoders cũ trước
    if (videoDecoderRef.current && videoDecoderRef.current.state !== 'closed') {
      videoDecoderRef.current.close();
    }
    if (audioDecoderRef.current && audioDecoderRef.current.state !== 'closed') {
      audioDecoderRef.current.close();
    }

    // Tạo video track
    const videoTrackGenerator = new MediaStreamTrackGenerator({ kind: 'video' });
    videoWriterRef.current = videoTrackGenerator.writable.getWriter();

    // Tạo AudioContext + MediaStreamDestination
    initAudioContext();

    // Lấy audio track từ AudioContext
    const audioTrack = mediaDestinationRef.current.stream.getAudioTracks()[0];

    const combinedStream = new MediaStream([videoTrackGenerator, audioTrack]);
    combinedStreamRef.current = combinedStream;

    // Gán cho videoRef
    if (videoRef.current) {
      videoRef.current.srcObject = combinedStream;
      videoRef.current.muted = false;
    }

    isWaitingForKeyFrame.current = true;

    // Init video decoder
    const videoDecoder = new VideoDecoder({
      output: async frame => {
        try {
          await videoWriterRef.current.write(frame);
        } catch (err) {
          frame.close();
        }
      },
      error: err => {
        console.error('VideoDecoder error:', err);
        isWaitingForKeyFrame.current = true;
      },
    });

    const desc =
      'AQFgAAAAsAAAAAAAXfAA/P34+AAADwOgAAEAGEABDAH//wFgAAADALAAAAMAAAMAXRsCQKEAAQAtQgEBAWAAAAMAsAAAAwAAAwBdoAKAgC0WIG7kUjLn4T0L6hvVKagwCDAfwgEEogABAAdEAcBy8Fsk';
    // const desc =
    //   'ASFgAAADAAADAAADAPAA/P34+AAADwOgAAEAGEABDAH//yFgAAADAAADAAADAAADAHgsCaEAAQAjQgEBIWAAAAMAAAMAAAMAAAMAeKACgIAtFotJcEu5qAgICASiAAEACEQBwGYrA7GQ';
    const videoDescriptionBytes = Uint8Array.from(atob(desc), c => c.charCodeAt(0)).buffer;

    videoDecoder.configure({
      codec: 'hev1.1.6.L93.B0',
      codedWidth: 1280,
      codedHeight: 720,
      description: videoDescriptionBytes,
    });

    videoDecoderRef.current = videoDecoder;

    // Init audio decoder
    const audioDecoder = new AudioDecoder({
      output: async audioData => {
        // console.log('--audioData--', audioData);
        playDecodedAudio(audioData);
      },
      error: err => {
        console.error('AudioDecoder error:', err);
      },
    });

    audioDecoder.configure({
      codec: 'opus',
      sampleRate: 48000,
      numberOfChannels: 1,
    });

    audioDecoderRef.current = audioDecoder;
  }, [videoRef]);

  const connectConsumer = useCallback(async () => {
    initDecoders();

    await nodeRef.current.acceptConnection();
    console.log('-----acceptConnection----');

    await nodeRef.current.acceptBidiStream();

    console.log('-----acceptBidiStream----');

    while (true) {
      try {
        const data = await nodeRef.current.asyncRecv();

        // ✅ Chuyển Uint8Array thành ArrayBuffer
        const buffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
        console.log('-----buffer.byteLength----', buffer.byteLength);

        if (buffer.byteLength < 5) {
          console.warn('⚠️ Invalid packet: too small', buffer.byteLength);
          return;
        }

        const view = new DataView(buffer);
        const timestamp = view.getUint32(0, false);
        const frameType = view.getUint8(4);
        console.log('---frameType--', frameType);

        const payload = buffer.slice(5);

        // 🎥 Video frames (key=0, delta=1)
        if (frameType === 0 || frameType === 1) {
          if (!videoDecoderRef.current || videoDecoderRef.current.state !== 'configured') {
            console.warn('⚠️ VideoDecoder not ready, state:', videoDecoderRef.current?.state);
            return;
          }

          const isKeyFrame = frameType === 0;

          // ✅ Chỉ decode khi đã có key frame hoặc frame hiện tại là key frame
          if (isWaitingForKeyFrame.current) {
            if (!isKeyFrame) {
              console.log('🔄 Skipping delta frame, still waiting for key frame');
              return;
            }
            console.log('🎯 First key frame received after configure');
          }

          try {
            const chunk = new EncodedVideoChunk({
              type: frameType === 0 ? 'key' : 'delta',
              timestamp: timestamp * 1000,
              data: payload,
            });

            videoDecoderRef.current.decode(chunk);

            // ✅ Nếu decode key frame thành công, cho phép decode delta frames
            if (isKeyFrame) {
              isWaitingForKeyFrame.current = false;
              console.log('✅ Key frame decoded successfully, now accepting delta frames');
            }
          } catch (e) {
            console.error('❌ Video decode error:', e);

            if (e.name === 'InvalidStateError' || e.name === 'DataError') {
              if (videoDecoderRef.current && videoDecoderRef.current.state !== 'closed') {
                videoDecoderRef.current.close();
              }
              videoDecoderRef.current = null;
              isWaitingForKeyFrame.current = true;
            }
          }
        }
        // 🔊 Audio frames (audio=2)
        else if (frameType === 2) {
          if (!audioDecoderRef.current || audioDecoderRef.current.state !== 'configured') {
            console.warn('⚠️ AudioDecoder not ready, state:', audioDecoderRef.current?.state);
            return;
          }
          try {
            const chunk = new EncodedAudioChunk({
              type: 'key',
              timestamp: timestamp * 1000,
              data: payload,
            });
            audioDecoderRef.current.decode(chunk);
          } catch (e) {
            console.error('❌ Audio decode error:', e);

            if (e.name === 'InvalidStateError' || e.name === 'DataError') {
              console.log('🔄 Reinitializing audio decoder due to error...');

              // Đóng decoder hiện tại
              if (audioDecoderRef.current && audioDecoderRef.current.state !== 'closed') {
                audioDecoderRef.current.close();
              }
              audioDecoderRef.current = null;
            }
          }
        } else {
          console.warn('⚠️ Unknown frame type:', frameType);
        }
      } catch (error) {}
    }
  }, [channelId, initDecoders]);

  return { connectConsumer };
};
