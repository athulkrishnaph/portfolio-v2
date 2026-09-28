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
  template: `
    <app-page-header title="Skills" [subtitle]="(skills.data()?.length ?? 0) + ' skills'">
      <button appButton type="button" variant="primary" (click)="openCreate()">
        <app-icon name="plus" [size]="16" /> New skill
      </button>
    </app-page-header>

    @if (skills.loading()) {
      <app-spinner label="Loading skills…" />
    } @else if (skills.error(); as error) {
      <app-error-state [error]="error" (retry)="skills.reload()" />
    } @else if (groups().length) {
      <div class="groups">
        @for (group of groups(); track group.category) {
          <section class="card group">
            <h2 class="group__title">{{ group.category }} <span class="text-muted">({{ group.skills.length }})</span></h2>
            <ul class="group__list">
              @for (skill of group.skills; track skill.id) {
                <li class="group__item">
                  <span>{{ skill.name }} <span class="text-muted order">#{{ skill.displayOrder }}</span></span>
                  <span>
                    <button type="button" class="btn btn--ghost btn--icon" (click)="openEdit(skill)">
                      <app-icon name="edit" [size]="16" [label]="'Edit ' + skill.name" />
                    </button>
                    <button
                      type="button"
                      class="btn btn--ghost btn--icon"
                      [disabled]="deleter.busyId() === skill.id"
                      (click)="remove(skill)"
                    >
                      <app-icon name="trash" [size]="16" [label]="'Delete ' + skill.name" />
                    </button>
                  </span>
                </li>
              }
            </ul>
          </section>
        }
      </div>
    } @else {
      <app-empty-state icon="zap" title="No skills yet">
        <button appButton type="button" variant="primary" (click)="openCreate()">New skill</button>
      </app-empty-state>
    }

    <app-modal [open]="modalOpen()" [title]="editing() ? 'Edit skill' : 'New skill'" (closed)="modalOpen.set(false)">
      <form class="form" [formGroup]="form" (ngSubmit)="save()" novalidate>
        @if (formError()) {
          <div class="alert alert--danger" role="alert">{{ formError() }}</div>
        }
        <app-form-field label="Name">
          <input appInput class="input" formControlName="name" placeholder="e.g. PostgreSQL" />
        </app-form-field>
        <app-form-field label="Category" hint="Pick an existing one or type a new category.">
          <input appInput class="input" formControlName="category" list="skill-categories" />
          <datalist id="skill-categories">
            @for (group of groups(); track group.category) {
              <option [value]="group.category"></option>
            }
          </datalist>
        </app-form-field>
        <app-form-field label="Display order" hint="Order within the category; lower comes first.">
          <input appInput class="input" type="number" min="0" formControlName="displayOrder" />
        </app-form-field>
        <div class="form-actions">
          <button appButton type="button" variant="ghost" (click)="modalOpen.set(false)">Cancel</button>
          <button appButton type="submit" variant="primary" [loading]="saving()">Save</button>
        </div>
      </form>
    </app-modal>
  `,
  styles: `
    .groups {
      display: grid;
      gap: var(--space-5);
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    }
    .group {
      padding: var(--space-4);
    }
    .group__title {
      font-size: var(--text-lg);
    }
    .group__list {
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .group__item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: var(--space-1) 0;
      border-bottom: 1px solid var(--color-border);
    }
    .group__item:last-child {
      border-bottom: 0;
    }
    .order {
      font-size: var(--text-xs);
    }
  `,
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
