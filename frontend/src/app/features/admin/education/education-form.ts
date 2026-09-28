import { Component, inject } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { Education, EducationInput } from '../../../core/models';
import { EducationService } from '../../../core/services/education.service';
import { AppValidators } from '../../../core/utils/forms';
import { FormField, FormInput } from '../../../shared/components/form-field/form-field';
import { EntityFormPage } from '../shared/entity-form-page';
import { FormPageShell } from '../shared/form-page-shell';

/** Create / edit an education entry. */
@Component({
  selector: 'app-education-form',
  imports: [ReactiveFormsModule, FormPageShell, FormField, FormInput],
  template: `
    <app-form-page-shell
      [title]="isEdit ? 'Edit education' : 'New education'"
      backUrl="/admin/education"
      formId="education-form"
      [loading]="loading()"
      [loadError]="loadError()"
      [saving]="saving()"
      [errors]="formErrors()"
      (retry)="load()"
      (cancelled)="cancel()"
    >
      <form id="education-form" class="form" [formGroup]="form" (ngSubmit)="submit()" novalidate>
        <app-form-field label="Institution">
          <input appInput class="input" formControlName="institution" placeholder="e.g. University of Lisbon" />
        </app-form-field>

        <div class="form-row">
          <app-form-field label="Degree">
            <input appInput class="input" formControlName="degree" placeholder="e.g. BSc" />
          </app-form-field>
          <app-form-field label="Field of study">
            <input appInput class="input" formControlName="fieldOfStudy" placeholder="e.g. Computer Science" />
          </app-form-field>
        </div>

        <app-form-field label="Location">
          <input appInput class="input" formControlName="location" />
        </app-form-field>

        <div class="form-row">
          <app-form-field label="Start date">
            <input appInput class="input" type="date" formControlName="startDate" />
          </app-form-field>
          <app-form-field label="End date" hint="Leave empty if you are still studying.">
            <input appInput class="input" type="date" formControlName="endDate" />
          </app-form-field>
        </div>

        <app-form-field label="Description">
          <textarea appInput class="textarea" rows="5" formControlName="description"></textarea>
        </app-form-field>

        <app-form-field label="Display order" hint="Lower numbers are shown first.">
          <input appInput class="input" type="number" min="0" formControlName="displayOrder" />
        </app-form-field>
      </form>
    </app-form-page-shell>
  `,
})
export class EducationForm extends EntityFormPage<Education, EducationInput> {
  private readonly fb = inject(NonNullableFormBuilder);
  protected readonly api = inject(EducationService);
  protected readonly listUrl = '/admin/education';
  protected readonly noun = 'Education';

  protected readonly form = this.fb.group(
    {
      institution: ['', [Validators.required, AppValidators.notBlank, Validators.maxLength(150)]],
      degree: ['', [Validators.required, AppValidators.notBlank, Validators.maxLength(150)]],
      fieldOfStudy: ['', Validators.maxLength(150)],
      location: ['', Validators.maxLength(150)],
      startDate: ['', Validators.required],
      endDate: [''],
      description: ['', Validators.maxLength(10000)],
      displayOrder: [0, [Validators.min(0), Validators.max(1_000_000)]],
    },
    { validators: AppValidators.dateOrder('startDate', 'endDate') },
  );

  protected patchForm(e: Education): void {
    this.form.setValue({
      institution: e.institution,
      degree: e.degree,
      fieldOfStudy: e.fieldOfStudy,
      location: e.location,
      startDate: e.startDate,
      endDate: e.endDate ?? '',
      description: e.description,
      displayOrder: e.displayOrder,
    });
  }

  protected toInput(): EducationInput {
    const v = this.form.getRawValue();
    return { ...v, endDate: v.endDate || null, displayOrder: v.displayOrder ?? 0 };
  }
}
