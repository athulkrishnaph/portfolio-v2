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
  templateUrl: './skills.html',
  styleUrl: './skills.scss',
})
export class Skills {
  private readonly skillsService = inject(SkillsService);
  protected readonly skills = new Loader(() => this.skillsService.list());
  protected readonly groups = computed(() => groupSkills(this.skills.data() ?? []));
}
