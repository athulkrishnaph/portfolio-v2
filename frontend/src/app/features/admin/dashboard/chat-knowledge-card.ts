import { Component, inject } from '@angular/core';

import { Button } from '../../../shared/components/button/button';
import { Icon } from '../../../shared/components/icon/icon';
import { DashboardStore } from './dashboard.store';

/**
 * Dashboard card for the portfolio chatbot: is it enabled, how much does it
 * know, and a button to rebuild its knowledge after editing content.
 * Uses the dashboard's DashboardStore.
 */
@Component({
  selector: 'app-chat-knowledge-card',
  imports: [Icon, Button],
  templateUrl: './chat-knowledge-card.html',
  styleUrl: './chat-knowledge-card.scss',
})
export class ChatKnowledgeCard {
  protected readonly store = inject(DashboardStore);

  // Intl instead of Angular's DatePipe keeps date-formatting code out of
  // the site's initial bundle.
  private static readonly dateFormat = new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  protected formatDate(iso: string): string {
    return ChatKnowledgeCard.dateFormat.format(new Date(iso));
  }
}
