import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { catchError, of } from 'rxjs';

import { ProfileService } from '../../core/services/profile.service';
import { SocialLinks } from '../../shared/components/social-links/social-links';

/** Public site footer with the owner's name and social links (from the profile API). */
@Component({
  selector: 'app-footer',
  imports: [SocialLinks, RouterLink],
  templateUrl: './footer.html',
  styleUrl: './footer.scss',
})
export class Footer {
  protected readonly year = new Date().getFullYear();
  protected readonly profile = toSignal(
    inject(ProfileService)
      .get()
      .pipe(catchError(() => of(null))),
    { initialValue: null },
  );
}
