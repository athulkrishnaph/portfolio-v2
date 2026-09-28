import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { ApiError } from '../../../core/api/api-error';
import { DataTable } from './data-table';
import { TableActionEvent, TableConfig } from './data-table.model';

interface Row {
  id: number;
  name: string;
  tech: string[];
  order: number;
  start: string;
  end: string | null;
  featured: boolean;
}

const rows: Row[] = [
  { id: 1, name: 'Beta', tech: ['Go'], order: 2, start: '2021-03-01', end: null, featured: true },
  { id: 2, name: 'alpha', tech: [], order: 10, start: '2020-01-01', end: '2020-06-30', featured: false },
  { id: 3, name: 'Gamma', tech: ['Go', 'SQL'], order: 1, start: '2019-05-01', end: '2019-09-30', featured: false },
];

const config: TableConfig<Row> = {
  caption: 'Test rows',
  columns: [
    { key: 'name', header: 'Name', sortable: true, link: (r) => ['/rows', r.id], subtext: (r) => `#${r.id}`,
      badge: (r) => (r.featured ? { label: 'Top', tone: 'success' } : null) },
    { key: 'tech', header: 'Tech', type: 'tags' },
    { key: 'order', header: 'Order', type: 'number', sortable: true },
    { key: 'period', header: 'Period', type: 'dateRange', value: (r) => [r.start, r.end] },
    { key: 'featured', header: 'Featured', type: 'toggle', toggle: { icon: 'star', label: (r) => `Feature ${r.name}` } },
  ],
  actions: [
    { id: 'edit', icon: 'edit', text: 'Edit', label: (r) => `Edit ${r.name}`, link: (r) => ['/rows', r.id, 'edit'] },
    { id: 'delete', icon: 'trash', text: 'Delete', label: (r) => `Delete ${r.name}`, danger: true },
  ],
  defaultSort: { key: 'order', direction: 'asc' },
  empty: { title: 'No rows yet' },
};

