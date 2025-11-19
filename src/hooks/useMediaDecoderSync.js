import { useCallback, useEffect, useRef } from 'react';

// --- CẤU HÌNH ĐỒNG BỘ (SYNC CONFIG) ---
// Giá trị này (ms) dùng để kìm hãm Video lại, chờ Audio phát ra loa.
// - Nếu Video vẫn chạy NHANH hơn tiếng: TĂNG số này lên (ví dụ: 150, 200).
// - Nếu Video bị CHẬM hơn tiếng: GIẢM số này xuống (ví dụ: 50, 0).
const MANUAL_VIDEO_DELAY_MS = 200;

export const useMediaDecoderSync = (remoteVideoRef, nodeRef) => {
  // Refs cho WebCodecs
  const videoDecoderRef = useRef(null);
  const audioDecoderRef = useRef(null);
  const videoWriterRef = useRef(null);

  // Refs cho Audio Context
  const audioContextRef = useRef(null);
  const mediaDestinationRef = useRef(null);
  const nextAudioStartTimeRef = useRef(0);

  // Refs cho quản lý Buffer và Sync
  const videoBufferRef = useRef([]); // Hàng đợi Video Frames
  const isWaitingForKeyFrame = useRef(true);
  const syncStateRef = useRef({
    firstAudioTimestamp: null, // Timestamp của gói audio đầu tiên (ms)
    audioContextStartTime: null, // Thời điểm AudioContext (s) tương ứng
    isReady: false,
  });
  const renderLoopIdRef = useRef(null);

  // --- 1. KHỞI TẠO AUDIO CONTEXT ---
  const initAudioContext = useCallback(async () => {
    if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      audioContextRef.current = new AudioContextClass({ sampleRate: 48000, latencyHint: 'interactive' });

      mediaDestinationRef.current = audioContextRef.current.createMediaStreamDestination();

      // Resume nếu trình duyệt chặn Autoplay
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }

      nextAudioStartTimeRef.current = audioContextRef.current.currentTime;
    }
  }, []);

  // --- 2. PLAY AUDIO (MASTER CLOCK) ---
  const playDecodedAudio = useCallback(async (audioData, timestampMs) => {
    try {
      const ctx = audioContextRef.current;
      if (!ctx) return;

      // Thiết lập mốc thời gian đồng bộ (Sync Anchor) khi nhận gói Audio đầu tiên
      if (syncStateRef.current.firstAudioTimestamp === null) {
        syncStateRef.current.firstAudioTimestamp = timestampMs;
        syncStateRef.current.audioContextStartTime = nextAudioStartTimeRef.current;
        syncStateRef.current.isReady = true;
        console.log(
          `⚡ Sync Anchor Set: AudioTS=${timestampMs}ms mapped to CtxTime=${nextAudioStartTimeRef.current.toFixed(3)}s`,
        );
      }

      // Convert AudioData thành AudioBuffer
      const { numberOfChannels, numberOfFrames, sampleRate } = audioData;
      const audioBuffer = ctx.createBuffer(numberOfChannels, numberOfFrames, sampleRate);

      // Copy dữ liệu planar vào buffer
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

      // Tạo Source và nối vào Destination
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(mediaDestinationRef.current);

      // Logic xếp hàng đợi âm thanh (Queue) để không bị gap
      if (nextAudioStartTimeRef.current < ctx.currentTime) {
        nextAudioStartTimeRef.current = ctx.currentTime;
      }

      source.start(nextAudioStartTimeRef.current);
      nextAudioStartTimeRef.current += numberOfFrames / sampleRate;

      audioData.close();
    } catch (err) {
      console.error('❌ Audio play error:', err);
      audioData.close();
    }
  }, []);

  // --- 3. RENDER LOOP (SYNC VIDEO TO AUDIO) ---
  const startRenderLoop = useCallback(() => {
    const loop = async () => {
      // Nếu chưa sẵn sàng, tiếp tục đợi
      if (!videoWriterRef.current || !audioContextRef.current || !syncStateRef.current.isReady) {
        renderLoopIdRef.current = requestAnimationFrame(loop);
        return;
      }

      const ctx = audioContextRef.current;
      const state = syncStateRef.current;

      // --- TÍNH TOÁN THỜI GIAN MỤC TIÊU ---

      // Lấy độ trễ phần cứng (nếu trình duyệt hỗ trợ)
      const hardwareLatency = (ctx.outputLatency || 0) + (ctx.baseLatency || 0);

      // Tổng độ trễ cần bù = Trễ phần cứng + Trễ thủ công (MANUAL_VIDEO_DELAY_MS)
      const totalCompensationMs = hardwareLatency * 1000 + MANUAL_VIDEO_DELAY_MS;

      // Thời gian đã trôi qua kể từ mốc Anchor
      const timeElapsed = ctx.currentTime - state.audioContextStartTime;

      // Thời điểm Video cần hiển thị = (Mốc Audio gốc + Thời gian trôi qua) - Bù trễ
      const currentVideoTargetTime = state.firstAudioTimestamp + timeElapsed * 1000 - totalCompensationMs;

      // --- DUYỆT VIDEO BUFFER ---
      while (videoBufferRef.current.length > 0) {
        const frame = videoBufferRef.current[0];
        const frameTimestamp = frame.timestamp / 1000; // convert microseconds -> milliseconds

        // CASE A: Frame quá cũ (Late frame) -> Drop để đuổi kịp
        // Nếu frame chậm hơn target quá 40ms
        if (frameTimestamp < currentVideoTargetTime - 40) {
          // console.warn("⏩ Dropping late frame", frameTimestamp);
          frame.close();
          videoBufferRef.current.shift();
          continue;
        }

        // CASE B: Frame ở tương lai (Early frame) -> Chờ
        // Nếu frame lớn hơn target + 15ms
        if (frameTimestamp > currentVideoTargetTime + 15) {
          break; // Thoát vòng lặp, chờ lần render sau
        }

        // CASE C: Frame đúng thời điểm (On time) -> Vẽ
        try {
          await videoWriterRef.current.write(frame);
        } catch (e) {
          // Ignore write errors (stream closed, etc.)
          frame.close();
        }
        videoBufferRef.current.shift();
        break; // Vẽ xong 1 frame thì nghỉ, chờ next animation frame
      }

      renderLoopIdRef.current = requestAnimationFrame(loop);
    };

    renderLoopIdRef.current = requestAnimationFrame(loop);
  }, []);

  // --- 4. KHỞI TẠO DECODERS & STREAMS ---
  const initDecoders = useCallback(() => {
    // Cleanup cũ
    if (videoDecoderRef.current) videoDecoderRef.current.close();
    if (audioDecoderRef.current) audioDecoderRef.current.close();
    if (renderLoopIdRef.current) cancelAnimationFrame(renderLoopIdRef.current);

    // Khởi tạo Generator cho Video (Writer)
    const videoTrackGenerator = new MediaStreamTrackGenerator({ kind: 'video' });
    videoWriterRef.current = videoTrackGenerator.writable.getWriter();

    // Khởi tạo Audio & Video Stream
    initAudioContext();
    const audioTrack = mediaDestinationRef.current.stream.getAudioTracks()[0];
    const combinedStream = new MediaStream([videoTrackGenerator, audioTrack]);

    // Gán Stream vào thẻ Video
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = combinedStream;
      remoteVideoRef.current.muted = false; // Muted false vì âm thanh đi qua AudioContext -> Destination
    }

    // Reset trạng thái
    syncStateRef.current = { firstAudioTimestamp: null, audioContextStartTime: null, isReady: false };
    videoBufferRef.current = [];
    isWaitingForKeyFrame.current = true;

    // Bắt đầu vòng lặp vẽ
    startRenderLoop();

    // Setup Video Decoder
    videoDecoderRef.current = new VideoDecoder({
      output: frame => {
        const timestampMs = Math.floor(frame.timestamp / 1000);
        console.log('🎬 Video Frame Decoded:', {
          timestamp: `${timestampMs}ms`,
          originalTimestamp: `${frame.timestamp}µs`,
        });

        // KHÔNG VẼ NGAY -> Đẩy vào Buffer
        videoBufferRef.current.push(frame);

        // Giới hạn Buffer để tránh tràn bộ nhớ (nếu Audio bị dừng/lỗi)
        if (videoBufferRef.current.length > 60) {
          const oldFrame = videoBufferRef.current.shift();
          oldFrame.close();
          console.warn('⚠️ Video Buffer Full: Dropping oldest frame');
        }
      },
      error: e => {
        console.error('VideoDecoder error:', e);
        isWaitingForKeyFrame.current = true;
      },
    });

    // Setup Audio Decoder
    audioDecoderRef.current = new AudioDecoder({
      output: audioData => {
        const timestampMs = Math.floor(audioData.timestamp / 1000);
        console.log('🎵 Audio Frame Decoded:', {
          timestamp: `${timestampMs}ms`,
          originalTimestamp: `${audioData.timestamp}µs`,
        });

        playDecodedAudio(audioData, timestampMs);
      },
      error: e => console.error('AudioDecoder error:', e),
    });
  }, [remoteVideoRef, initAudioContext, playDecodedAudio, startRenderLoop]);

  // --- 5. RECEIVE LOOP (MAIN LOGIC) ---
  const mediaDecoder = useCallback(async () => {
    initDecoders();

    while (true) {
      try {
        const data = await nodeRef.current.asyncRecv();
        const buffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);

        if (buffer.byteLength < 5) {
          continue;
        }

        const view = new DataView(buffer);
        const frameType = view.getUint8(0);
        const timestamp = view.getUint32(1, false); // Timestamp gốc (ms)

        let payload = frameType === 0 ? buffer.slice(1) : buffer.slice(5);

        // Type 0: CONFIG
        if (frameType === 0) {
          try {
            const configMsg = JSON.parse(new TextDecoder().decode(payload));
            console.log('📋 Config:', configMsg);
            const { videoConfig, audioConfig } = configMsg;

            if (videoConfig && videoDecoderRef.current.state !== 'closed') {
              isWaitingForKeyFrame.current = true;
              const description = Uint8Array.from(atob(videoConfig.description), c => c.charCodeAt(0)).buffer;
              videoDecoderRef.current.configure({ ...videoConfig, description });
            }
            if (audioConfig && audioDecoderRef.current.state !== 'closed') {
              // const description = Uint8Array.from(atob(audioConfig.description), c => c.charCodeAt(0)).buffer;
              audioDecoderRef.current.configure({
                codec: audioConfig.codec,
                sampleRate: audioConfig.sampleRate,
                numberOfChannels: audioConfig.numberOfChannels,
              });
            }
          } catch (e) {
            console.error('Config Error', e);
          }
          continue;
        }

        // Type 1 (Key), Type 2 (Delta): VIDEO
        if (frameType === 1 || frameType === 2) {
          if (videoDecoderRef.current?.state === 'configured') {
            const isKeyFrame = frameType === 1;

            if (isWaitingForKeyFrame.current) {
              if (!isKeyFrame) continue; // Bỏ qua delta frame khi đang đợi key
              isWaitingForKeyFrame.current = false;
              console.log('🎯 Key frame received');
            }

            try {
              const chunk = new EncodedVideoChunk({
                type: isKeyFrame ? 'key' : 'delta',
                timestamp: timestamp * 1000, // Đổi sang microseconds cho Decoder
                data: payload,
              });
              videoDecoderRef.current.decode(chunk);
            } catch (e) {
              if (videoDecoderRef.current.state !== 'closed') {
                isWaitingForKeyFrame.current = true; // Reset nếu lỗi decode
              }
            }
          }
        }

        // Type 3: AUDIO
        else if (frameType === 3) {
          if (audioDecoderRef.current?.state === 'configured') {
            try {
              const chunk = new EncodedAudioChunk({
                type: 'key',
                timestamp: timestamp * 1000,
                data: payload,
              });
              audioDecoderRef.current.decode(chunk);
            } catch (e) {
              // Error handling (re-init logic if needed)
            }
          }
        }
      } catch (error) {
        console.error('Stream Loop Error/End:', error);
        break;
      }
    }
  }, [initDecoders, nodeRef]);

  // Cleanup Final
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
