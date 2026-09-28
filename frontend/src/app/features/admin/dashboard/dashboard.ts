import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';

import { AuthService } from '../../../core/auth/auth.service';
import { CertificatesService } from '../../../core/services/certificates.service';
import { EducationService } from '../../../core/services/education.service';
import { ExperienceService } from '../../../core/services/experience.service';
import { ProfileService } from '../../../core/services/profile.service';
import { ProjectsService } from '../../../core/services/projects.service';
import { SkillsService } from '../../../core/services/skills.service';
import { Loader } from '../../../core/utils/loader';
import { ErrorState } from '../../../shared/components/error-state/error-state';
import { Icon, IconName } from '../../../shared/components/icon/icon';
import { PageHeader } from '../../../shared/components/page-header/page-header';
import { Spinner } from '../../../shared/components/spinner/spinner';

interface StatCard {
  label: string;
  count: number;
  icon: IconName;
  link: string;
}

/** Overview: how much content exists, plus shortcuts. */
@Component({
  selector: 'app-dashboard',
  imports: [RouterLink, PageHeader, Icon, Spinner, ErrorState],
  template: `
    <app-page-header title="Dashboard" [subtitle]="'Signed in as ' + (auth.user()?.email ?? '')">
      <a class="btn btn--secondary" routerLink="/" target="_blank" rel="noopener">
        <app-icon name="external" [size]="16" /> View site
      </a>
    </app-page-header>

    @if (content.loading()) {
      <app-spinner label="Loading overview…" />
    } @else if (content.error(); as error) {
      <app-error-state [error]="error" (retry)="content.reload()" />
    } @else {
      @if (!content.data()?.profile) {
        <div class="alert alert--info setup">
          <app-icon name="info" />
          <span>Your profile is not set up yet. <a routerLink="/admin/profile">Add your name and bio</a> to complete the home page.</span>
        </div>
      }

      <div class="stats">
        @for (stat of stats(); track stat.label) {
          <a class="card card--padded card--interactive stat" [routerLink]="stat.link">
            <span class="stat__icon"><app-icon [name]="stat.icon" [size]="22" /></span>
            <span class="stat__count">{{ stat.count }}</span>
            <span class="stat__label">{{ stat.label }}</span>
          </a>
        }
      </div>

      <h2 class="quick__title">Quick actions</h2>
      <div class="quick">
        <a class="btn btn--secondary" routerLink="/admin/projects/new"><app-icon name="plus" [size]="16" /> Add project</a>
        <a class="btn btn--secondary" routerLink="/admin/certificates/new"><app-icon name="plus" [size]="16" /> Add certificate</a>
        <a class="btn btn--secondary" routerLink="/admin/experience/new"><app-icon name="plus" [size]="16" /> Add experience</a>
        <a class="btn btn--secondary" routerLink="/admin/profile"><app-icon name="user" [size]="16" /> Edit profile</a>
      </div>
    }
  `,
  styles: `
    .setup {
      margin-bottom: var(--space-5);
    }
    .stats {
      display: grid;
      gap: var(--space-4);
      grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    }
    .stat {
      display: flex;
      flex-direction: column;
      gap: var(--space-1);
      color: var(--color-text);
    }
    .stat:hover {
      text-decoration: none;
    }
    .stat__icon {
      display: grid;
      place-items: center;
      width: 40px;
      height: 40px;
      margin-bottom: var(--space-2);
      border-radius: var(--radius-md);
      background: var(--color-primary-soft);
      color: var(--color-primary);
    }
    .stat__count {
      font-size: var(--text-3xl);
      font-weight: 700;
      line-height: 1;
    }
    .stat__label {
      color: var(--color-text-muted);
    }
    .quick__title {
      margin-top: var(--space-7);
      font-size: var(--text-xl);
    }
    .quick {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-3);
    }
  `,
})
export class Dashboard {
  protected readonly auth = inject(AuthService);
  private readonly projects = inject(ProjectsService);
  private readonly certificates = inject(CertificatesService);
  private readonly experience = inject(ExperienceService);
  private readonly education = inject(EducationService);
  private readonly skills = inject(SkillsService);
  private readonly profile = inject(ProfileService);

  /** forkJoin runs all requests in parallel and emits once when every one has finished. */
  protected readonly content = new Loader(() =>
    forkJoin({
      projects: this.projects.list(),
      certificates: this.certificates.list(),
      experience: this.experience.list(),
      education: this.education.list(),
      skills: this.skills.list(),
      profile: this.profile.get(),
    }),
  );

  protected readonly stats = computed<StatCard[]>(() => {
    const d = this.content.data();
    if (!d) {
      return [];
    }
    return [
      { label: 'Projects', count: d.projects.length, icon: 'folder', link: '/admin/projects' },
      { label: 'Experience', count: d.experience.length, icon: 'briefcase', link: '/admin/experience' },
      { label: 'Education', count: d.education.length, icon: 'graduation', link: '/admin/education' },
      { label: 'Certificates', count: d.certificates.length, icon: 'award', link: '/admin/certificates' },
      { label: 'Skills', count: d.skills.length, icon: 'zap', link: '/admin/skills' },
    ];
  });
}
