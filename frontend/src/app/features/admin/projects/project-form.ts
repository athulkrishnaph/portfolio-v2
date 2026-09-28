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
  templateUrl: './project-form.html',
  styleUrl: './project-form.scss',
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
