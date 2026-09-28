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
  templateUrl: './certificate-form.html',
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
