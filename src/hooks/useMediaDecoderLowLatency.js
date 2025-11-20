import { useCallback, useEffect, useRef } from 'react';

// 🔥 GIẢM SỐ NÀY ĐỂ GIẢM DELAY
// 40ms là mức cân bằng. Nếu mạng tốt có thể thử 0ms.
// Nếu thấy miệng nói trước tiếng (Video nhanh), hãy tăng nhẹ lên 60-80.
const MANUAL_VIDEO_DELAY_MS = 0;

// Ngưỡng cho phép Buffer tích tụ tối đa (số lượng frames)
// Nếu vượt quá số này -> Xóa sạch buffer để nhảy đến hiện tại (giảm delay tức thì)
const MAX_BUFFER_SIZE = 10;

export const useMediaDecoderLowLatency = (remoteVideoRef, nodeRef) => {
  const videoDecoderRef = useRef(null);
  const audioDecoderRef = useRef(null);
  const videoWriterRef = useRef(null);

  const audioContextRef = useRef(null);
  const mediaDestinationRef = useRef(null);
  const nextAudioStartTimeRef = useRef(0);

  const videoBufferRef = useRef([]);
  const isWaitingForKeyFrame = useRef(true);
  const syncStateRef = useRef({
    firstAudioTimestamp: null,
    audioContextStartTime: null,
    isReady: false,
  });
  const renderLoopIdRef = useRef(null);

  const initAudioContext = useCallback(async () => {
    if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      // latencyHint: 'interactive' báo cho trình duyệt ưu tiên độ trễ thấp nhất
      audioContextRef.current = new AudioContextClass({ sampleRate: 48000, latencyHint: 'interactive' });

      mediaDestinationRef.current = audioContextRef.current.createMediaStreamDestination();

      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }

      nextAudioStartTimeRef.current = audioContextRef.current.currentTime;
    }
  }, []);

  // --- AUDIO PLAYER VỚI DRIFT CORRECTION ---
  const playDecodedAudio = useCallback(async (audioData, timestampMs) => {
    try {
      const ctx = audioContextRef.current;
      if (!ctx) return;

      if (syncStateRef.current.firstAudioTimestamp === null) {
        syncStateRef.current.firstAudioTimestamp = timestampMs;
        syncStateRef.current.audioContextStartTime = nextAudioStartTimeRef.current;
        syncStateRef.current.isReady = true;
        console.log(`⚡ Sync Anchor: AudioTS=${timestampMs}ms`);
      }

      const { numberOfChannels, numberOfFrames, sampleRate } = audioData;
      const audioBuffer = ctx.createBuffer(numberOfChannels, numberOfFrames, sampleRate);

      const size = numberOfFrames * numberOfChannels;
      const tempBuffer = new Float32Array(size);
      audioData.copyTo(tempBuffer, { planeIndex: 0, format: 'f32-planar' });

      for (let ch = 0; ch < numberOfChannels; ch++) {
        const channelData = audioBuffer.getChannelData(ch);
        const offset = ch * numberOfFrames;
        for (let i = 0; i < numberOfFrames; i++) {
          channelData[i] = tempBuffer[offset + i];
        }
      }

      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(mediaDestinationRef.current);

      // --- FIX DRIFT: Nếu Audio bị ngắt quãng (Underrun) ---
      if (nextAudioStartTimeRef.current < ctx.currentTime) {
        const drift = ctx.currentTime - nextAudioStartTimeRef.current;
        // Nếu lệch > 20ms thì điều chỉnh lại mốc thời gian
        if (drift > 0.02) {
          // Đẩy mốc StartTime lên để Video biết là Audio đã bị nhảy cóc
          syncStateRef.current.audioContextStartTime += drift;
          // console.log(`⚠️ Drift detected: ${drift.toFixed(3)}s. Resyncing...`);
        }
        nextAudioStartTimeRef.current = ctx.currentTime;
      }

      source.start(nextAudioStartTimeRef.current);
      nextAudioStartTimeRef.current += numberOfFrames / sampleRate;

      audioData.close();
    } catch (err) {
      audioData.close();
    }
  }, []);

  // --- RENDER LOOP (TỐI ƯU LOW LATENCY) ---
  const startRenderLoop = useCallback(() => {
    const loop = async () => {
      if (!videoWriterRef.current || !audioContextRef.current || !syncStateRef.current.isReady) {
        renderLoopIdRef.current = requestAnimationFrame(loop);
        return;
      }

      // 🔥 CATCH-UP LOGIC: Nếu Buffer quá đầy (> 10 frames), tức là đang delay > 300ms
      // Xóa bớt frame cũ để đuổi kịp thời gian thực
      if (videoBufferRef.current.length > MAX_BUFFER_SIZE) {
        console.warn('🚀 High latency detected! Skipping frames to catch up.');
        while (videoBufferRef.current.length > 2) {
          // Giữ lại 2 frame mới nhất
          const dropped = videoBufferRef.current.shift();
          dropped.close();
        }
      }

      const ctx = audioContextRef.current;
      const state = syncStateRef.current;

      const hardwareLatency = (ctx.outputLatency || 0) + (ctx.baseLatency || 0);
      const totalCompensationMs = hardwareLatency * 1000 + MANUAL_VIDEO_DELAY_MS;
      const timeElapsed = ctx.currentTime - state.audioContextStartTime;

      // Thời điểm mục tiêu
      const currentVideoTargetTime = state.firstAudioTimestamp + timeElapsed * 1000 - totalCompensationMs;

      while (videoBufferRef.current.length > 0) {
        const frame = videoBufferRef.current[0];
        const frameTimestamp = frame.timestamp / 1000;

        // CASE A: Frame cũ (Late) -> Vứt ngay
        // Giảm ngưỡng chấp nhận xuống 30ms (aggressive drop)
        if (frameTimestamp < currentVideoTargetTime - 30) {
          frame.close();
          videoBufferRef.current.shift();
          continue;
        }

        // CASE B: Frame tương lai (Future) -> Chờ
        if (frameTimestamp > currentVideoTargetTime + 15) {
          break;
        }

        // CASE C: Đúng giờ -> Vẽ
        try {
          await videoWriterRef.current.write(frame);
        } catch (e) {
          frame.close();
        }
        videoBufferRef.current.shift();
        break;
      }

      renderLoopIdRef.current = requestAnimationFrame(loop);
    };

    renderLoopIdRef.current = requestAnimationFrame(loop);
  }, []);

  const initDecoders = useCallback(() => {
    if (videoDecoderRef.current) videoDecoderRef.current.close();
    if (audioDecoderRef.current) audioDecoderRef.current.close();
    if (renderLoopIdRef.current) cancelAnimationFrame(renderLoopIdRef.current);

    const videoTrackGenerator = new MediaStreamTrackGenerator({ kind: 'video' });
    videoWriterRef.current = videoTrackGenerator.writable.getWriter();

    initAudioContext();
    const audioTrack = mediaDestinationRef.current.stream.getAudioTracks()[0];
    const combinedStream = new MediaStream([videoTrackGenerator, audioTrack]);

    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = combinedStream;
      remoteVideoRef.current.muted = false;
    }

    syncStateRef.current = { firstAudioTimestamp: null, audioContextStartTime: null, isReady: false };
    videoBufferRef.current = [];
    isWaitingForKeyFrame.current = true;

    startRenderLoop();

    videoDecoderRef.current = new VideoDecoder({
      output: frame => {
        videoBufferRef.current.push(frame);
        // Fallback safety: Không bao giờ để tràn RAM
        if (videoBufferRef.current.length > 60) {
          videoBufferRef.current.shift().close();
        }
      },
      error: e => {
        isWaitingForKeyFrame.current = true;
      },
    });

    audioDecoderRef.current = new AudioDecoder({
      output: audioData => {
        const timestampMs = audioData.timestamp / 1000;
        playDecodedAudio(audioData, timestampMs);
      },
      error: e => console.error(e),
    });
  }, [remoteVideoRef, initAudioContext, playDecodedAudio, startRenderLoop]);

  // --- MAIN LOOP (Giữ nguyên logic nhận data) ---
  const mediaDecoder = useCallback(async () => {
    initDecoders();
    while (true) {
      try {
        const data = await nodeRef.current.asyncRecv();
        const buffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
        if (buffer.byteLength < 5) continue;

        const view = new DataView(buffer);
        const frameType = view.getUint8(0);
        const timestamp = view.getUint32(1, false);
        let payload = frameType === 0 ? buffer.slice(1) : buffer.slice(5);

        if (frameType === 0) {
          // Config
          try {
            const configMsg = JSON.parse(new TextDecoder().decode(payload));
            const { videoConfig, audioConfig } = configMsg;
            if (videoConfig && videoDecoderRef.current.state !== 'closed') {
              isWaitingForKeyFrame.current = true;
              const description = Uint8Array.from(atob(videoConfig.description), c => c.charCodeAt(0)).buffer;
              videoDecoderRef.current.configure({ ...videoConfig, description });
            }
            if (audioConfig && audioDecoderRef.current.state !== 'closed') {
              audioDecoderRef.current.configure({
                codec: audioConfig.codec,
                sampleRate: audioConfig.sampleRate,
                numberOfChannels: audioConfig.numberOfChannels,
              });
            }
          } catch (e) {}
          continue;
        }

        if (frameType === 1 || frameType === 2) {
          // Video
          if (videoDecoderRef.current?.state === 'configured') {
            const isKeyFrame = frameType === 1;
            if (isWaitingForKeyFrame.current) {
              if (!isKeyFrame) continue;
              isWaitingForKeyFrame.current = false;
            }
            videoDecoderRef.current.decode(
              new EncodedVideoChunk({
                type: isKeyFrame ? 'key' : 'delta',
                timestamp: timestamp * 1000,
                data: payload,
              }),
            );
          }
        } else if (frameType === 3) {
          // Audio
          if (audioDecoderRef.current?.state === 'configured') {
            audioDecoderRef.current.decode(
              new EncodedAudioChunk({
                type: 'key',
                timestamp: timestamp * 1000,
                data: payload,
              }),
            );
          }
        }
      } catch (error) {
        break;
      }
    }
  }, [initDecoders, nodeRef]);

  useEffect(() => {
    return () => {
      if (renderLoopIdRef.current) cancelAnimationFrame(renderLoopIdRef.current);
      if (videoDecoderRef.current) videoDecoderRef.current.close();
      if (audioDecoderRef.current) audioDecoderRef.current.close();
      if (audioContextRef.current) audioContextRef.current.close();
    };
  }, []);

  return { mediaDecoder };
};
