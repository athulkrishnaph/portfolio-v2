import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { Project } from '../core/models';
import { pageItems, paginate } from './components/pagination/pagination';
import { ProjectCard } from './components/project-card/project-card';
import { DateRangePipe } from './pipes/date-range.pipe';

describe('pagination helpers', () => {
  it('pageItems shows first, last and neighbours with gaps', () => {
    expect(pageItems(1, 3)).toEqual([1, 2, 3]);
    expect(pageItems(6, 12)).toEqual([1, null, 5, 6, 7, null, 12]);
    expect(pageItems(3, 12)).toEqual([1, 2, 3, 4, null, 12]); // single gap filled with the page
  });

  it('paginate returns one page of items', () => {
    expect(paginate([1, 2, 3, 4, 5], 2, 2)).toEqual([3, 4]);
    expect(paginate([1, 2, 3], 5, 2)).toEqual([]);
  });
});

describe('DateRangePipe', () => {
  const pipe = new DateRangePipe();

  it('formats finished and ongoing ranges without time-zone shifts', () => {
    expect(pipe.transform('2021-03-01', '2023-06-30')).toBe('Mar 2021 – Jun 2023');
    expect(pipe.transform('2024-01-01', null)).toBe('Jan 2024 – Present');
    expect(pipe.transform('2024-01-01', null, 'In progress')).toBe('Jan 2024 – In progress');
  });
});

describe('ProjectCard', () => {
  const project: Project = {
    id: 1,
    title: 'Task Flow',
    slug: 'task-flow',
    summary: 'A Kanban board',
    description: '',
    githubUrl: 'https://github.com/me/task-flow',
    liveUrl: '',
    imageUrl: '',
    isFeatured: true,
    displayOrder: 1,
    technologies: ['Go', 'Angular', 'PostgreSQL', 'Docker', 'Redis', 'Kafka', 'gRPC'],
    createdAt: '',
    updatedAt: '',
  };

  it('renders title, link, featured badge, and limits technologies', () => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(ProjectCard);
    fixture.componentRef.setInput('project', project);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;

    const title = el.querySelector('h3 a') as HTMLAnchorElement;
    expect(title.textContent).toContain('Task Flow');
    expect(title.getAttribute('href')).toBe('/projects/task-flow');
    expect(el.textContent).toContain('Featured');
    // 5 technologies + "+2"
    const tags = [...el.querySelectorAll('.tag-list .tag')].map((t) => t.textContent?.trim());
    expect(tags).toEqual(['Go', 'Angular', 'PostgreSQL', 'Docker', 'Redis', '+2']);
    // Only the links that exist are rendered, and they open safely in a new tab.
    const external = el.querySelectorAll('.project__links a');
    expect(external.length).toBe(1);
    expect(external[0].getAttribute('rel')).toContain('noopener');
    // No image → initials placeholder.
    expect(el.querySelector('.project__placeholder')?.textContent).toBe('TF');
  });
});
