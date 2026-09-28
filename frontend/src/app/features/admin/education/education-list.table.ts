import { Education } from '../../../core/models';
import { TableConfig } from '../../../shared/components/data-table/data-table.model';

/** Columns and actions of the admin Education table. */
export const educationTable: TableConfig<Education> = {
  caption: 'Education',
  loadingLabel: 'Loading education…',
  columns: [
    {
      key: 'degree',
      header: 'Degree',
      sortable: true,
      value: (e) => (e.fieldOfStudy ? `${e.degree}, ${e.fieldOfStudy}` : e.degree),
      link: (e) => ['/admin/education', e.id, 'edit'],
    },
    { key: 'institution', header: 'Institution', sortable: true },
    {
      key: 'period',
      header: 'Period',
      type: 'dateRange',
      value: (e) => [e.startDate, e.endDate],
      sortValue: (e) => e.startDate,
      ongoingLabel: 'In progress',
      sortable: true,
    },
    { key: 'displayOrder', header: 'Order', type: 'number', sortable: true },
  ],
  actions: [
    { id: 'edit', icon: 'edit', text: 'Edit', label: (e) => `Edit ${e.degree}`, link: (e) => ['/admin/education', e.id, 'edit'] },
    { id: 'delete', icon: 'trash', text: 'Delete', label: (e) => `Delete ${e.degree}`, danger: true },
  ],
  defaultSort: { key: 'displayOrder', direction: 'asc' },
  pageSize: 10,
  empty: { title: 'No education yet', icon: 'graduation' },
};
