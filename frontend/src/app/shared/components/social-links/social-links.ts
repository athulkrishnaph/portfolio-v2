import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { SocialLink } from '../../../core/models';
import { Icon, platformIcon } from '../icon/icon';

/** Row of icon links to the owner's profiles (GitHub, LinkedIn, ...). */
@Component({
  selector: 'app-social-links',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './social-links.html',
  styleUrl: './social-links.scss',
})
export class SocialLinks {
  readonly links = input.required<SocialLink[]>();
  readonly showLabels = input(false);

  protected readonly iconFor = platformIcon;
}
