import { useCallback, useRef, useState } from 'react';

/** Microphone recording with MediaRecorder. */
export function useRecorder() {
	const recorderRef = useRef<MediaRecorder | null>(null);
	const chunksRef = useRef<Blob[]>([]);
	const streamRef = useRef<MediaStream | null>(null);
	const [recording, setRecording] = useState(false);

	const start = useCallback(async (): Promise<string | null> => {
		if (typeof navigator.mediaDevices?.getUserMedia !== 'function' || typeof MediaRecorder === 'undefined') {
			return 'Recording is not supported in this browser';
		}
		try {
			const stream = await navigator.mediaDevices.getUserMedia({
				audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
			});
			streamRef.current = stream;
			const type = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'].find((t) => MediaRecorder.isTypeSupported(t));
			const recorder = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
			chunksRef.current = [];
			recorder.ondataavailable = (e) => {
				if (e.data.size) chunksRef.current.push(e.data);
			};
			recorder.start();
			recorderRef.current = recorder;
			setRecording(true);
			return null;
		} catch {
			return 'Microphone access was denied';
		}
	}, []);

	const stop = useCallback(
		(): Promise<Blob | null> =>
			new Promise((resolve) => {
				const recorder = recorderRef.current;
				if (!recorder) {
					resolve(null);
					return;
				}
				recorder.onstop = () => {
					const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
					streamRef.current?.getTracks().forEach((track) => track.stop());
					streamRef.current = null;
					recorderRef.current = null;
					setRecording(false);
					resolve(blob.size ? blob : null);
				};
				recorder.stop();
			}),
		[],
	);

	return { start, stop, recording };
}
