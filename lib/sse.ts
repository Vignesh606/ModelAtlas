/**
 * Minimal Server-Sent Events parser, used on the server (OpenRouter's stream)
 * and in the browser (our /api/chat stream).
 *
 * Network chunks can end anywhere, even mid-line, so we buffer until a full
 * line arrives. Per the SSE spec: `data:` lines accumulate, a blank line
 * dispatches the event, and lines starting with ":" are comments (OpenRouter
 * sends ": OPENROUTER PROCESSING" keep-alives) and are ignored.
 */
export function createSseParser(onData: (data: string) => void) {
  let buffer = "";
  let dataLines: string[] = [];

  const dispatch = () => {
    if (dataLines.length) onData(dataLines.join("\n"));
    dataLines = [];
  };

  const processLine = (line: string) => {
    if (line === "") return dispatch();
    if (line.startsWith(":")) return; // comment / keep-alive
    if (line.startsWith("data:")) {
      // "data: x" and "data:x" are both valid; strip one optional space.
      dataLines.push(line.slice(line.startsWith("data: ") ? 6 : 5));
    }
    // Other fields (event:, id:, retry:) are not used by either stream.
  };

  return {
    push(chunk: string) {
      buffer += chunk;
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? ""; // the last piece may be an incomplete line
      for (const line of lines) processLine(line);
    },
    /** Call when the stream ends, to emit a final event that had no trailing blank line. */
    flush() {
      if (buffer) processLine(buffer);
      buffer = "";
      dispatch();
    },
  };
}
