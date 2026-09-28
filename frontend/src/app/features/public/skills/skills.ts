import { Component, computed, inject } from '@angular/core';

import { SkillsService, groupSkills } from '../../../core/services/skills.service';
import { Loader } from '../../../core/utils/loader';
import { EmptyState } from '../../../shared/components/empty-state/empty-state';
import { ErrorState } from '../../../shared/components/error-state/error-state';
import { Icon } from '../../../shared/components/icon/icon';
import { Spinner } from '../../../shared/components/spinner/spinner';

/** All skills, one card per category. */
@Component({
  selector: 'app-skills',
  imports: [Icon, Spinner, ErrorState, EmptyState],
  template: `
    <section class="container section">
      <header class="page-intro">
        <span class="eyebrow">// skills</span>
        <h1>Skills &amp; technologies</h1>
        <p>The languages, frameworks and tools I use to design, build and ship software.</p>
      </header>

      @if (skills.loading()) {
        <app-spinner label="Loading skills…" />
      } @else if (skills.error(); as error) {
        <app-error-state [error]="error" (retry)="skills.reload()" />
      } @else if (groups().length) {
        <div class="grid grid--3">
          @for (group of groups(); track group.category) {
            <article class="card card--padded">
              <h2 class="group__title">
                <span class="group__icon"><app-icon name="layers" /></span>
                {{ group.category }}
              </h2>
              <ul class="tag-list">
                @for (skill of group.skills; track skill.id) {
                  <li class="tag tag--primary">{{ skill.name }}</li>
                }
              </ul>
            </article>
          }
        </div>
      } @else {
        <app-empty-state icon="zap" title="No skills listed yet" />
      }
    </section>
  `,
  styles: `
    .group__title {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      font-size: var(--text-lg);
      margin-bottom: var(--space-4);
    }
    .group__icon {
      display: grid;
      place-items: center;
      width: 36px;
      height: 36px;
      border-radius: var(--radius-sm);
      background: var(--color-primary-soft);
      color: var(--color-primary);
    }
  `,
})
export class Skills {
  private readonly skillsService = inject(SkillsService);
  protected readonly skills = new Loader(() => this.skillsService.list());
  protected readonly groups = computed(() => groupSkills(this.skills.data() ?? []));
}
