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
  templateUrl: './page-header.html',
  styleUrl: './page-header.scss',
})
export class PageHeader {
  readonly title = input.required<string>();
  readonly subtitle = input('');
}
