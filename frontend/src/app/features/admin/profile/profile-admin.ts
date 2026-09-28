import { Component, OnInit, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormArray,
  FormControl,
  FormGroup,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';

import { ApiError } from '../../../core/api/api-error';
import { AuthService } from '../../../core/auth/auth.service';
import { Profile, ProfileInput, SocialLink } from '../../../core/models';
import { ProfileService } from '../../../core/services/profile.service';
import { NotificationService } from '../../../core/ui/notification.service';
import { AppValidators, applyServerErrors, revealErrors } from '../../../core/utils/forms';
import { Button } from '../../../shared/components/button/button';
import { ErrorState } from '../../../shared/components/error-state/error-state';
import { FormField, FormInput } from '../../../shared/components/form-field/form-field';
import { Icon } from '../../../shared/components/icon/icon';
import { ImageUpload } from '../../../shared/components/image-upload/image-upload';
import { PageHeader } from '../../../shared/components/page-header/page-header';
import { Spinner } from '../../../shared/components/spinner/spinner';

type LinkGroup = FormGroup<{
  platform: FormControl<string>;
  url: FormControl<string>;
}>;

/**
 * /admin/profile: owner details, social links (a dynamic FormArray) and the
 * admin password.
 */
@Component({
  selector: 'app-profile-admin',
  imports: [
    ReactiveFormsModule,
    PageHeader,
    FormField,
    FormInput,
    ImageUpload,
    Icon,
    Button,
    Spinner,
    ErrorState,
  ],
  templateUrl: './profile-admin.html',
  styles: `
    .sections {
      display: grid;
      gap: var(--space-6);
      max-width: 880px;
    }
    .section-title {
      font-size: var(--text-xl);
      margin-bottom: var(--space-1);
    }
    .links {
      display: grid;
      gap: var(--space-3);
    }
    .link-row {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 2fr) auto;
      gap: var(--space-3);
      align-items: start;
    }
    .link-row .btn {
      margin-top: 28px;
    }
  `,
})
export class ProfileAdmin implements OnInit {
  private readonly profileService = inject(ProfileService);
  private readonly auth = inject(AuthService);
  private readonly notifications = inject(NotificationService);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly loading = signal(true);
  protected readonly loadError = signal<ApiError | null>(null);
  protected readonly saving = signal(false);
  protected readonly formErrors = signal<string[]>([]);
  protected readonly savingPassword = signal(false);

  protected readonly form = this.fb.group({
    fullName: ['', [Validators.required, AppValidators.notBlank, Validators.maxLength(100)]],
    headline: ['', Validators.maxLength(150)],
    bio: ['', Validators.maxLength(5000)],
    email: ['', [Validators.email, Validators.maxLength(254)]],
    location: ['', Validators.maxLength(100)],
    imageUrl: ['', AppValidators.url],
    resumeUrl: ['', AppValidators.url],
    socialLinks: this.fb.array<LinkGroup>([]),
  });

  protected readonly passwordForm = this.fb.group(
    {
      currentPassword: ['', Validators.required],
      newPassword: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(72)]],
      confirmPassword: ['', Validators.required],
    },
    { validators: passwordsMatch },
  );

  protected get links(): FormArray<LinkGroup> {
    return this.form.controls.socialLinks;
  }

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.profileService.get().subscribe({
      next: (profile) => {
        if (profile) {
          this.fill(profile);
        }
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.loadError.set(ApiError.from(err));
        this.loading.set(false);
      },
    });
  }

  protected addLink(link: SocialLink = { platform: '', url: '' }): void {
    this.links.push(
      this.fb.group({
        platform: [link.platform, [Validators.required, AppValidators.notBlank, Validators.maxLength(50)]],
        url: [link.url, [Validators.required, AppValidators.url]],
      }),
    );
  }

  protected removeLink(index: number): void {
    this.links.removeAt(index);
    this.form.markAsDirty();
  }

  /** Moves a link one place up, changing its display order. */
  protected moveLinkUp(index: number): void {
    if (index === 0) {
      return;
    }
    const link = this.links.at(index);
    this.links.removeAt(index);
    this.links.insert(index - 1, link);
    this.form.markAsDirty();
  }

  protected save(): void {
    this.formErrors.set([]);
    if (this.form.invalid) {
      revealErrors(this.form);
      return;
    }
    this.saving.set(true);
    const input: ProfileInput = this.form.getRawValue();
    this.profileService.save(input).subscribe({
      next: (profile) => {
        this.saving.set(false);
        this.fill(profile);
        this.notifications.success('Profile saved');
      },
      error: (err: unknown) => {
        this.saving.set(false);
        const error = ApiError.from(err);
        this.formErrors.set(error.isValidation ? applyServerErrors(this.form, error) : [error.message]);
        revealErrors(this.form);
      },
    });
  }

  protected changePassword(): void {
    if (this.passwordForm.invalid) {
      revealErrors(this.passwordForm);
      return;
    }
    const { currentPassword, newPassword } = this.passwordForm.getRawValue();
    this.savingPassword.set(true);
    this.auth.changePassword({ currentPassword, newPassword }).subscribe({
      next: () => {
        this.savingPassword.set(false);
        this.passwordForm.reset();
        this.notifications.success('Password changed. Other sessions have been signed out.');
      },
      error: (err: unknown) => {
        this.savingPassword.set(false);
        const error = ApiError.from(err);
        const unmatched = error.isValidation
          ? applyServerErrors(this.passwordForm, error)
          : [error.message];
        if (unmatched.length) {
          this.notifications.error(unmatched.join(' '));
        }
      },
    });
  }

  hasUnsavedChanges(): boolean {
    return this.form.dirty && !this.saving();
  }

  private fill(profile: Profile): void {
    this.links.clear();
    profile.socialLinks.forEach((link) => this.addLink(link));
    this.form.patchValue({
      fullName: profile.fullName,
      headline: profile.headline,
      bio: profile.bio,
      email: profile.email,
      location: profile.location,
      imageUrl: profile.imageUrl,
      resumeUrl: profile.resumeUrl,
    });
    this.form.markAsPristine();
  }
}

/** Group validator: newPassword and confirmPassword must be equal. */
function passwordsMatch(group: AbstractControl): ValidationErrors | null {
  const confirm = group.get('confirmPassword');
  const mismatch = confirm?.value && group.get('newPassword')?.value !== confirm.value;
  if (mismatch) {
    confirm?.setErrors({ ...confirm.errors, mismatch: true });
  } else if (confirm?.hasError('mismatch')) {
    const { mismatch: _removed, ...rest } = confirm.errors ?? {};
    confirm.setErrors(Object.keys(rest).length ? rest : null);
  }
  return mismatch ? { mismatch: true } : null;
}
