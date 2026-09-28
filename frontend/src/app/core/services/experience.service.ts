import { Injectable } from '@angular/core';

import { CrudApi } from '../api/crud-api';
import { Experience, ExperienceInput } from '../models';

@Injectable({ providedIn: 'root' })
export class ExperienceService extends CrudApi<Experience, ExperienceInput> {
  protected readonly path = '/api/experience';
}
