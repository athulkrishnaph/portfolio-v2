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
  templateUrl: './experience-form.html',
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
