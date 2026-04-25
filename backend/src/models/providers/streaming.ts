export interface StreamFrame {
  event: string | null;
  data: string;
}

export async function consumeSseEvents(
  response: Response,
  onEvent: (frame: StreamFrame) => void,
): Promise<void> {
  const body = response.body;
  if (!body) {
    throw new Error('Streaming response missing body');
  }

  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  const flushFrame = (frame: string) => {
    const normalized = frame.replace(/\r/g, '');
    if (!normalized.trim()) return;

    let event: string | null = null;
    const dataLines: string[] = [];

    for (const line of normalized.split('\n')) {
      if (line.startsWith('event:')) {
        event = line.slice(6).trim();
      } else if (line.startsWith('data:')) {
        dataLines.push(line.slice(5).trimStart());
      }
    }

    if (dataLines.length > 0) {
      onEvent({ event, data: dataLines.join('\n') });
    }
  };

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let boundary = buffer.indexOf('\n\n');
      while (boundary !== -1) {
        const frame = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        flushFrame(frame);
        boundary = buffer.indexOf('\n\n');
      }
    }

    if (buffer.trim()) {
      flushFrame(buffer);
    }
  } finally {
    reader.releaseLock();
  }
}

export async function consumeLineEvents(
  response: Response,
  onLine: (line: string) => void,
): Promise<void> {
  const body = response.body;
  if (!body) {
    throw new Error('Streaming response missing body');
  }

  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let boundary = buffer.indexOf('\n');
      while (boundary !== -1) {
        const line = buffer.slice(0, boundary).replace(/\r$/, '');
        buffer = buffer.slice(boundary + 1);
        if (line.length > 0) {
          onLine(line);
        }
        boundary = buffer.indexOf('\n');
      }
    }

    const remaining = buffer.replace(/\r$/, '').trim();
    if (remaining.length > 0) {
      onLine(remaining);
    }
  } finally {
    reader.releaseLock();
  }
}

export function splitTextIntoChunks(text: string, chunkSize = 64): string[] {
  if (!text) return [];
  const chunks: string[] = [];
  for (let index = 0; index < text.length; index += chunkSize) {
    chunks.push(text.slice(index, index + chunkSize));
  }
  return chunks;
}