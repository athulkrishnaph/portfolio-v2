import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, toArray } from 'rxjs';

import { ApiError } from '../api/api-error';
import { ChatStreamEvent } from '../models';
import { ChatService } from './chat.service';

/** A fetch Response whose body arrives in the given chunks. */
function streamResponse(chunks: string[], status = 200): Response {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      const enc = new TextEncoder();
      chunks.forEach((c) => controller.enqueue(enc.encode(c)));
      controller.close();
    },
  });
  return new Response(body, { status, headers: { 'Content-Type': 'text/event-stream' } });
}

describe('ChatService.stream', () => {
  let service: ChatService;
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
    TestBed.configureTestingModule({ providers: [provideHttpClient()] });
    service = TestBed.inject(ChatService);
  });

  afterEach(() => vi.unstubAllGlobals());

  it('posts the question and emits sources then text', async () => {
    fetchMock.mockResolvedValue(
      streamResponse([
        'event: sources\ndata: [{"title":"Skills","source":"skills","url":"/skills"}]\n\n',
        'event: delta\ndata: {"text":"Go"}\n\nevent: done\ndata: {}\n\n',
      ]),
    );

    const events = await firstValueFrom(
      service.stream({ message: 'Skills?', history: [] }).pipe(toArray()),
    );

    expect(events).toEqual<ChatStreamEvent[]>([
      { type: 'sources', sources: [{ title: 'Skills', source: 'skills', url: '/skills' }] },
      { type: 'delta', text: 'Go' },
    ]);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/chat/stream');
    expect(JSON.parse(init.body)).toEqual({ message: 'Skills?', history: [] });
  });

  it('turns an API error response into an ApiError', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ error: { code: 'CHAT_BUSY', message: 'Busy, try later' } }), { status: 503 }),
    );
    const err = await firstValueFrom(service.stream({ message: 'hi', history: [] })).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.code).toBe('CHAT_BUSY');
    expect(err.message).toBe('Busy, try later');
  });

  it('reports errors sent during the stream', async () => {
    fetchMock.mockResolvedValue(
      streamResponse(['event: error\ndata: {"code":"CHAT_UNAVAILABLE","message":"Unavailable"}\n\n']),
    );
    const err = await firstValueFrom(service.stream({ message: 'hi', history: [] })).catch((e) => e);
    expect(err.code).toBe('CHAT_UNAVAILABLE');
  });

  it('reports a connection that ends without "done"', async () => {
    fetchMock.mockResolvedValue(streamResponse(['event: delta\ndata: {"text":"Half"}\n\n']));
    const err = await firstValueFrom(service.stream({ message: 'hi', history: [] }).pipe(toArray())).catch(
      (e) => e,
    );
    expect(err.code).toBe('STREAM_INTERRUPTED');
  });

  it('reports network failures', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    const err = await firstValueFrom(service.stream({ message: 'hi', history: [] })).catch((e) => e);
    expect(err.code).toBe('NETWORK_ERROR');
  });
});
