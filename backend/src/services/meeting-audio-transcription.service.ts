import { AppError, ErrorCode, ValidationError } from '../utils/errors';

const MAX_AUDIO_BYTES = 25 * 1024 * 1024;
const ALLOWED_AUDIO_MIME = new Set([
  'audio/webm',
  'audio/wav',
  'audio/x-wav',
  'audio/mpeg',
  'audio/mp4',
  'audio/m4a',
  'audio/ogg',
  'audio/opus',
  'video/webm',
  'application/octet-stream'
]);

export interface MeetingAudioFile {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
}

/**
 * Uses a configured OpenAI-compatible speech-to-text endpoint.
 * Audio is passed in memory and is not written to the BDIQ server filesystem.
 * This endpoint is independent of Google Meet / Microsoft Teams integrations.
 */
export class MeetingAudioTranscriptionService {
  async transcribe(file: MeetingAudioFile): Promise<string> {
    if (!file?.buffer?.length) {
      throw new ValidationError('An audio file is required.');
    }
    if (file.size > MAX_AUDIO_BYTES || file.buffer.length > MAX_AUDIO_BYTES) {
      throw new ValidationError('Audio files must be 25 MB or smaller.');
    }

    const mime = (file.mimetype || '').split(';')[0].toLowerCase();
    const extension = (file.originalname || '').split('.').pop()?.toLowerCase() || '';
    const supportedExtension = ['webm', 'wav', 'mp3', 'm4a', 'mp4', 'ogg', 'opus'].includes(extension);
    if (!ALLOWED_AUDIO_MIME.has(mime) && !supportedExtension) {
      throw new ValidationError('Unsupported audio format. Upload WebM, WAV, MP3, M4A, MP4 or OGG audio.');
    }

    const endpoint = process.env.MEETING_TRANSCRIPTION_API_URL?.trim();
    const apiKey = process.env.MEETING_TRANSCRIPTION_API_KEY?.trim();
    const model = process.env.MEETING_TRANSCRIPTION_MODEL?.trim() || 'whisper-1';

    if (!endpoint || !apiKey) {
      throw new AppError(
        'Audio transcription is not configured. Add MEETING_TRANSCRIPTION_API_URL, MEETING_TRANSCRIPTION_API_KEY and MEETING_TRANSCRIPTION_MODEL on the backend, or use the transcript editor as a fallback.',
        503,
        ErrorCode.INTERNAL_ERROR
      );
    }

    let parsedEndpoint: URL;
    try {
      parsedEndpoint = new URL(endpoint);
    } catch {
      throw new ValidationError('MEETING_TRANSCRIPTION_API_URL must be a valid absolute URL.');
    }
    if (parsedEndpoint.protocol !== 'https:' && parsedEndpoint.hostname !== 'localhost' && parsedEndpoint.hostname !== '127.0.0.1') {
      throw new ValidationError('The transcription endpoint must use HTTPS, except for localhost development endpoints.');
    }

    const audioBlob = new Blob([
      file.buffer.buffer.slice(
        file.buffer.byteOffset,
        file.buffer.byteOffset + file.buffer.byteLength
      ) as ArrayBuffer
    ], { type: mime || 'application/octet-stream' });
    const form = new FormData();
    form.append('file', audioBlob, file.originalname || `meeting-audio.${extension || 'webm'}`);
    form.append('model', model);
    form.append('response_format', 'json');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120_000);
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}` },
        body: form,
        signal: controller.signal
      });

      if (!response.ok) {
        // Never return remote error bodies: providers sometimes include sensitive request details.
        if (response.status === 401 || response.status === 403) {
          throw new AppError('The transcription provider rejected its credentials or permissions.', 502, ErrorCode.INTERNAL_ERROR);
        }
        if (response.status === 413) {
          throw new AppError('The transcription provider rejected this audio file because it is too large.', 413, ErrorCode.VALIDATION_ERROR);
        }
        if (response.status === 429) {
          throw new AppError('The transcription provider is rate-limiting requests. Try again later.', 429, ErrorCode.RATE_LIMITED);
        }
        throw new AppError(`The transcription provider returned HTTP ${response.status}.`, 502, ErrorCode.INTERNAL_ERROR);
      }

      const result = await response.json() as { text?: unknown };
      if (typeof result?.text !== 'string' || !result.text.trim()) {
        throw new AppError('The transcription provider returned no transcript text.', 502, ErrorCode.INTERNAL_ERROR);
      }
      const transcript = result.text.trim();
      if (Buffer.byteLength(transcript, 'utf8') > 250_000) {
        throw new AppError('The transcript is larger than BDIQ accepts (250 KB). Split the audio into shorter segments.', 413, ErrorCode.VALIDATION_ERROR);
      }
      return transcript;
    } catch (error: any) {
      if (error instanceof AppError) throw error;
      if (error?.name === 'AbortError') {
        throw new AppError('Audio transcription timed out after 120 seconds. Try a shorter recording.', 504, ErrorCode.INTERNAL_ERROR);
      }
      throw new AppError('Could not reach the configured transcription provider. Check its URL and backend network access.', 502, ErrorCode.INTERNAL_ERROR);
    } finally {
      clearTimeout(timeout);
    }
  }
}
