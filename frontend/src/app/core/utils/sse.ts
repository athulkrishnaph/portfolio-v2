/**
 * Incremental parser for Server-Sent Events (the text/event-stream format):
 *
 *   event: delta
 *   data: {"text":"Hello"}
 *   <blank line>
 *
 * Network chunks can end anywhere (even mid-line), so text is buffered until
 * a complete event (terminated by a blank line) has arrived.
 */
export class SseParser {
  private buffer = '';

  constructor(private readonly onEvent: (event: string, data: string) => void) {}

  /** Feeds the next piece of text received from the network. */
  push(chunk: string): void {
    this.buffer += chunk.replace(/\r\n?/g, '\n');
    let end: number;
    while ((end = this.buffer.indexOf('\n\n')) >= 0) {
      const block = this.buffer.slice(0, end);
      this.buffer = this.buffer.slice(end + 2);
      this.dispatch(block);
    }
  }

  /** Processes a final event that was not followed by a blank line. */
  flush(): void {
    if (this.buffer.trim()) {
      this.dispatch(this.buffer);
    }
    this.buffer = '';
  }

  private dispatch(block: string): void {
    let event = 'message';
    const data: string[] = [];
    for (const line of block.split('\n')) {
      if (line.startsWith(':')) continue; // comment / keep-alive
      const colon = line.indexOf(':');
      const field = colon >= 0 ? line.slice(0, colon) : line;
      const value = colon >= 0 ? line.slice(colon + 1).replace(/^ /, '') : '';
      if (field === 'event') event = value;
      else if (field === 'data') data.push(value);
    }
    if (data.length) {
      this.onEvent(event, data.join('\n'));
    }
  }
}
