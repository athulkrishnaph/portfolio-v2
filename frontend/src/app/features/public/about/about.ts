import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { ProfileService } from '../../../core/services/profile.service';
import { Loader } from '../../../core/utils/loader';
import { EmptyState } from '../../../shared/components/empty-state/empty-state';
import { ErrorState } from '../../../shared/components/error-state/error-state';
import { Icon } from '../../../shared/components/icon/icon';
import { SocialLinks } from '../../../shared/components/social-links/social-links';
import { Spinner } from '../../../shared/components/spinner/spinner';
import { IntroDirective } from '../../../shared/directives/intro.directive';

/** Full bio, photo and quick facts from the profile. */
@Component({
  selector: 'app-about',
  imports: [RouterLink, Icon, SocialLinks, Spinner, ErrorState, EmptyState, IntroDirective],
  templateUrl: './about.html',
  styleUrl: './about.scss',
})
export class About {
  private readonly profileService = inject(ProfileService);
  protected readonly profile = new Loader(() => this.profileService.get());
}
