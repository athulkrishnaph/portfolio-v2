import { Component, inject, signal } from '@angular/core';

import { ProfileService } from '../../../core/services/profile.service';
import { NotificationService } from '../../../core/ui/notification.service';
import { Loader } from '../../../core/utils/loader';
import { EmptyState } from '../../../shared/components/empty-state/empty-state';
import { ErrorState } from '../../../shared/components/error-state/error-state';
import { Icon } from '../../../shared/components/icon/icon';
import { SocialLinks } from '../../../shared/components/social-links/social-links';
import { Spinner } from '../../../shared/components/spinner/spinner';

/**
 * Contact details from the profile. Email opens the visitor's mail app
 * (mailto:), so no mail server is needed.
 */
@Component({
  selector: 'app-contact',
  imports: [Icon, SocialLinks, Spinner, ErrorState, EmptyState],
  templateUrl: './contact.html',
  styleUrl: './contact.scss',
})
export class Contact {
  private readonly profileService = inject(ProfileService);
  private readonly notifications = inject(NotificationService);

  protected readonly profile = new Loader(() => this.profileService.get());
  protected readonly copied = signal(false);

  protected async copy(email: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(email);
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2000);
    } catch {
      this.notifications.error('Could not copy. Please select the address and copy it manually.');
    }
  }
}
