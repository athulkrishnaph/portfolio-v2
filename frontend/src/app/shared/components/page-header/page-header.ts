import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Title row for admin pages, with actions projected on the right:
 *
 *   <app-page-header title="Projects" subtitle="4 projects">
 *     <a appButton variant="primary" routerLink="new">New project</a>
 *   </app-page-header>
 */
@Component({
  selector: 'app-page-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div>
      <h1 class="page-header__title">{{ title() }}</h1>
      @if (subtitle()) {
        <p class="page-header__subtitle">{{ subtitle() }}</p>
      }
    </div>
    <div class="page-header__actions"><ng-content /></div>
  `,
  styles: `
    :host {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-end;
      justify-content: space-between;
      gap: var(--space-4);
      margin-bottom: var(--space-6);
    }
    .page-header__title {
      margin: 0;
      font-size: var(--text-3xl);
    }
    .page-header__subtitle {
      margin: var(--space-1) 0 0;
      color: var(--color-text-muted);
    }
    .page-header__actions {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-3);
    }
  `,
})
export class PageHeader {
  readonly title = input.required<string>();
  readonly subtitle = input('');
}
