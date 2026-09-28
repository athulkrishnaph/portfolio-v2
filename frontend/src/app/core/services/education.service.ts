import { Injectable } from '@angular/core';

import { CrudApi } from '../api/crud-api';
import { Education, EducationInput } from '../models';

@Injectable({ providedIn: 'root' })
export class EducationService extends CrudApi<Education, EducationInput> {
  protected readonly path = '/api/education';
}
