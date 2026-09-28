import { Certificate } from '../../../core/models';
import { TableConfig } from '../../../shared/components/data-table/data-table.model';

/** Columns and actions of the admin Certificates table. */
export const certificateTable: TableConfig<Certificate> = {
  caption: 'Certificates',
  loadingLabel: 'Loading certificates…',
  columns: [
    { key: 'title', header: 'Title', sortable: true, link: (c) => ['/admin/certificates', c.id, 'edit'] },
    { key: 'issuer', header: 'Issuer', sortable: true },
    { key: 'issueDate', header: 'Issued', type: 'date', sortable: true },
    { key: 'displayOrder', header: 'Order', type: 'number', sortable: true },
  ],
  actions: [
    { id: 'edit', icon: 'edit', text: 'Edit', label: (c) => `Edit ${c.title}`, link: (c) => ['/admin/certificates', c.id, 'edit'] },
    { id: 'delete', icon: 'trash', text: 'Delete', label: (c) => `Delete ${c.title}`, danger: true },
  ],
  defaultSort: { key: 'displayOrder', direction: 'asc' },
  pageSize: 10,
  empty: { title: 'No certificates yet', icon: 'award' },
};
