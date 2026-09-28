import { Experience } from '../../../core/models';
import { TableConfig } from '../../../shared/components/data-table/data-table.model';

/** Columns and actions of the admin Experience table. */
export const experienceTable: TableConfig<Experience> = {
  caption: 'Work experience',
  loadingLabel: 'Loading experience…',
  columns: [
    {
      key: 'position',
      header: 'Position',
      sortable: true,
      link: (e) => ['/admin/experience', e.id, 'edit'],
      badge: (e) => (e.isCurrent ? { label: 'Current', tone: 'success' } : null),
    },
    { key: 'company', header: 'Company', sortable: true },
    {
      key: 'period',
      header: 'Period',
      type: 'dateRange',
      value: (e) => [e.startDate, e.endDate],
      sortValue: (e) => e.startDate,
      sortable: true,
    },
    { key: 'displayOrder', header: 'Order', type: 'number', sortable: true },
  ],
  actions: [
    { id: 'edit', icon: 'edit', text: 'Edit', label: (e) => `Edit ${e.position}`, link: (e) => ['/admin/experience', e.id, 'edit'] },
    { id: 'delete', icon: 'trash', text: 'Delete', label: (e) => `Delete ${e.position}`, danger: true },
  ],
  defaultSort: { key: 'displayOrder', direction: 'asc' },
  pageSize: 10,
  empty: { title: 'No experience yet', icon: 'briefcase' },
};
