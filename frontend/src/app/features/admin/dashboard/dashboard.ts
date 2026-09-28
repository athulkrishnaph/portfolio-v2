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
import { ChatKnowledgeCard } from './chat-knowledge-card';

interface StatCard {
  label: string;
  count: number;
  icon: IconName;
  link: string;
}

/** Overview: how much content exists, plus shortcuts. */
@Component({
  selector: 'app-dashboard',
  imports: [RouterLink, PageHeader, Icon, Spinner, ErrorState, ChatKnowledgeCard],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
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
