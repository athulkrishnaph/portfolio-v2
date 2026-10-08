import { Injectable, computed, inject, signal } from '@angular/core';
import { forkJoin } from 'rxjs';

import { ApiError } from '../../../core/api/api-error';
import { AuthService } from '../../../core/auth/auth.service';
import { CertificatesService } from '../../../core/services/certificates.service';
import { ChatService } from '../../../core/services/chat.service';
import { EducationService } from '../../../core/services/education.service';
import { ExperienceService } from '../../../core/services/experience.service';
import { ProfileService } from '../../../core/services/profile.service';
import { ProjectsService } from '../../../core/services/projects.service';
import { SkillsService } from '../../../core/services/skills.service';
import { NotificationService } from '../../../core/ui/notification.service';
import { Loader } from '../../../core/utils/loader';
import { IconName } from '../../../shared/components/icon/icon';

export interface StatCard {
  label: string;
  count: number;
  icon: IconName;
  link: string;
}

/**
 * State and actions of the admin dashboard: content counts and the AI
 * assistant's knowledge. Provided by Dashboard (and shared with its
 * ChatKnowledgeCard), so it lives as long as the page.
 */
@Injectable()
export class DashboardStore {
  private readonly auth = inject(AuthService);
  private readonly projects = inject(ProjectsService);
  private readonly certificates = inject(CertificatesService);
  private readonly experience = inject(ExperienceService);
  private readonly education = inject(EducationService);
  private readonly skills = inject(SkillsService);
  private readonly profile = inject(ProfileService);
  private readonly chat = inject(ChatService);
  private readonly notifications = inject(NotificationService);

  readonly userEmail = computed(() => this.auth.user()?.email ?? '');

  // ---- Content overview ---------------------------------------------------------

  /** forkJoin runs all requests in parallel and emits once when every one has finished. */
  readonly content = new Loader(() =>
    forkJoin({
      projects: this.projects.list(),
      certificates: this.certificates.list(),
      experience: this.experience.list(),
      education: this.education.list(),
      skills: this.skills.list(),
      profile: this.profile.get(),
    }),
  );

  /** False once loaded without a profile (the page then suggests creating one). */
  readonly hasProfile = computed(() => !!this.content.data()?.profile);

  readonly stats = computed<StatCard[]>(() => {
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

  // ---- AI assistant knowledge -----------------------------------------------------

  readonly knowledge = new Loader(() => this.chat.knowledge());
  readonly rebuilding = signal(false);

  /** Re-indexes the portfolio content for the chatbot after edits. */
  rebuildKnowledge(): void {
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
        this.knowledge.refresh();
      },
      error: (err: unknown) => {
        this.rebuilding.set(false);
        this.notifications.error(ApiError.from(err).message);
      },
    });
  }
}
