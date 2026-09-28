import { Component, computed, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { ApiError } from '../../../core/api/api-error';
import { Skill, SkillInput } from '../../../core/models';
import { SkillsService, groupSkills } from '../../../core/services/skills.service';
import { NotificationService } from '../../../core/ui/notification.service';
import { AppValidators, applyServerErrors, revealErrors } from '../../../core/utils/forms';
import { Loader } from '../../../core/utils/loader';
import { Button } from '../../../shared/components/button/button';
import { EmptyState } from '../../../shared/components/empty-state/empty-state';
import { ErrorState } from '../../../shared/components/error-state/error-state';
import { FormField, FormInput } from '../../../shared/components/form-field/form-field';
import { Icon } from '../../../shared/components/icon/icon';
import { Modal } from '../../../shared/components/modal/modal';
import { PageHeader } from '../../../shared/components/page-header/page-header';
import { Spinner } from '../../../shared/components/spinner/spinner';
import { DeleteAction } from '../shared/delete-action';

/**
 * /admin/skills: skills grouped by category. Skills are small, so they are
 * created and edited in a modal on this page instead of separate routes.
 */
@Component({
  selector: 'app-skills-admin',
  imports: [
    ReactiveFormsModule,
    PageHeader,
    Icon,
    Spinner,
    ErrorState,
    EmptyState,
    Modal,
    FormField,
    FormInput,
    Button,
  ],
  templateUrl: './skills-admin.html',
  styleUrl: './skills-admin.scss',
})
export class SkillsAdmin {
  private readonly service = inject(SkillsService);
  private readonly notifications = inject(NotificationService);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly skills = new Loader(() => this.service.list());
  protected readonly groups = computed(() => groupSkills(this.skills.data() ?? []));
  protected readonly deleter = new DeleteAction('Skill', (id) => this.service.delete(id));

  protected readonly modalOpen = signal(false);
  protected readonly editing = signal<Skill | null>(null);
  protected readonly saving = signal(false);
  protected readonly formError = signal('');

  protected readonly form = this.fb.group({
    name: ['', [Validators.required, AppValidators.notBlank, Validators.maxLength(50)]],
    category: ['', [Validators.required, AppValidators.notBlank, Validators.maxLength(50)]],
    displayOrder: [0, [Validators.min(0), Validators.max(1_000_000)]],
  });

  protected openCreate(): void {
    this.editing.set(null);
    // Keep the last category: skills are usually added in batches per category.
    this.form.reset({ name: '', category: this.form.controls.category.value, displayOrder: 0 });
    this.formError.set('');
    this.modalOpen.set(true);
  }

  protected openEdit(skill: Skill): void {
    this.editing.set(skill);
    this.form.reset({ name: skill.name, category: skill.category, displayOrder: skill.displayOrder });
    this.formError.set('');
    this.modalOpen.set(true);
  }

  protected save(): void {
    if (this.form.invalid) {
      revealErrors(this.form);
      return;
    }
    const v = this.form.getRawValue();
    const input: SkillInput = { ...v, displayOrder: v.displayOrder ?? 0 };
    const editing = this.editing();
    const request = editing ? this.service.update(editing.id, input) : this.service.create(input);

    this.saving.set(true);
    this.formError.set('');
    request.subscribe({
      next: (skill) => {
        this.saving.set(false);
        this.modalOpen.set(false);
        this.notifications.success(`Skill "${skill.name}" ${editing ? 'updated' : 'added'}`);
        this.skills.refresh();
      },
      error: (err: unknown) => {
        this.saving.set(false);
        const error = ApiError.from(err);
        const unmatched = error.isValidation ? applyServerErrors(this.form, error) : [error.message];
        this.formError.set(unmatched.join(' '));
      },
    });
  }

  protected remove(skill: Skill): void {
    this.deleter.run(skill.id, skill.name, () => this.skills.refresh());
  }
}
