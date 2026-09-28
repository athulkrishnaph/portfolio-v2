import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { Education } from '../../../core/models';
import { EducationService } from '../../../core/services/education.service';
import { Loader } from '../../../core/utils/loader';
import { DataTable } from '../../../shared/components/data-table/data-table';
import { Icon } from '../../../shared/components/icon/icon';
import { PageHeader } from '../../../shared/components/page-header/page-header';
import { DeleteAction } from '../shared/delete-action';
import { educationTable } from './education-list.table';

/** /admin/education */
@Component({
  selector: 'app-education-list',
  imports: [RouterLink, PageHeader, Icon, DataTable],
  templateUrl: './education-list.html',
})
export class EducationList {
  private readonly service = inject(EducationService);

  protected readonly table = educationTable;
  protected readonly education = new Loader(() => this.service.list());
  protected readonly deleter = new DeleteAction('Education', (id) => this.service.delete(id));

  protected remove(e: Education): void {
    this.deleter.run(e.id, `${e.degree} at ${e.institution}`, () => this.education.refresh());
  }
}
