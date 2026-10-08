import { Injectable, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormArray,
  FormControl,
  FormGroup,
  NonNullableFormBuilder,
  ValidationErrors,
  Validators,
} from '@angular/forms';

import { ApiError } from '../../../core/api/api-error';
import { AuthService } from '../../../core/auth/auth.service';
import { Profile, ProfileInput, SocialLink } from '../../../core/models';
import { ProfileService } from '../../../core/services/profile.service';
import { NotificationService } from '../../../core/ui/notification.service';
import { AppValidators, applyServerErrors, revealErrors } from '../../../core/utils/forms';

type LinkGroup = FormGroup<{
  platform: FormControl<string>;
  url: FormControl<string>;
}>;

/**
 * State and actions of the profile admin page: the profile form (with its
 * social links), cancel/save, and the password change. Provided by
 * ProfileAdmin, so it lives as long as the page; the profile loads when the
 * store is created.
 */
@Injectable()
export class ProfileAdminStore {
  private readonly profileService = inject(ProfileService);
  private readonly auth = inject(AuthService);
  private readonly notifications = inject(NotificationService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly loading = signal(true);
  readonly loadError = signal<ApiError | null>(null);
  readonly saving = signal(false);
  readonly formErrors = signal<string[]>([]);
  readonly savingPassword = signal(false);
  /** The profile as last loaded or saved; Cancel returns to it. */
  private saved: Profile | null = null;

  readonly form = this.fb.group({
    fullName: ['', [Validators.required, AppValidators.notBlank, Validators.maxLength(100)]],
    headline: ['', Validators.maxLength(150)],
    bio: ['', Validators.maxLength(5000)],
    email: ['', [Validators.email, Validators.maxLength(254)]],
    location: ['', Validators.maxLength(100)],
    imageUrl: ['', AppValidators.url],
    resumeUrl: ['', AppValidators.url],
    socialLinks: this.fb.array<LinkGroup>([]),
  });

  readonly passwordForm = this.fb.group(
    {
      currentPassword: ['', Validators.required],
      newPassword: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(72)]],
      confirmPassword: ['', Validators.required],
    },
    { validators: passwordsMatch },
  );

  get links(): FormArray<LinkGroup> {
    return this.form.controls.socialLinks;
  }

  constructor() {
    this.load();
  }

  // ---- Profile -------------------------------------------------------------------

  load(): void {
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

  save(): void {
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

  /** Discards unsaved edits: back to the last loaded or saved profile. */
  cancel(): void {
    this.formErrors.set([]);
    if (this.saved) {
      this.fill(this.saved);
    } else {
      this.links.clear();
      this.form.reset();
    }
    // Hide validation messages from the discarded edits.
    this.form.markAsUntouched();
  }

  hasUnsavedChanges(): boolean {
    return this.form.dirty && !this.saving();
  }

  // ---- Social links ----------------------------------------------------------------

  addLink(): void {
    this.pushLink({ platform: '', url: '' });
    this.form.markAsDirty();
  }

  removeLink(index: number): void {
    this.links.removeAt(index);
    this.form.markAsDirty();
  }

  /** Moves a link one place up, changing its display order. */
  moveLinkUp(index: number): void {
    if (index === 0) {
      return;
    }
    const link = this.links.at(index);
    this.links.removeAt(index);
    this.links.insert(index - 1, link);
    this.form.markAsDirty();
  }

  // ---- Password -------------------------------------------------------------------

  changePassword(): void {
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
        const unmatched = error.isValidation ? applyServerErrors(this.passwordForm, error) : [error.message];
        if (unmatched.length) {
          this.notifications.error(unmatched.join(' '));
        }
      },
    });
  }

  // ---- Helpers ---------------------------------------------------------------------

  private pushLink(link: SocialLink): void {
    this.links.push(
      this.fb.group({
        platform: [link.platform, [Validators.required, AppValidators.notBlank, Validators.maxLength(50)]],
        url: [link.url, [Validators.required, AppValidators.url]],
      }),
    );
  }

  private fill(profile: Profile): void {
    this.saved = profile;
    this.links.clear();
    profile.socialLinks.forEach((link) => this.pushLink(link));
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
