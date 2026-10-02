import { Component, computed, effect, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { ProfileService } from '../../../core/services/profile.service';
import { ProjectsService } from '../../../core/services/projects.service';
import { SkillsService, groupSkills } from '../../../core/services/skills.service';
import { AppTitleStrategy } from '../../../core/ui/title-strategy';
import { Loader } from '../../../core/utils/loader';
import { ErrorState } from '../../../shared/components/error-state/error-state';
import { Icon } from '../../../shared/components/icon/icon';
import { ProjectCard } from '../../../shared/components/project-card/project-card';
import { SocialLinks } from '../../../shared/components/social-links/social-links';
import { Spinner } from '../../../shared/components/spinner/spinner';

/** Landing page: hero from the profile, featured projects and a skills overview. */
@Component({
  selector: 'app-home',
  imports: [RouterLink, Icon, ProjectCard, SocialLinks, Spinner, ErrorState],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class Home {
  private readonly titles = inject(AppTitleStrategy);
  private readonly profileService = inject(ProfileService);
  private readonly projectsService = inject(ProjectsService);
  private readonly skillsService = inject(SkillsService);

  protected readonly profile = new Loader(() => this.profileService.get());
  protected readonly featured = new Loader(() => this.projectsService.listFeatured());
  protected readonly skills = new Loader(() => this.skillsService.list());

  protected readonly skillGroups = computed(() => groupSkills(this.skills.data() ?? []));

  /**
   * Skills for the decorative code card: the featured ones (starred in the
   * admin, in display order), or else the first skill of the first few categories.
   */
  protected readonly topSkills = computed(() => {
    const featured = this.skillGroups()
      .flatMap((g) => g.skills)
      .filter((s) => s.isFeatured)
      .map((s) => s.name);
    if (featured.length) {
      return featured;
    }
    return this.skillGroups()
      .slice(0, 3)
      .map((g) => g.skills[0].name);
  });

  /** First paragraph of the bio, for the hero. */
  protected readonly intro = computed(() => this.profile.data()?.bio.split(/\n\s*\n/)[0] ?? '');

  constructor() {
    // "Alex Morgan · Full-Stack Developer" as the tab title of the home page.
    effect(() => {
      const p = this.profile.data();
      if (p) {
        this.titles.setPageTitle(p.headline || undefined);
      }
    });
  }
}
