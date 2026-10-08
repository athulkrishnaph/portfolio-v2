import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { ErrorState } from '../../../shared/components/error-state/error-state';
import { Icon } from '../../../shared/components/icon/icon';
import { PageHeader } from '../../../shared/components/page-header/page-header';
import { Spinner } from '../../../shared/components/spinner/spinner';
import { ChatKnowledgeCard } from './chat-knowledge-card';
import { DashboardStore } from './dashboard.store';

/** Overview: how much content exists, plus shortcuts. State lives in DashboardStore. */
@Component({
  selector: 'app-dashboard',
  imports: [RouterLink, PageHeader, Icon, Spinner, ErrorState, ChatKnowledgeCard],
  providers: [DashboardStore],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard {
  protected readonly store = inject(DashboardStore);
}
