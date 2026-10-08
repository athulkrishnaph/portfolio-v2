import { Component, inject } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';

import { Skill } from '../../../core/models';
import { ActionsMenu, MenuAction } from '../../../shared/components/actions-menu/actions-menu';
import { Button } from '../../../shared/components/button/button';
import { EmptyState } from '../../../shared/components/empty-state/empty-state';
import { ErrorState } from '../../../shared/components/error-state/error-state';
import { FormField, FormInput } from '../../../shared/components/form-field/form-field';
import { Icon } from '../../../shared/components/icon/icon';
import { Modal } from '../../../shared/components/modal/modal';
import { PageHeader } from '../../../shared/components/page-header/page-header';
import { Spinner } from '../../../shared/components/spinner/spinner';
import { TruncatePipe, isTruncated } from '../../../shared/pipes/truncate.pipe';
import { SkillsAdminStore } from './skills-admin.store';

/**
 * /admin/skills: skills grouped by category, created and edited in a modal.
 * State and actions live in SkillsAdminStore; this class only wires the view.
 */
@Component({
  selector: 'app-skills-admin',
  imports: [
    ReactiveFormsModule,
    PageHeader,
    Icon,
    Spinner,
    ErrorState,
    EmptyState,
    Modal,
    FormField,
    FormInput,
    Button,
    ActionsMenu,
    TruncatePipe,
  ],
  providers: [SkillsAdminStore],
  templateUrl: './skills-admin.html',
  styleUrl: './skills-admin.scss',
})
export class SkillsAdmin {
  protected readonly store = inject(SkillsAdminStore);

  /** Longer skill names are shortened in the list (every name has a tooltip). */
  protected readonly maxNameLength = 15;
  protected readonly skillActions: MenuAction[] = [
    { id: 'edit', icon: 'edit', text: 'Edit' },
    { id: 'delete', icon: 'trash', text: 'Delete', danger: true },
  ];

  protected isLong(name: string): boolean {
    return isTruncated(name, this.maxNameLength);
  }

  /** A "⋮" menu choice on a skill. */
  protected onAction(id: string, skill: Skill): void {
    if (id === 'edit') this.store.openEdit(skill);
    if (id === 'delete') this.store.remove(skill);
  }
}
