import { Component, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { Project, ProjectInput } from '../../../core/models';
import { ProjectsService } from '../../../core/services/projects.service';
import { AppValidators } from '../../../core/utils/forms';
import { FormField, FormInput } from '../../../shared/components/form-field/form-field';
import { ImageUpload } from '../../../shared/components/image-upload/image-upload';
import { TagInput } from '../../../shared/components/tag-input/tag-input';
import { EntityFormPage } from '../shared/entity-form-page';
import { FormPageShell } from '../shared/form-page-shell';

/** Create / edit a project: /admin/projects/new and /admin/projects/:id/edit. */
@Component({
  selector: 'app-project-form',
  imports: [ReactiveFormsModule, FormPageShell, FormField, FormInput, ImageUpload, TagInput],
  template: `
    <app-form-page-shell
      [title]="isEdit ? 'Edit project' : 'New project'"
      backUrl="/admin/projects"
      formId="project-form"
      [loading]="loading()"
      [loadError]="loadError()"
      [saving]="saving()"
      [errors]="formErrors()"
      (retry)="load()"
      (cancelled)="cancel()"
    >
      <form id="project-form" class="form" [formGroup]="form" (ngSubmit)="submit()" novalidate>
        <div class="form-row">
          <app-form-field label="Title">
            <input appInput class="input" formControlName="title" autocomplete="off" />
          </app-form-field>
          <app-form-field label="Slug" hint="Used in the URL: /projects/your-slug. Leave empty to generate it from the title.">
            <input appInput class="input" formControlName="slug" autocomplete="off" />
          </app-form-field>
        </div>

        <app-form-field label="Summary" hint="One or two sentences for the project card.">
          <textarea appInput class="textarea textarea--short" formControlName="summary"></textarea>
        </app-form-field>

        <app-form-field label="Description" hint="Shown on the project page. Line breaks are kept.">
          <textarea appInput class="textarea" rows="8" formControlName="description"></textarea>
        </app-form-field>

        <app-form-field label="Technologies" [control]="form.controls.technologies" hint="Press Enter after each one.">
          <app-tag-input formControlName="technologies" placeholder="e.g. Go, Angular, PostgreSQL" />
        </app-form-field>

        <div class="form-row">
          <app-form-field label="GitHub URL">
            <input appInput class="input" type="url" formControlName="githubUrl" placeholder="https://github.com/…" />
          </app-form-field>
          <app-form-field label="Live / demo URL">
            <input appInput class="input" type="url" formControlName="liveUrl" placeholder="https://…" />
          </app-form-field>
        </div>

        <app-form-field label="Image" [control]="form.controls.imageUrl">
          <app-image-upload formControlName="imageUrl" />
        </app-form-field>

        <div class="form-row">
          <app-form-field label="Display order" hint="Lower numbers are shown first.">
            <input appInput class="input" type="number" min="0" formControlName="displayOrder" />
          </app-form-field>
          <div class="featured">
            <label class="checkbox">
              <input type="checkbox" formControlName="isFeatured" />
              Featured on the home page
            </label>
          </div>
        </div>
      </form>
    </app-form-page-shell>
  `,
  styles: `
    .textarea--short {
      min-height: 80px;
    }
    .featured {
      display: flex;
      align-items: center;
      padding-top: var(--space-5);
    }
  `,
})
export class ProjectForm extends EntityFormPage<Project, ProjectInput> {
  private readonly fb = inject(NonNullableFormBuilder);
  protected readonly api = inject(ProjectsService);
  protected readonly listUrl = '/admin/projects';
  protected readonly noun = 'Project';

  protected readonly form = this.fb.group({
    title: ['', [Validators.required, AppValidators.notBlank, Validators.maxLength(150)]],
    slug: ['', [AppValidators.slug, Validators.maxLength(100)]],
    summary: ['', Validators.maxLength(300)],
    description: ['', Validators.maxLength(20000)],
    technologies: [[] as string[]],
    githubUrl: ['', AppValidators.url],
    liveUrl: ['', AppValidators.url],
    imageUrl: ['', AppValidators.url],
    isFeatured: [false],
    displayOrder: [0, [Validators.min(0), Validators.max(1_000_000)]],
  });

  constructor() {
    super();
    // Suggest a slug from the title while the slug has not been edited by hand.
    this.form.controls.title.valueChanges.pipe(takeUntilDestroyed()).subscribe((title) => {
      const slug = this.form.controls.slug;
      if (!slug.dirty && !this.isEdit) {
        slug.setValue(slugify(title));
      }
    });
  }

  protected patchForm(p: Project): void {
    this.form.setValue({
      title: p.title,
      slug: p.slug,
      summary: p.summary,
      description: p.description,
      technologies: p.technologies,
      githubUrl: p.githubUrl,
      liveUrl: p.liveUrl,
      imageUrl: p.imageUrl,
      isFeatured: p.isFeatured,
      displayOrder: p.displayOrder,
    });
  }

  protected toInput(): ProjectInput {
    const v = this.form.getRawValue();
    return { ...v, displayOrder: v.displayOrder ?? 0 };
  }
}

/** Same rules as the Go API's Slugify: "My App (v2)" → "my-app-v2". */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100)
    .replace(/-+$/, '');
}
