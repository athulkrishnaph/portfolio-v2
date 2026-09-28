import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { CrudApi } from '../api/crud-api';
import { Project, ProjectInput } from '../models';

@Injectable({ providedIn: 'root' })
export class ProjectsService extends CrudApi<Project, ProjectInput> {
  protected readonly path = '/api/projects';

  /** Featured projects only, for the home page. */
  listFeatured(): Observable<Project[]> {
    return this.api.get<Project[]>(this.path, { featured: 'true' });
  }

  /** Public project pages use the slug in the URL: /projects/task-flow. */
  getBySlug(slug: string): Observable<Project> {
    return this.api.get<Project>(`${this.path}/slug/${encodeURIComponent(slug)}`);
  }
}
