import { Injectable, computed, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, Validators } from '@angular/forms';

import { ApiError } from '../../../core/api/api-error';
import { Skill, SkillInput } from '../../../core/models';
import { SkillsService, groupSkills } from '../../../core/services/skills.service';
import { NotificationService } from '../../../core/ui/notification.service';
import { AppValidators, applyServerErrors, revealErrors } from '../../../core/utils/forms';
import { Loader } from '../../../core/utils/loader';
import { DeleteAction } from '../shared/delete-action';

/**
 * State and actions of the skills admin page: the list, the create/edit
 * modal and the featured star. Provided by SkillsAdmin, so it lives exactly
 * as long as the page.
 */
@Injectable()
export class SkillsAdminStore {
  private readonly service = inject(SkillsService);
  private readonly notifications = inject(NotificationService);
  private readonly fb = inject(NonNullableFormBuilder);

  // ---- List --------------------------------------------------------------------

  readonly skills = new Loader(() => this.service.list());
  readonly groups = computed(() => groupSkills(this.skills.data() ?? []));
  readonly count = computed(() => this.skills.data()?.length ?? 0);
  readonly deleter = new DeleteAction('Skill', (id) => this.service.delete(id));

  /** id of the skill whose star is being saved. */
  readonly featuringId = signal<number | null>(null);

  // ---- Create / edit modal ---------------------------------------------------------

  readonly modalOpen = signal(false);
  readonly editing = signal<Skill | null>(null);
  readonly saving = signal(false);
  readonly formError = signal('');

  readonly form = this.fb.group({
    name: ['', [Validators.required, AppValidators.notBlank, Validators.maxLength(50)]],
    category: ['', [Validators.required, AppValidators.notBlank, Validators.maxLength(50)]],
    displayOrder: [0, [Validators.min(0), Validators.max(1_000_000)]],
    isFeatured: [false],
  });

  openCreate(): void {
    this.editing.set(null);
    // Keep the last category: skills are usually added in batches per category.
    this.form.reset({ name: '', category: this.form.controls.category.value, displayOrder: 0, isFeatured: false });
    this.formError.set('');
    this.modalOpen.set(true);
  }

  openEdit(skill: Skill): void {
    this.editing.set(skill);
    this.form.reset({
      name: skill.name,
      category: skill.category,
      displayOrder: skill.displayOrder,
      isFeatured: skill.isFeatured,
    });
    this.formError.set('');
    this.modalOpen.set(true);
  }

  closeModal(): void {
    this.modalOpen.set(false);
  }

  save(): void {
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

  // ---- Row actions -------------------------------------------------------------------

  /** The star: sends the whole skill back with isFeatured flipped (PUT replaces all fields). */
  toggleFeatured(skill: Skill): void {
    const { id: _id, createdAt: _created, updatedAt: _updated, ...input } = skill;
    this.featuringId.set(skill.id);
    this.service.update(skill.id, { ...input, isFeatured: !skill.isFeatured }).subscribe({
      next: (updated) => {
        this.featuringId.set(null);
        this.notifications.success(
          updated.isFeatured ? `"${updated.name}" featured on the home page` : `"${updated.name}" removed from featured`,
        );
        this.skills.refresh();
      },
      error: (err: unknown) => {
        this.featuringId.set(null);
        this.notifications.error(ApiError.from(err).message);
      },
    });
  }

  remove(skill: Skill): void {
    this.deleter.run(skill.id, skill.name, () => this.skills.refresh());
  }
}
