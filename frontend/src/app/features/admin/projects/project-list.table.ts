import { Project } from '../../../core/models';
import { TableConfig } from '../../../shared/components/data-table/data-table.model';

/** Columns and actions of the admin Projects table. */
export const projectTable: TableConfig<Project> = {
  caption: 'Projects',
  loadingLabel: 'Loading projects…',
  columns: [
    {
      key: 'title',
      header: 'Title',
      sortable: true,
      link: (p) => ['/admin/projects', p.id, 'edit'],
      subtext: (p) => `/projects/${p.slug}`,
    },
    { key: 'technologies', header: 'Technologies', type: 'tags' },
    { key: 'displayOrder', header: 'Order', type: 'number', sortable: true },
    {
      // Clicking the star emits (action) with action = 'isFeatured'.
      key: 'isFeatured',
      header: 'Featured',
      type: 'toggle',
      sortable: true,
      toggle: { icon: 'star', label: (p) => `${p.isFeatured ? 'Unfeature' : 'Feature'} ${p.title}` },
    },
  ],
  actions: [
    { id: 'edit', icon: 'edit', text: 'Edit', label: (p) => `Edit ${p.title}`, link: (p) => ['/admin/projects', p.id, 'edit'] },
    { id: 'delete', icon: 'trash', text: 'Delete', label: (p) => `Delete ${p.title}`, danger: true },
  ],
  defaultSort: { key: 'displayOrder', direction: 'asc' },
  pageSize: 10,
  empty: { title: 'No projects yet', message: 'Add your first project to show it on the site.' },
};
