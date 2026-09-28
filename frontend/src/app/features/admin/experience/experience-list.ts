import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { Experience } from '../../../core/models';
import { ExperienceService } from '../../../core/services/experience.service';
import { Loader } from '../../../core/utils/loader';
import { DataTable } from '../../../shared/components/data-table/data-table';
import { Icon } from '../../../shared/components/icon/icon';
import { PageHeader } from '../../../shared/components/page-header/page-header';
import { DeleteAction } from '../shared/delete-action';
import { experienceTable } from './experience-list.table';

/** /admin/experience */
@Component({
  selector: 'app-experience-list',
  imports: [RouterLink, PageHeader, Icon, DataTable],
  templateUrl: './experience-list.html',
})
export class ExperienceList {
  private readonly service = inject(ExperienceService);

  protected readonly table = experienceTable;
  protected readonly experience = new Loader(() => this.service.list());
  protected readonly deleter = new DeleteAction('Experience', (id) => this.service.delete(id));

  protected remove(e: Experience): void {
    this.deleter.run(e.id, `${e.position} at ${e.company}`, () => this.experience.refresh());
  }
}
