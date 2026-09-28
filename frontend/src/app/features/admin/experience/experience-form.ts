import { Component, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { Experience, ExperienceInput } from '../../../core/models';
import { ExperienceService } from '../../../core/services/experience.service';
import { AppValidators } from '../../../core/utils/forms';
import { FormField, FormInput } from '../../../shared/components/form-field/form-field';
import { EntityFormPage } from '../shared/entity-form-page';
import { FormPageShell } from '../shared/form-page-shell';

/** Create / edit a work experience entry. */
@Component({
  selector: 'app-experience-form',
  imports: [ReactiveFormsModule, FormPageShell, FormField, FormInput],
  template: `
    <app-form-page-shell
      [title]="isEdit ? 'Edit experience' : 'New experience'"
      backUrl="/admin/experience"
      formId="experience-form"
      [loading]="loading()"
      [loadError]="loadError()"
      [saving]="saving()"
      [errors]="formErrors()"
      (retry)="load()"
      (cancelled)="cancel()"
    >
      <form id="experience-form" class="form" [formGroup]="form" (ngSubmit)="submit()" novalidate>
        <div class="form-row">
          <app-form-field label="Position">
            <input appInput class="input" formControlName="position" placeholder="e.g. Backend Developer" />
          </app-form-field>
          <app-form-field label="Company">
            <input appInput class="input" formControlName="company" />
          </app-form-field>
        </div>

        <app-form-field label="Location">
          <input appInput class="input" formControlName="location" placeholder="e.g. Berlin, Germany or Remote" />
        </app-form-field>

        <div class="form-row">
          <app-form-field label="Start date">
            <input appInput class="input" type="date" formControlName="startDate" />
          </app-form-field>
          <app-form-field label="End date" [hint]="form.controls.isCurrent.value ? 'Not needed for your current position.' : ''">
            <input appInput class="input" type="date" formControlName="endDate" />
          </app-form-field>
        </div>

        <label class="checkbox">
          <input type="checkbox" formControlName="isCurrent" />
          I currently work here
        </label>

        <app-form-field label="Description" hint="Responsibilities and achievements. Line breaks are kept.">
          <textarea appInput class="textarea" rows="7" formControlName="description"></textarea>
        </app-form-field>

        <app-form-field label="Display order" hint="Lower numbers are shown first.">
          <input appInput class="input" type="number" min="0" formControlName="displayOrder" />
        </app-form-field>
      </form>
    </app-form-page-shell>
  `,
})
export class ExperienceForm extends EntityFormPage<Experience, ExperienceInput> {
  private readonly fb = inject(NonNullableFormBuilder);
  protected readonly api = inject(ExperienceService);
  protected readonly listUrl = '/admin/experience';
  protected readonly noun = 'Experience';

  protected readonly form = this.fb.group(
    {
      position: ['', [Validators.required, AppValidators.notBlank, Validators.maxLength(150)]],
      company: ['', [Validators.required, AppValidators.notBlank, Validators.maxLength(150)]],
      location: ['', Validators.maxLength(150)],
      startDate: ['', Validators.required],
      endDate: ['', Validators.required],
      isCurrent: [false],
      description: ['', Validators.maxLength(10000)],
      displayOrder: [0, [Validators.min(0), Validators.max(1_000_000)]],
    },
    { validators: AppValidators.dateOrder('startDate', 'endDate') },
  );

  constructor() {
    super();
    // A current job has no end date: disable (and clear) the field while checked.
    this.form.controls.isCurrent.valueChanges.pipe(takeUntilDestroyed()).subscribe((current) => {
      const end = this.form.controls.endDate;
      if (current) {
        end.setValue('');
        end.disable();
      } else {
        end.enable();
      }
    });
  }

  protected patchForm(e: Experience): void {
    this.form.setValue({
      position: e.position,
      company: e.company,
      location: e.location,
      startDate: e.startDate,
      endDate: e.endDate ?? '',
      isCurrent: e.isCurrent,
      description: e.description,
      displayOrder: e.displayOrder,
    });
  }

  protected toInput(): ExperienceInput {
    const v = this.form.getRawValue();
    return {
      ...v,
      endDate: v.isCurrent || !v.endDate ? null : v.endDate,
      displayOrder: v.displayOrder ?? 0,
    };
  }
}