describe('DataTable', () => {
  let fixture: ComponentFixture<DataTable<Row>>;
  let el: HTMLElement;

  function render(inputs: Record<string, unknown>) {
    TestBed.configureTestingModule({ imports: [DataTable], providers: [provideRouter([])] });
    fixture = TestBed.createComponent(DataTable<Row>);
    fixture.componentRef.setInput('config', config);
    for (const [k, v] of Object.entries(inputs)) fixture.componentRef.setInput(k, v);
    fixture.detectChanges();
    el = fixture.nativeElement;
  }

  const firstColumn = () =>
    [...el.querySelectorAll('tbody tr')].map((tr) => tr.querySelector('.table__title')?.textContent?.trim());

  it('renders headers, typed cells, links, badges and subtext', () => {
    render({ data: rows });
    expect([...el.querySelectorAll('thead th')].map((th) => th.textContent?.replace(/[▲▼↕]/g, '').trim())).toEqual([
      'Name', 'Tech', 'Order', 'Period', 'Featured', 'Actions',
    ]);
    const cells = [...el.querySelectorAll('tbody tr')[0].querySelectorAll('td')].map((td) => td.textContent?.trim());
    // Sorted by order (default sort): Gamma first.
    expect(cells[0]).toContain('Gamma');
    expect(cells[0]).toContain('#3');
    expect(cells[1]).toBe('Go, SQL');
    expect(cells[3]).toBe('May 2019 – Sep 2019');
    expect(el.querySelector('tbody tr:nth-child(2) td')?.textContent).toContain('Top');
    expect(el.querySelector('tbody tr:nth-child(3) td:nth-child(2)')?.textContent?.trim()).toBe('—'); // empty tags
    expect(el.querySelector('.table__title')?.getAttribute('href')).toBe('/rows/3');
    // Mobile card labels come from the headers (not on the first column).
    expect(el.querySelector('tbody td:nth-child(2)')?.getAttribute('data-label')).toBe('Tech');
    expect(el.querySelector('tbody td:first-child')?.hasAttribute('data-label')).toBe(false);
  });

  it('sorts when a sortable header is clicked', () => {
    render({ data: rows });
    expect(firstColumn()).toEqual(['Gamma', 'Beta', 'alpha']); // order asc

    const nameHeader = el.querySelectorAll<HTMLButtonElement>('.data-table__sort')[0];
    nameHeader.click();
    fixture.detectChanges();
    expect(firstColumn()).toEqual(['alpha', 'Beta', 'Gamma']); // case-insensitive
    expect(el.querySelector('thead th')?.getAttribute('aria-sort')).toBe('ascending');

    nameHeader.click();
    fixture.detectChanges();
    expect(firstColumn()).toEqual(['Gamma', 'Beta', 'alpha']);
    expect(el.querySelector('thead th')?.getAttribute('aria-sort')).toBe('descending');
  });

  it('paginates when a page size is configured', () => {
    TestBed.configureTestingModule({ imports: [DataTable], providers: [provideRouter([])] });
    fixture = TestBed.createComponent(DataTable<Row>);
    fixture.componentRef.setInput('config', { ...config, pageSize: 2 });
    fixture.componentRef.setInput('data', rows);
    fixture.detectChanges();
    el = fixture.nativeElement;

    expect(el.querySelectorAll('tbody tr').length).toBe(2);
    el.querySelector<HTMLButtonElement>('[aria-label="Page 2"]')!.click();
    fixture.detectChanges();
    expect(firstColumn()).toEqual(['alpha']);
  });

  it('groups several actions in a "⋮" menu, and disables the busy row', () => {
    render({ data: rows, busyRowId: 1 });
    const deleted: Row[] = [];
    const actions: TableActionEvent<Row>[] = [];
    fixture.componentInstance.deleteRequest.subscribe((r) => deleted.push(r));
    fixture.componentInstance.action.subscribe((a) => actions.push(a));

    expect(el.querySelector('thead th:last-child')?.textContent?.trim()).toBe('Actions');

    // Row order: Gamma (3), Beta (1, busy), alpha (2). One "⋮" button per row.
    const triggers = el.querySelectorAll<HTMLButtonElement>('.table__actions button[aria-haspopup="menu"]');
    expect(triggers.length).toBe(3);
    expect(triggers[0].getAttribute('aria-label')).toBe('More actions for Gamma');
    expect(triggers[1].disabled).toBe(true);
    expect(el.querySelector('[role="menu"]')).toBeNull();

    triggers[0].click();
    fixture.detectChanges();
    const menu = el.querySelector('[role="menu"]')!;
    expect(triggers[0].getAttribute('aria-expanded')).toBe('true');
    const items = [...menu.querySelectorAll<HTMLElement>('[role="menuitem"]')];
    expect(items.map((i) => i.textContent?.trim())).toEqual(['Edit', 'Delete']);
    expect(items[0].getAttribute('href')).toBe('/rows/3/edit'); // edit is a link

    items[1].click(); // Delete
    fixture.detectChanges();
    expect(deleted.map((r) => r.id)).toEqual([3]);
    expect(el.querySelector('[role="menu"]')).toBeNull(); // closes after choosing

    const star = el.querySelector<HTMLButtonElement>('.data-table__toggle')!;
    expect(star.getAttribute('aria-pressed')).toBe('false');
    expect(el.querySelectorAll('.data-table__toggle')[1].getAttribute('aria-pressed')).toBe('true');
    star.click();
    expect(actions).toEqual([
      { action: 'delete', row: rows[2] },
      { action: 'featured', row: rows[2] },
    ]);
  });

  it('closes the menu with Escape and on an outside click', () => {
    render({ data: rows });
    const trigger = el.querySelector<HTMLButtonElement>('button[aria-haspopup="menu"]')!;

    trigger.click();
    fixture.detectChanges();
    el.querySelector('[role="menu"]')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();
    expect(el.querySelector('[role="menu"]')).toBeNull();

    trigger.click();
    fixture.detectChanges();
    document.body.click();
    fixture.detectChanges();
    expect(el.querySelector('[role="menu"]')).toBeNull();
  });

  it('shows a single action directly, without a menu', () => {
    TestBed.configureTestingModule({ imports: [DataTable], providers: [provideRouter([])] });
    fixture = TestBed.createComponent(DataTable<Row>);
    fixture.componentRef.setInput('config', { ...config, actions: [config.actions![1]] });
    fixture.componentRef.setInput('data', rows);
    fixture.detectChanges();
    el = fixture.nativeElement;

    expect(el.querySelector('[aria-haspopup="menu"]')).toBeNull();
    const buttons = el.querySelectorAll('.table__actions button');
    expect(buttons.length).toBe(3);
    expect(buttons[0].querySelector('svg')?.getAttribute('aria-label')).toBe('Delete Gamma');
  });

  it('shows loading, error (with retry) and empty states', () => {
    render({ loading: true });
    expect(el.querySelector('app-spinner')).not.toBeNull();
    expect(el.querySelector('table')).toBeNull();

    fixture.componentRef.setInput('loading', false);
    fixture.componentRef.setInput('error', new ApiError(500, 'X', 'Could not load'));
    fixture.detectChanges();
    let retried = false;
    fixture.componentInstance.retry.subscribe(() => (retried = true));
    expect(el.textContent).toContain('Could not load');
    el.querySelector<HTMLButtonElement>('app-error-state button')!.click();
    expect(retried).toBe(true);

    fixture.componentRef.setInput('error', null);
    fixture.componentRef.setInput('data', []);
    fixture.detectChanges();
    expect(el.textContent).toContain('No rows yet');
  });
});
