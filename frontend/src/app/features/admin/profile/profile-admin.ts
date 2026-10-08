import { Component, inject } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';

import { Button } from '../../../shared/components/button/button';
import { ErrorState } from '../../../shared/components/error-state/error-state';
import { FormField, FormInput } from '../../../shared/components/form-field/form-field';
import { Icon } from '../../../shared/components/icon/icon';
import { ImageUpload } from '../../../shared/components/image-upload/image-upload';
import { PageHeader } from '../../../shared/components/page-header/page-header';
import { Spinner } from '../../../shared/components/spinner/spinner';
import { HasUnsavedChanges } from '../shared/unsaved-changes.guard';
import { ProfileAdminStore } from './profile-admin.store';

/**
 * /admin/profile: owner details, social links and the admin password.
 * State and actions live in ProfileAdminStore.
 */
@Component({
  selector: 'app-profile-admin',
  imports: [ReactiveFormsModule, PageHeader, FormField, FormInput, ImageUpload, Icon, Button, Spinner, ErrorState],
  providers: [ProfileAdminStore],
  templateUrl: './profile-admin.html',
  styleUrl: './profile-admin.scss',
})
export class ProfileAdmin implements HasUnsavedChanges {
  protected readonly store = inject(ProfileAdminStore);

  /** Called by the unsaved-changes route guard. */
  hasUnsavedChanges(): boolean {
    return this.store.hasUnsavedChanges();
  }
}
