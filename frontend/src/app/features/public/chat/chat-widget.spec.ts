import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Observable, Subject, of } from 'rxjs';

import { ApiError } from '../../../core/api/api-error';
import { ChatRequest, ChatStatus, ChatStreamEvent } from '../../../core/models';
import { ChatService } from '../../../core/services/chat.service';
import { ChatWidget } from './chat-widget';

/** A ChatService stand-in whose answers the test controls. */
class FakeChatService {
  status$: Observable<ChatStatus> = of({ enabled: true, maxMessageChars: 500 });
  requests: ChatRequest[] = [];
  answer = new Subject<ChatStreamEvent>();

  stream(req: ChatRequest): Observable<ChatStreamEvent> {
    this.requests.push(req);
    this.answer = new Subject<ChatStreamEvent>();
    return this.answer;
  }
}

describe('ChatWidget', () => {
  let chat: FakeChatService;

  async function render() {
    const fixture = TestBed.createComponent(ChatWidget);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    return { fixture, el };
  }

  function type(el: HTMLElement, text: string) {
    const input = el.querySelector<HTMLTextAreaElement>('#chat-input')!;
    input.value = text;
    input.dispatchEvent(new Event('input'));
    return input;
  }

  beforeEach(() => {
    sessionStorage.clear();
    chat = new FakeChatService();
    TestBed.configureTestingModule({
      imports: [ChatWidget],
      providers: [provideRouter([]), { provide: ChatService, useValue: chat }],
    });
  });

  it('is hidden when the chatbot is disabled', async () => {
    chat.status$ = of({ enabled: false, maxMessageChars: 500 });
    const { el } = await render();
    expect(el.querySelector('.chat-launcher')).toBeNull();
  });

  it('opens and closes', async () => {
    const { fixture, el } = await render();
    const launcher = el.querySelector<HTMLButtonElement>('.chat-launcher')!;
    expect(launcher.getAttribute('aria-expanded')).toBe('false');

    launcher.click();
    fixture.detectChanges();
    expect(el.querySelector('[role="dialog"]')).not.toBeNull();
    expect(el.querySelectorAll('.chat__suggestion').length).toBe(4);

    el.querySelector<HTMLButtonElement>('.chat__header button[title="Close"]')!.click();
    fixture.detectChanges();
    expect(el.querySelector('[role="dialog"]')).toBeNull();
  });

  it('sends with Enter, shows loading, then renders the streamed answer and its sources', async () => {
    const { fixture, el } = await render();
    el.querySelector<HTMLButtonElement>('.chat-launcher')!.click();
    fixture.detectChanges();

    const input = type(el, 'Which projects use Go?');
    // Shift+Enter is a new line, not a send.
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', shiftKey: true }));
    expect(chat.requests.length).toBe(0);

    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    fixture.detectChanges();
    expect(chat.requests).toEqual([{ message: 'Which projects use Go?', history: [] }]);
    expect(el.querySelector('.msg--user')?.textContent).toContain('Which projects use Go?');
    expect(el.querySelector('.typing-dots')).not.toBeNull();
    const send = el.querySelector<HTMLButtonElement>('.chat__composer button[type="submit"]')!;
    type(el, 'another question');
    fixture.detectChanges();
    expect(send.disabled).toBe(true); // no second question while answering

    chat.answer.next({ type: 'sources', sources: [{ title: 'Engine', source: 'projects', url: '/projects/engine' }] });
    chat.answer.next({ type: 'delta', text: '**Engine** uses ' });
    chat.answer.next({ type: 'delta', text: 'Go.' });
    chat.answer.complete();
    fixture.detectChanges();

    const answer = el.querySelector('.msg--assistant .md-content')!;
    expect(answer.innerHTML).toContain('<strong>Engine</strong> uses Go.');
    expect(el.querySelector('.typing-dots')).toBeNull();
    const source = el.querySelector<HTMLAnchorElement>('.sources__item')!;
    expect(source.textContent).toContain('Engine');
    expect(source.getAttribute('href')).toBe('/projects/engine');
    expect(send.disabled).toBe(false);
  });

  it('sends earlier messages as history for follow-ups', async () => {
    const { fixture, el } = await render();
    el.querySelector<HTMLButtonElement>('.chat-launcher')!.click();
    fixture.detectChanges();

    el.querySelector<HTMLButtonElement>('.chat__suggestion')!.click();
    chat.answer.next({ type: 'delta', text: 'Go and Angular.' });
    chat.answer.complete();
    fixture.detectChanges();

    type(el, 'Which projects?');
    el.querySelector<HTMLFormElement>('.chat__composer')!.dispatchEvent(new Event('submit'));
    expect(chat.requests[1].history).toEqual([
      { role: 'user', content: chat.requests[0].message },
      { role: 'assistant', content: 'Go and Angular.' },
    ]);
  });

  it('shows errors with a retry button, and clears the conversation', async () => {
    const { fixture, el } = await render();
    el.querySelector<HTMLButtonElement>('.chat-launcher')!.click();
    fixture.detectChanges();

    type(el, 'hi');
    el.querySelector<HTMLFormElement>('.chat__composer')!.dispatchEvent(new Event('submit'));
    chat.answer.error(new ApiError(503, 'CHAT_BUSY', 'The assistant is busy right now.'));
    fixture.detectChanges();

    expect(el.querySelector('[role="alert"]')?.textContent).toContain('The assistant is busy right now.');
    const retry = [...el.querySelectorAll('button')].find((b) => b.textContent?.includes('Try again'))!;
    retry.click();
    fixture.detectChanges();
    expect(chat.requests.length).toBe(2);
    expect(chat.requests[1].message).toBe('hi');
    expect(el.querySelectorAll('.msg--user').length).toBe(1); // the failed attempt was replaced

    el.querySelector<HTMLButtonElement>('button[title="Clear conversation"]')!.click();
    fixture.detectChanges();
    expect(el.querySelectorAll('.msg').length).toBe(0);
  });
});
