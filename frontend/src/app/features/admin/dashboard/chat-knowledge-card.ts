import { Component, inject, signal } from '@angular/core';

import { ApiError } from '../../../core/api/api-error';
import { ChatService } from '../../../core/services/chat.service';
import { NotificationService } from '../../../core/ui/notification.service';
import { Loader } from '../../../core/utils/loader';
import { Button } from '../../../shared/components/button/button';
import { Icon } from '../../../shared/components/icon/icon';

/**
 * Dashboard card for the portfolio chatbot: is it enabled, how much does it
 * know, and a button to rebuild its knowledge after editing content.
 */
@Component({
  selector: 'app-chat-knowledge-card',
  imports: [Icon, Button],
  templateUrl: './chat-knowledge-card.html',
  styleUrl: './chat-knowledge-card.scss',
})
export class ChatKnowledgeCard {
  private readonly chat = inject(ChatService);
  private readonly notifications = inject(NotificationService);

  protected readonly info = new Loader(() => this.chat.knowledge());
  protected readonly rebuilding = signal(false);

  // Intl instead of Angular's DatePipe keeps date-formatting code out of
  // the site's initial bundle.
  private static readonly dateFormat = new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  protected formatDate(iso: string): string {
    return ChatKnowledgeCard.dateFormat.format(new Date(iso));
  }

  protected rebuild(): void {
    this.rebuilding.set(true);
    this.chat.reindex().subscribe({
      next: (report) => {
        this.rebuilding.set(false);
        const changed = report.embedded + report.deleted;
        this.notifications.success(
          changed
            ? `Knowledge updated: ${report.embedded} updated, ${report.deleted} removed (${report.chunks} total).`
            : 'Knowledge is already up to date.',
        );
        for (const warning of report.warnings ?? []) {
          this.notifications.error(warning);
        }
        this.info.refresh();
      },
      error: (err: unknown) => {
        this.rebuilding.set(false);
        this.notifications.error(ApiError.from(err).message);
      },
    });
  }
}
