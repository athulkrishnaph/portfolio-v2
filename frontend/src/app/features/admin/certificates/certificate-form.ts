import { Component, inject } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { Certificate, CertificateInput } from '../../../core/models';
import { CertificatesService } from '../../../core/services/certificates.service';
import { AppValidators } from '../../../core/utils/forms';
import { FormField, FormInput } from '../../../shared/components/form-field/form-field';
import { ImageUpload } from '../../../shared/components/image-upload/image-upload';
import { EntityFormPage } from '../shared/entity-form-page';
import { FormPageShell } from '../shared/form-page-shell';

/** Create / edit a certificate. */
@Component({
  selector: 'app-certificate-form',
  imports: [ReactiveFormsModule, FormPageShell, FormField, FormInput, ImageUpload],
  template: `
    <app-form-page-shell
      [title]="isEdit ? 'Edit certificate' : 'New certificate'"
      backUrl="/admin/certificates"
      formId="certificate-form"
      [loading]="loading()"
      [loadError]="loadError()"
      [saving]="saving()"
      [errors]="formErrors()"
      (retry)="load()"
      (cancelled)="cancel()"
    >
      <form id="certificate-form" class="form" [formGroup]="form" (ngSubmit)="submit()" novalidate>
        <app-form-field label="Title">
          <input appInput class="input" formControlName="title" />
        </app-form-field>

        <div class="form-row">
          <app-form-field label="Issuing organization">
            <input appInput class="input" formControlName="issuer" />
          </app-form-field>
          <app-form-field label="Issue date">
            <input appInput class="input" type="date" formControlName="issueDate" />
          </app-form-field>
        </div>

        <app-form-field label="Credential URL" hint="Link where the certificate can be verified.">
          <input appInput class="input" type="url" formControlName="credentialUrl" placeholder="https://…" />
        </app-form-field>

        <app-form-field label="Image" [control]="form.controls.imageUrl">
          <app-image-upload formControlName="imageUrl" />
        </app-form-field>

        <app-form-field label="Display order" hint="Lower numbers are shown first.">
          <input appInput class="input" type="number" min="0" formControlName="displayOrder" />
        </app-form-field>
      </form>
    </app-form-page-shell>
  `,
})
export class CertificateForm extends EntityFormPage<Certificate, CertificateInput> {
  private readonly fb = inject(NonNullableFormBuilder);
  protected readonly api = inject(CertificatesService);
  protected readonly listUrl = '/admin/certificates';
  protected readonly noun = 'Certificate';

  protected readonly form = this.fb.group({
    title: ['', [Validators.required, AppValidators.notBlank, Validators.maxLength(200)]],
    issuer: ['', [Validators.required, AppValidators.notBlank, Validators.maxLength(150)]],
    issueDate: ['', Validators.required],
    credentialUrl: ['', AppValidators.url],
    imageUrl: ['', AppValidators.url],
    displayOrder: [0, [Validators.min(0), Validators.max(1_000_000)]],
  });

  protected patchForm(c: Certificate): void {
    this.form.setValue({
      title: c.title,
      issuer: c.issuer,
      issueDate: c.issueDate,
      credentialUrl: c.credentialUrl,
      imageUrl: c.imageUrl,
      displayOrder: c.displayOrder,
    });
  }

  protected toInput(): CertificateInput {
    const v = this.form.getRawValue();
    return { ...v, displayOrder: v.displayOrder ?? 0 };
  }
}
